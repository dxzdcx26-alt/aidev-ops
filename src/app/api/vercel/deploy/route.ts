import { NextResponse } from "next/server";
import { createDeployment } from "@/lib/vercel";
import { audit } from "@/lib/audit";
import { requireAuth, requireActionPermission, AuthError } from "@/lib/auth";
import { consumeApproval, ApprovalError } from "@/lib/approvals";
import { v4 as uuid } from "uuid";
import type { ApprovalAction } from "@/types";

export async function POST(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // Phase 1: Authenticate — no client-provided identity is trusted
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    audit({
      actor: "anonymous",
      action: "DEPLOY",
      status: "denied",
      reason: e.message,
      ip,
      requestId,
    });
    return NextResponse.json({ error: e.message, code: "AUTH_REQUIRED", requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  // Per Phase 5: body.approved is IGNORED — client-provided flags are NOT authority
  const { ref, sha, target, approvalId } = body as {
    ref: string;
    sha?: string;
    target?: "production" | "preview";
    approvalId?: string;
  };

  // Validate required fields
  if (!ref) {
    return NextResponse.json({ error: "ref (branch) required", requestId }, { status: 400 });
  }

  // Server-side role enforcement. Preview and production deploys both require
  // a role with DEPLOY capability; production additionally requires approval.
  try {
    const permissionUser = await requireActionPermission("DEPLOY", target === "production");
    if (permissionUser.id !== user.id) {
      return NextResponse.json({ error: "Authentication context changed", code: "AUTH_INVALID", requestId }, { status: 401 });
    }
  } catch (err) {
    const e = err as AuthError;
    audit({ actorId: user.id, actor: user.username, action: "DEPLOY", target: ref, status: "denied", reason: e.message, ip, requestId });
    return NextResponse.json({ error: e.message, code: e.statusCode === 403 ? "PERMISSION_DENIED" : "AUTH_REQUIRED", requestId }, { status: e.statusCode });
  }

  // Phase 5: Production deploy requires a valid, server-side approval record
  if (target === "production") {
    if (!approvalId) {
      audit({
        actorId: user.id,
        actor: user.username,
        action: "DEPLOY",
        target: `production:${ref}`,
        status: "denied",
        reason: "Production deploy requires approvalId — client-approved flag is not accepted",
        ip,
        requestId,
      });
      return NextResponse.json({
        error: "Production deploy requires a valid approvalId (server-side approval record)",
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
        action: "deploy" as ApprovalAction,
        target: `production:${ref}`,
        commitSha: sha,
      });
      audit({
        actorId: user.id,
        actor: user.username,
        action: "APPROVE",
        target: `approval:${approvalId}`,
        status: "success",
        reason: `Approval consumed for production deploy`,
        metadata: { consumedApproval: consumed.id },
        ip,
        requestId,
      });
    } catch (err) {
      const e = err as ApprovalError;
      audit({
        actorId: user.id,
        actor: user.username,
        action: "DEPLOY",
        target: `production:${ref}`,
        status: "denied",
        reason: `Approval consumption failed: ${e.message}`,
        metadata: { approvalId },
        ip,
        requestId,
      });
      return NextResponse.json({ error: e.message, code: "APPROVAL_INVALID", requestId }, { status: e.statusCode });
    }
  }

  try {
    const { deployment, mock } = await createDeployment({ ref, sha, target: target ?? "preview" });
    audit({
      actorId: user.id,
      actor: user.username,
      action: "DEPLOY",
      target: deployment.id,
      repository: ref,
      commitSha: sha,
      status: "success",
      reason: `createDeployment ref=${ref} target=${target ?? "preview"} (mock=${mock})`,
      ip,
      requestId,
    });
    return NextResponse.json({ deployment, mock, requestId });
  } catch (err) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "DEPLOY",
      target: ref,
      status: "failure",
      reason: `createDeployment: ${err instanceof Error ? err.message : String(err)}`,
      ip,
      requestId,
    });
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Deploy failed",
      code: "DEPLOY_FAILED",
      requestId,
    }, { status: 502 });
  }
}
