import { NextResponse } from "next/server";
import { getHealth } from "@/lib/verification";
import { getPublicEnv } from "@/lib/env";

export async function GET() {
  const health = await getHealth();
  // Per spec §91: never expose secrets
  return NextResponse.json({
    ...health,
    environment: getPublicEnv(),
  });
}
