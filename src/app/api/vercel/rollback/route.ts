import { NextResponse } from "next/server";
import { rollbackDeployment } from "@/lib/vercel";
import { audit } from "@/lib/audit";
import { requireAuth, requireActionPermission, AuthError } from "@/lib/auth";
import { consumeApproval, ApprovalError } from "@/lib/approvals";
import { v4 as uuid } from "uuid";
import type { ApprovalAction } from "@/types";

export async function POST(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // Phase 1: Authenticate
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    audit({
      actor: "anonymous",
      action: "ROLLBACK",
      status: "denied",
      reason: e.message,
      ip,
      requestId,
    });
    return NextResponse.json({ error: e.message, code: "AUTH_REQUIRED", requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  // Per Phase 6: body.approved is IGNORED — client-provided flags are NOT authority
  const { id, approvalId } = body as { id: string; approvalId?: string };

  if (!id) {
    return NextResponse.json({ error: "id (deployment ID) required", requestId }, { status: 400 });
  }

  // Rollback is an approval-gated privileged action. Enforce the role before
  // consuming the approval so a lower-privileged session cannot replay one.
  try {
    const permissionUser = await requireActionPermission("ROLLBACK", Boolean(approvalId));
    if (permissionUser.id !== user.id) {
      return NextResponse.json({ error: "Authentication context changed", code: "AUTH_INVALID", requestId }, { status: 401 });
    }
  } catch (err) {
    const e = err as AuthError;
    audit({ actorId: user.id, actor: user.username, action: "ROLLBACK", target: id, status: "denied", reason: e.message, ip, requestId });
    return NextResponse.json({ error: e.message, code: e.statusCode === 403 ? "PERMISSION_DENIED" : "AUTH_REQUIRED", requestId }, { status: e.statusCode });
  }

  // Phase 6: Rollback requires a valid, server-side approval record
  if (!approvalId) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "ROLLBACK",
      target: id,
      status: "denied",
      reason: "Rollback requires approvalId — client-approved flag is not accepted",
      ip,
      requestId,
    });
    return NextResponse.json({
      error: "Rollback requires a valid approvalId (server-side approval record)",
      code: "APPROVAL_REQUIRED",
      requestId,
    }, { status: 403 });
  }

  // Consume the approval — validates action, target, status, expiration, one-time use
  try {
    const consumed = await consumeApproval({
      id: approvalId,
      actorId: user.id,
      actorRole: user.role,
      action: "rollback" as ApprovalAction,
      target: id,
    });
    audit({
      actorId: user.id,
      actor: user.username,
      action: "APPROVE",
      target: `approval:${approvalId}`,
      status: "success",
      reason: `Approval consumed for rollback`,
      metadata: { consumedApproval: consumed.id },
      ip,
      requestId,
    });
  } catch (err) {
    const e = err as ApprovalError;
    audit({
      actorId: user.id,
      actor: user.username,
      action: "ROLLBACK",
      target: id,
      status: "denied",
      reason: `Approval consumption failed: ${e.message}`,
      metadata: { approvalId },
      ip,
      requestId,
    });
    return NextResponse.json({ error: e.message, code: "APPROVAL_INVALID", requestId }, { status: e.statusCode });
  }

  try {
    const { deployment, mock } = await rollbackDeployment(id);
    audit({
      actorId: user.id,
      actor: user.username,
      action: "ROLLBACK",
      target: id,
      status: "success",
      reason: `Rollback to ${id} (mock=${mock})`,
      ip,
      requestId,
    });
    return NextResponse.json({ deployment, mock, requestId });
  } catch (err) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "ROLLBACK",
      target: id,
      status: "failure",
      reason: `Rollback failed: ${err instanceof Error ? err.message : String(err)}`,
      ip,
      requestId,
    });
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Rollback failed",
      code: "ROLLBACK_FAILED",
      requestId,
    }, { status: 502 });
  }
}
