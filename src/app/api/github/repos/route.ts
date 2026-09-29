import { NextResponse } from "next/server";
import { listRepositories } from "@/lib/github";
import { audit } from "@/lib/audit";
import { requireAuth, AuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET() {
  const requestId = uuid();
  try {
    await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }
  try {
    const { repositories, mock } = await listRepositories();
    audit({
      actor: "system",
      action: "GITHUB_CALL",
      target: "listRepositories",
      status: "success",
      metadata: { mock, count: repositories.length },
      requestId,
    });
    return NextResponse.json({ repositories, mock, requestId });
  } catch (err) {
    audit({
      actor: "system",
      action: "GITHUB_CALL",
      target: "listRepositories",
      status: "failure",
      reason: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : "GitHub API failed", requestId }, { status: 502 });
  }
}
