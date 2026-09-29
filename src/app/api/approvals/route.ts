import { NextResponse } from "next/server";
import { createApproval, approveApproval, rejectApproval, listApprovals, ApprovalError } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { requireAuth, AuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import type { ApprovalAction } from "@/types";

export async function GET() {
  const requestId = uuid();
  try {
    await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }
  const approvals = await listApprovals(50);
  return NextResponse.json({ approvals });
}

export async function POST(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // Phase 1: Authenticate — user identity comes from server-side session, NOT request body
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  // Per Phase 3: user from client body is IGNORED — server-side identity is authoritative
  const { action, target, reason, repository, pullRequest, commitSha, risk, metadata, ttlMs } = body as {
    action: ApprovalAction;
    target: string;
    reason: string;
    repository?: string;
    pullRequest?: number;
    commitSha?: string;
    risk?: string;
    metadata?: Record<string, unknown>;
    ttlMs?: number;
  };

  if (!action || !target || !reason) {
    return NextResponse.json({ error: "action, target, reason required", requestId }, { status: 400 });
  }

  try {
    const record = await createApproval({
      actorId: user.id, // Server-side identity — NOT from client body
      action,
      target,
      reason,
      repository,
      pullRequest,
      commitSha,
      risk: risk as never,
      metadata,
      ttlMs,
    });

    audit({
      actorId: user.id,
      actor: user.username,
      action: "APPROVE",
      target,
      repository,
      commitSha,
      status: "success",
      reason: `Approval requested for ${action}: ${target}`,
      metadata: { approvalId: record.id, action },
      ip,
      requestId,
    });

    return NextResponse.json({ approval: record, requestId });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to create approval",
      requestId,
    }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  // Per Phase 3: decision from client body is the requested decision, but
  // the server validates the approver has permission (admin role only)
  const { id, decision } = body as { id: string; decision: "approved" | "rejected" };

  if (!id || !decision) {
    return NextResponse.json({ error: "id, decision required", requestId }, { status: 400 });
  }

  try {
    let record;
    if (decision === "approved") {
      record = await approveApproval(id, user.id, user.role);
    } else {
      record = await rejectApproval(id, user.id);
    }

    audit({
      actorId: user.id,
      actor: user.username,
      action: decision === "approved" ? "APPROVE" : "REJECT",
      target: record.target,
      repository: record.repository ?? undefined,
      commitSha: record.commitSha ?? undefined,
      status: "success",
      reason: `${decision === "approved" ? "Approved" : "Rejected"} ${record.action}: ${record.target}`,
      metadata: { approvalId: id, originalRequester: record.actorUsername },
      ip,
      requestId,
    });

    return NextResponse.json({ approval: record, requestId });
  } catch (err) {
    const e = err as ApprovalError;
    audit({
      actorId: user.id,
      actor: user.username,
      action: "APPROVE",
      target: id,
      status: "denied",
      reason: e.message,
      ip,
      requestId,
    });
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }
}
