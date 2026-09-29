import { NextResponse } from "next/server";
import { listWorkflows, listWorkflowRuns } from "@/lib/github";
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
  const branch = url.searchParams.get("branch");
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required", requestId }, { status: 400 });
  try {
    const [{ workflows, mock: mockWf }, { runs, mock: mockRuns }] = await Promise.all([
      listWorkflows(owner, repo),
      listWorkflowRuns(owner, repo, branch ?? undefined),
    ]);
    return NextResponse.json({ workflows, runs, mock: mockWf || mockRuns, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Workflows fetch failed", requestId }, { status: 502 });
  }
}
