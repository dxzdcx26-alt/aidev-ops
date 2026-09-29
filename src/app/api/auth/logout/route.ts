import { NextResponse } from "next/server";
import { getAuthenticatedUser, destroySession, clearSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { v4 as uuid } from "uuid";

export async function POST() {
  const requestId = uuid();
  const user = await getAuthenticatedUser();
  if (user) {
    // Best-effort session destruction
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("adcc_session")?.value;
    if (token) await destroySession(token);
    audit({
      actorId: user.id,
      actor: user.username,
      action: "LOGIN",
      status: "success",
      reason: "Logout",
      requestId,
    });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
