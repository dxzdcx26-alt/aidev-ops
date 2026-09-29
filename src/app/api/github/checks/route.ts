import { NextResponse } from "next/server";
import { listChecks } from "@/lib/github";
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
  const ref = url.searchParams.get("ref");
  if (!owner || !repo || !ref) return NextResponse.json({ error: "owner, repo, ref required", requestId }, { status: 400 });
  try {
    const { checks, mock } = await listChecks(owner, repo, ref);
    return NextResponse.json({ checks, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checks fetch failed", requestId }, { status: 502 });
  }
}
