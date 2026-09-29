import { NextResponse } from "next/server";
import { getRepository, listBranches } from "@/lib/github";
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
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required", requestId }, { status: 400 });
  try {
    const [{ repository, mock: mockRepo }, { branches, mock: mockBranches }] = await Promise.all([
      getRepository(owner, repo),
      listBranches(owner, repo),
    ]);
    return NextResponse.json({ repository, branches, mock: mockRepo || mockBranches, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "GitHub API failed", requestId }, { status: 502 });
  }
}
