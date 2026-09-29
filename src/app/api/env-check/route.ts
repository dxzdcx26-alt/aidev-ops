import { NextResponse } from "next/server";
import { checkAllEnv, getPublicEnv } from "@/lib/env";
import { requireAuth, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { v4 as uuid } from "uuid";

export async function GET() {
  const requestId = uuid();
  try {
    await requireAuth();
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message, requestId }, { status: e.statusCode });
  }
  const checks = checkAllEnv();
  const publicEnv = getPublicEnv();

  audit({
    actor: "system",
    action: "VIEW",
    target: "env-check",
    status: "success",
    metadata: {
      github: publicEnv.github.configured ? "CONFIGURED" : "MISSING",
      ai: publicEnv.ai.configured ? "CONFIGURED" : "MISSING",
      vercel: publicEnv.vercel.configured ? "CONFIGURED" : "MISSING",
    },
    requestId,
  });

  // Per spec §28: never expose secret values
  return NextResponse.json({
    variables: checks,
    summary: {
      github: publicEnv.github.configured ? "CONFIGURED" : "MISSING",
      ai: publicEnv.ai.configured ? "CONFIGURED" : "MISSING",
      vercel: publicEnv.vercel.configured ? "CONFIGURED" : "MISSING",
      appUrl: publicEnv.app.url,
      environment: publicEnv.app.environment,
    },
    requestId,
  });
}
