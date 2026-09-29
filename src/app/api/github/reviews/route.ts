import { NextResponse } from "next/server";
import { listReviews } from "@/lib/github";
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
  const pr = url.searchParams.get("pr");
  if (!owner || !repo || !pr) return NextResponse.json({ error: "owner, repo, pr required", requestId }, { status: 400 });
  try {
    const { reviews, mock } = await listReviews(owner, repo, Number(pr));
    return NextResponse.json({ reviews, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reviews fetch failed", requestId }, { status: 502 });
  }
}
