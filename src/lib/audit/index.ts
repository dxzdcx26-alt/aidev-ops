/**
 * Audit Log — Phase 7 (persistent) + Phase 13 §68
 *
 * Persistent audit log stored in Prisma database.
 * Survives restart. Cannot be cleared from public API.
 *
 * Per spec §13: "ห้ามบันทึก secret"
 * Per spec §89: "Audit Log ต้องไม่ถูกแก้ไขง่าย ๆ จาก UI"
 */

import "server-only";
import { db } from "@/lib/db";
import type { AuditAction, AuditEventStatus, RiskLevel } from "@/types";

export type AuditInput = {
  actorId?: string;
  actor: string; // username or agent name
  action: AuditAction;
  target?: string;
  status: AuditEventStatus;
  risk?: RiskLevel;
  metadata?: Record<string, unknown>;
  requestId?: string;
  repository?: string;
  commitSha?: string;
  reason?: string;
  ip?: string;
  // Legacy compat
  detail?: string;
  user?: string;
  agent?: string;
  branch?: string;
  result?: "success" | "failure" | "denied";
};

export async function audit(opts: AuditInput): Promise<void> {
  // Sanitize: never store secrets in metadata
  const sanitizedMetadata = opts.metadata ? sanitizeMetadata(opts.metadata) : {};

  try {
    await db.auditEvent.create({
      data: {
        actorId: opts.actorId ?? null,
        action: opts.action,
        target: opts.target ?? null,
        repository: opts.repository ?? null,
        commitSha: opts.commitSha ?? null,
        requestId: opts.requestId ?? null,
        result: opts.status,
        reason: opts.reason ?? opts.detail ?? null,
        metadata: JSON.stringify(sanitizedMetadata),
        ip: opts.ip ?? null,
      },
    });
  } catch (err) {
    // If DB is unavailable, fall back to stderr (never silent per spec §108)
    console.error("[audit] failed to persist event:", err instanceof Error ? err.message : String(err), {
      action: opts.action,
      target: opts.target,
      actor: opts.actor,
    });
  }
}

export async function listAudit(limit = 100, offset = 0): Promise<{
  events: Array<{
    id: string;
    eventId: string;
    timestamp: string;
    actorId: string | null;
    actor: string;
    action: string;
    target: string | null;
    repository: string | null;
    commitSha: string | null;
    requestId: string | null;
    status: string;
    reason: string | null;
    metadata: Record<string, unknown>;
    ip: string | null;
  }>;
  total: number;
}> {
  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
      include: { actor: true },
    }),
    db.auditEvent.count(),
  ]);

  return {
    events: events.map((e) => ({
      id: e.id,
      eventId: e.id,
      timestamp: e.timestamp.toISOString(),
      actorId: e.actorId,
      actor: e.actor?.username ?? "system",
      action: e.action as AuditAction,
      target: e.target,
      repository: e.repository,
      commitSha: e.commitSha,
      requestId: e.requestId,
      status: e.result as AuditEventStatus,
      reason: e.reason,
      metadata: safeParseMetadata(e.metadata),
      ip: e.ip,
    })),
    total,
  };
}

function safeParseMetadata(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Strip any potential secrets from metadata before storing.
 * Per spec §13: "ห้ามบันทึก secret"
 */
function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const SECRET_KEY_PATTERNS = /token|secret|password|api[_-]?key|auth|cookie|session/i;
  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEY_PATTERNS.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + "...[truncated]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Note: clearAudit is intentionally NOT exported — audit log is append-only (§89).
