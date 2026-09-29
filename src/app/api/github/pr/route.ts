import { NextResponse } from "next/server";
import { listPullRequests, getPullRequest } from "@/lib/github";
import { requireAuth, AuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: Request) {
  const requestId = uuid();
  try {
    await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  const prParam = url.searchParams.get("pr");
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required", requestId }, { status: 400 });
  try {
    if (prParam) {
      const pr = Number(prParam);
      const { pullRequest, mock } = await getPullRequest(owner, repo, pr);
      return NextResponse.json({ pullRequest, mock, requestId });
    }
    const state = (url.searchParams.get("state") as "open" | "closed" | "all" | null) ?? "open";
    const { pullRequests, mock } = await listPullRequests(owner, repo, state);
    return NextResponse.json({ pullRequests, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "GitHub API failed", requestId }, { status: 502 });
  }
}
