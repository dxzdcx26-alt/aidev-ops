import { NextResponse } from "next/server";
import { analyzePRDiff } from "@/lib/ai/provider";
import { getDiffFiles } from "@/lib/github";
import { audit } from "@/lib/audit";
import { requireAuth, AuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { StructuredError } from "@/lib/errors";

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
  const { owner, repo, pr, files: providedFiles } = body as {
    owner?: string;
    repo?: string;
    pr?: number;
    files?: { filename: string; patch?: string; additions: number; deletions: number; status: string; sha?: string; changes?: number }[];
  };

  const startMs = Date.now();

  audit({
    actorId: user.id,
    actor: user.username,
    action: "AI_CALL",
    target: pr ? `PR #${pr}` : "manual",
    repository: owner && repo ? `${owner}/${repo}` : undefined,
    status: "success",
    reason: `analyzePRDiff start`,
    metadata: { owner, repo, pr, fileCount: providedFiles?.length ?? 0 },
    ip,
    requestId,
  });

  try {
    // If files not provided, fetch from GitHub
    let files = providedFiles ?? [];
    if (files.length === 0 && owner && repo && pr) {
      const res = await getDiffFiles(owner, repo, pr);
      files = res.files;
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files to analyze", code: "VALIDATION", requestId },
        { status: 400 },
      );
    }

    const normalized = files.map((f) => ({
      sha: f.sha ?? Math.random().toString(36).slice(2),
      filename: f.filename,
      status: (f.status as "added" | "modified" | "removed" | "renamed" | "binary") ?? "modified",
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      changes: f.changes ?? (f.additions ?? 0) + (f.deletions ?? 0),
      patch: f.patch,
      raw_url: "",
      blob_url: "",
    }));

    const { result, fallback, attempts, errors, sanitization } = await analyzePRDiff({
      files: normalized,
      prNumber: pr,
      repository: owner && repo ? `${owner}/${repo}` : undefined,
    });

    const durationMs = Date.now() - startMs;

    audit({
      actorId: user.id,
      actor: user.username,
      action: "ANALYZE",
      target: pr ? `PR #${pr}` : "manual",
      repository: owner && repo ? `${owner}/${repo}` : undefined,
      status: "success",
      risk: result.riskLevel,
      reason: `AI analysis (${result.provider}/${result.model}, fallback=${fallback})`,
      metadata: {
        fallback,
        attempts,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        durationMs,
        redactedSecrets: sanitization.redactedSecrets,
        promptInjectionDetected: sanitization.injectionDetected,
        securityFindings: result.security.length,
        blockers: result.blockers.length,
      },
      ip,
      requestId,
    });

    // If prompt injection was detected, log a security alert
    if (sanitization.injectionDetected) {
      audit({
        actorId: user.id,
        actor: user.username,
        action: "SECURITY_ALERT",
        target: pr ? `PR #${pr}` : "manual",
        status: "warning",
        risk: "HIGH",
        reason: "Prompt injection patterns detected in repository content — neutralized before AI call",
        metadata: {
          type: "prompt_injection",
          patterns: sanitization.injectionPatterns,
        },
        ip,
        requestId,
      });
    }

    return NextResponse.json({
      result,
      fallback,
      attempts,
      errors,
      durationMs,
      sanitization,
      requestId,
    });
  } catch (err) {
    const structured = err instanceof StructuredError ? err.toJSON() : { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) };
    audit({
      actorId: user.id,
      actor: user.username,
      action: "AI_CALL",
      target: pr ? `PR #${pr}` : "manual",
      status: "failure",
      reason: `analyzePRDiff failed: ${structured.message}`,
      metadata: structured,
      ip,
      requestId,
    });
    return NextResponse.json({ error: structured.message, code: structured.code, requestId }, { status: 500 });
  }
}
