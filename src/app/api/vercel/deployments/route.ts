import { NextResponse } from "next/server";
import { listDeployments, getDeployment } from "@/lib/vercel";
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
  try {
    if (id) {
      const { deployment, mock } = await getDeployment(id);
      return NextResponse.json({ deployment, mock, requestId });
    }
    const { deployments, mock } = await listDeployments();
    return NextResponse.json({ deployments, mock, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Vercel API failed", requestId }, { status: 502 });
  }
}
