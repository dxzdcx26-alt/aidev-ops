/**
 * Approval System — Phase 3 (server-authoritative, persistent)
 *
 * Per spec Phase 3:
 *   - Approval ต้อง persistent
 *   - ผูกกับ action, target, repository, PR, commit SHA, actor, expiration
 *   - ห้ามนำ approval ของ PR/SHA หนึ่งไปใช้กับอีก PR/SHA
 *   - approval ที่ใช้แล้วต้องไม่ reuse ถ้า action ต้อง one-time
 *
 * Per spec Phase 5/6:
 *   - ห้ามใช้ body.approved เป็น security authority
 *   - ต้อง reject: fake, expired, wrong user/role/PR/SHA/repo, already consumed
 */

import "server-only";
import { db } from "@/lib/db";
import type { ApprovalAction, RiskLevel, Role, Permission } from "@/types";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

const DEFAULT_TTL_MS = 1000 * 60 * 30; // 30 minutes

export type CreateApprovalInput = {
  actorId: string; // The user requesting the approval (must be authenticated)
  action: ApprovalAction;
  target: string;
  reason: string;
  repository?: string;
  pullRequest?: number;
  commitSha?: string;
  risk?: RiskLevel;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
};

export type ApprovalRecordDB = {
  id: string;
  action: string;
  target: string;
  repository: string | null;
  pullRequest: number | null;
  commitSha: string | null;
  actorId: string;
  actorUsername: string;
  status: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  metadata: Record<string, unknown>;
};

export async function createApproval(opts: CreateApprovalInput): Promise<ApprovalRecordDB> {
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS));
  const record = await db.approvalRecord.create({
    data: {
      action: opts.action,
      target: opts.target,
      repository: opts.repository ?? null,
      pullRequest: opts.pullRequest ?? null,
      commitSha: opts.commitSha ?? null,
      actorId: opts.actorId,
      status: "pending",
      reason: opts.reason,
      expiresAt,
      metadata: JSON.stringify(opts.metadata ?? {}),
    },
    include: { actor: true },
  });
  return toRecord(record);
}

/**
 * Approve a pending approval. Only a different authenticated user with the
 * APPROVE permission may approve (separation of duties — the requester cannot
 * approve their own request).
 */
export async function approveApproval(
  id: string,
  approverId: string,
  approverRole: string,
): Promise<ApprovalRecordDB> {
  const record = await db.approvalRecord.findUnique({ where: { id }, include: { actor: true } });
  if (!record) throw new ApprovalError("Approval not found", 404);
  if (record.status !== "pending") {
    throw new ApprovalError(`Approval is already ${record.status}`, 409);
  }
  if (record.expiresAt < new Date()) {
    await db.approvalRecord.update({ where: { id }, data: { status: "expired" } });
    throw new ApprovalError("Approval has expired", 410);
  }
  // Separation of duties: requester cannot approve their own request
  if (record.actorId === approverId) {
    throw new ApprovalError("Cannot approve your own request — separation of duties", 403);
  }
  // Only admin role can approve (per permission matrix, APPROVE is human-only + admin role)
  if (approverRole !== "admin") {
    throw new ApprovalError("Only admin role can approve", 403);
  }
  const updated = await db.approvalRecord.update({
    where: { id },
    data: { status: "approved" },
    include: { actor: true },
  });
  return toRecord(updated);
}

export async function rejectApproval(
  id: string,
  _rejecterId: string,
): Promise<ApprovalRecordDB> {
  const record = await db.approvalRecord.findUnique({ where: { id } });
  if (!record) throw new ApprovalError("Approval not found", 404);
  if (record.status !== "pending") {
    throw new ApprovalError(`Approval is already ${record.status}`, 409);
  }
  const updated = await db.approvalRecord.update({
    where: { id },
    data: { status: "rejected" },
    include: { actor: true },
  });
  return toRecord(updated);
}

/**
 * Consume an approval — marks it as used (one-time). Validates that the
 * approval matches the action/target/repository/commitSha being performed.
 *
 * Per spec Phase 5: reject wrong PR/SHA/repo, already consumed, expired.
 */
export async function consumeApproval(opts: {
  id: string;
  actorId: string; // The user consuming (must be authenticated)
  actorRole?: Role;
  action: ApprovalAction;
  target: string;
  repository?: string;
  pullRequest?: number;
  commitSha?: string;
}): Promise<ApprovalRecordDB> {
  const record = await db.approvalRecord.findUnique({ where: { id: opts.id }, include: { actor: true } });
  if (!record) throw new ApprovalError("Approval not found", 404);

  // Status checks
  if (record.status === "consumed") {
    throw new ApprovalError("Approval already consumed — one-time use enforced", 409);
  }
  if (record.status === "rejected") {
    throw new ApprovalError("Approval was rejected", 409);
  }
  if (record.status === "expired" || record.expiresAt < new Date()) {
    await db.approvalRecord.update({ where: { id: opts.id }, data: { status: "expired" } }).catch(() => {});
    throw new ApprovalError("Approval has expired", 410);
  }
  if (record.status !== "approved") {
    throw new ApprovalError(`Approval is ${record.status} — cannot consume`, 409);
  }

  // Enforce the consumer's server-side role as well as the approval record.
  // A valid approval must never become a privilege-escalation token.
  if (opts.actorRole) {
    const requiredPermission = record.action.toUpperCase() as Permission;
    const rolePermissions = ROLE_PERMISSIONS[opts.actorRole] ?? [];
    if (!rolePermissions.includes(requiredPermission)) {
      throw new ApprovalError(`Role "${opts.actorRole}" is not authorized for ${record.action}`, 403);
    }
  }

  // Match checks — approval must match the action being performed
  if (record.action !== opts.action) {
    throw new ApprovalError(`Approval action mismatch: approval is for "${record.action}", requested "${opts.action}"`, 403);
  }
  if (record.target !== opts.target) {
    throw new ApprovalError(`Approval target mismatch: approval is for "${record.target}", requested "${opts.target}"`, 403);
  }
  if (opts.repository && record.repository && record.repository !== opts.repository) {
    throw new ApprovalError(`Approval repository mismatch`, 403);
  }
  if (opts.pullRequest !== undefined && record.pullRequest !== null && record.pullRequest !== opts.pullRequest) {
    throw new ApprovalError(`Approval PR mismatch`, 403);
  }
  if (opts.commitSha && record.commitSha && record.commitSha !== opts.commitSha) {
    throw new ApprovalError(`Approval commit SHA mismatch`, 403);
  }

  // Mark as consumed
  const updated = await db.approvalRecord.update({
    where: { id: opts.id },
    data: { status: "consumed", consumedAt: new Date() },
    include: { actor: true },
  });
  return toRecord(updated);
}

/**
 * Check if a valid (approved, unconsumed, non-expired) approval exists for the
 * given action+target. Does NOT consume it.
 */
export async function hasValidApproval(opts: {
  action: ApprovalAction;
  target: string;
  repository?: string;
  commitSha?: string;
}): Promise<boolean> {
  const records = await db.approvalRecord.findMany({
    where: {
      action: opts.action,
      target: opts.target,
      status: "approved",
    },
  });
  const now = new Date();
  for (const r of records) {
    if (r.expiresAt < now) continue;
    if (r.consumedAt) continue;
    if (opts.repository && r.repository && r.repository !== opts.repository) continue;
    if (opts.commitSha && r.commitSha && r.commitSha !== opts.commitSha) continue;
    return true;
  }
  return false;
}

export async function getApproval(id: string): Promise<ApprovalRecordDB | null> {
  const record = await db.approvalRecord.findUnique({ where: { id }, include: { actor: true } });
  return record ? toRecord(record) : null;
}

export async function listApprovals(limit = 50): Promise<ApprovalRecordDB[]> {
  const records = await db.approvalRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });
  return records.map(toRecord);
}

// ============ Helpers ============

function toRecord(r: {
  id: string;
  action: string;
  target: string;
  repository: string | null;
  pullRequest: number | null;
  commitSha: string | null;
  actorId: string;
  actor: { username: string } | null;
  status: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  metadata: string;
}): ApprovalRecordDB {
  return {
    id: r.id,
    action: r.action,
    target: r.target,
    repository: r.repository,
    pullRequest: r.pullRequest,
    commitSha: r.commitSha,
    actorId: r.actorId,
    actorUsername: r.actor?.username ?? "unknown",
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    consumedAt: r.consumedAt?.toISOString() ?? null,
    metadata: safeParse(r.metadata),
  };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export class ApprovalError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApprovalError";
    this.statusCode = statusCode;
  }
}
