import { NextResponse } from "next/server";
import { listDomains } from "@/lib/vercel";
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
    const { domains, mock } = await listDomains();
    return NextResponse.json({ domains, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Domains fetch failed", requestId }, { status: 502 });
  }
}
