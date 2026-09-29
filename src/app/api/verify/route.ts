import { NextResponse } from "next/server";
import { verifyDeployment } from "@/lib/verification";
import { requireAuth, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  const requestId = uuid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }

  const body = await req.json().catch(() => ({}));
  const { url, deploymentId } = body as { url: string; deploymentId?: string };
  if (!url) return NextResponse.json({ error: "url required", requestId }, { status: 400 });
  try {
    const verification = await verifyDeployment(url);
    if (deploymentId) verification.deploymentId = deploymentId;
    audit({
      actorId: user.id,
      actor: user.username,
      action: "VERIFY",
      target: deploymentId ?? url,
      status: verification.smokeTestPassed ? "success" : "failure",
      reason: `HTTP ${verification.httpStatus}, ${verification.consoleErrors.length} console errors`,
      metadata: { httpStatus: verification.httpStatus, smokePassed: verification.smokeTestPassed },
      ip,
      requestId,
    });
    return NextResponse.json({ verification, requestId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed", requestId }, { status: 502 });
  }
}
