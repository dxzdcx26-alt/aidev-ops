import { NextResponse } from "next/server";
import { listAudit } from "@/lib/audit";
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
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const result = await listAudit(
    Number.isFinite(limit) ? Math.min(limit, 500) : 100,
    Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  );
  return NextResponse.json({ ...result, requestId });
}
