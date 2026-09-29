import { NextResponse } from "next/server";
import { evaluateMergeGates } from "@/lib/merge-gate";
import { listChecks, getPullRequest, getDiffFiles } from "@/lib/github";
import { audit } from "@/lib/audit";
import { requireAuth, AuthError } from "@/lib/auth";
import { hasValidApproval } from "@/lib/approvals";
import { v4 as uuid } from "uuid";
import { analyzeDiff } from "@/lib/analyzer";
import type { AIAnalysisResult, SecurityFinding } from "@/types";

export async function POST(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  // Phase 1: Authenticate
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, code: "AUTH_REQUIRED", requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  // Per Phase 4: client-supplied aiAnalysis/humanApproved/securityFindings are IGNORED
  // The server fetches authoritative state from the sources of truth.
  const { owner, repo, ref, prNumber } = body as {
    owner?: string;
    repo?: string;
    ref?: string;
    prNumber?: number;
  };

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner, repo required", requestId }, { status: 400 });
  }

  // Phase 4: Fetch authoritative state from sources of truth

  // 1. Fetch real CI checks from GitHub (if configured)
  let checks;
  try {
    if (ref) {
      const res = await listChecks(owner, repo, ref);
      checks = res.checks;
    }
  } catch (err) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "GITHUB_CALL",
      target: `${owner}/${repo}@${ref}`,
      status: "failure",
      reason: err instanceof Error ? err.message : String(err),
      ip,
      requestId,
    });
  }

  // 2. Fetch PR data (for commit SHA, branch policy, merge state)
  let pr;
  let commitSha: string | undefined;
  try {
    if (prNumber) {
      const res = await getPullRequest(owner, repo, prNumber);
      pr = res.pullRequest;
      commitSha = pr.head.sha;
    }
  } catch (err) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "GITHUB_CALL",
      target: `${owner}/${repo}#${prNumber}`,
      status: "failure",
      reason: err instanceof Error ? err.message : String(err),
      ip,
      requestId,
    });
  }

  // 3. Fetch diff and run baseline security analysis (server-side, authoritative)
  let securityFindings: SecurityFinding[] = [];
  let aiAnalysis: AIAnalysisResult | undefined;
  try {
    if (prNumber) {
      const diffRes = await getDiffFiles(owner, repo, prNumber);
      const summary = analyzeDiff(diffRes.files);
      // Run security scan on the diff (server-side)
      const { scanPatch } = await import("@/lib/security");
      diffRes.files.forEach((f) => {
        securityFindings.push(...scanPatch(f.patch ?? "", f.filename));
      });
      // Note: full AI analysis is a separate call — merge gate uses baseline if no AI analysis stored
      // In production, the AI analysis result would be stored in DB and fetched here by commitSha
      aiAnalysis = undefined; // Must be fetched from DB (not client-supplied)
      void summary; // summary available for logging if needed
    }
  } catch (err) {
    audit({
      actorId: user.id,
      actor: user.username,
      action: "ANALYZE",
      target: `${owner}/${repo}#${prNumber}`,
      status: "failure",
      reason: `Failed to fetch diff for security analysis: ${err instanceof Error ? err.message : String(err)}`,
      ip,
      requestId,
    });
  }

  // 4. Check human approval — server-side approval record lookup
  // Per Phase 4: humanApproved from client body is IGNORED
  const target = prNumber ? `PR #${prNumber}` : ref ?? "unknown";
  const humanApproved = prNumber
    ? await hasValidApproval({
        action: "merge",
        target,
        repository: `${owner}/${repo}`,
        commitSha,
      })
    : false;

  // 5. Typecheck — derive only from authoritative GitHub checks.
  // Never assume PASS: if no completed TypeScript check exists, the gate remains blocked.
  const typecheckCheck = checks?.find((c) => /type.?check|typescript|tsc/i.test(c.name));
  const typecheckPassed = typecheckCheck?.status === "completed"
    ? typecheckCheck.conclusion === "success"
    : undefined;

  const result = evaluateMergeGates({
    checks,
    aiAnalysis,
    securityFindings,
    humanApproved,
    typecheckPassed,
  });

  audit({
    actorId: user.id,
    actor: user.username,
    action: "VIEW",
    target: "merge-gate",
    repository: `${owner}/${repo}`,
    commitSha,
    status: result.overall === "READY" ? "success" : "warning",
    risk: result.overall === "BLOCKED" ? "HIGH" : "LOW",
    reason: `Merge gate: ${result.overall}`,
    metadata: {
      overall: result.overall,
      gates: result.gates.map((g) => ({ id: g.id, status: g.status, reason: g.reason })),
      blockingReasons: result.blockingReasons,
      prNumber,
      commitSha,
    },
    ip,
    requestId,
  });

  return NextResponse.json({ ...result, requestId });
}
