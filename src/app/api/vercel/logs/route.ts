import { NextResponse } from "next/server";
import { getDeploymentLogs } from "@/lib/vercel";
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
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required", requestId }, { status: 400 });
  try {
    const { logs, mock } = await getDeploymentLogs(id);
    return NextResponse.json({ logs, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Logs fetch failed", requestId }, { status: 502 });
  }
}
