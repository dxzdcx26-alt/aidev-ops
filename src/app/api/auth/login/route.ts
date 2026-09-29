import { NextResponse } from "next/server";
import { validateUser, createSession, setSessionCookie, ensureDefaultAdmin } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";
import { audit } from "@/lib/audit";
import { v4 as uuid } from "uuid";

export async function POST(req: Request) {
  const requestId = uuid();
  try {
    await ensureDatabase();
    await ensureDefaultAdmin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database unavailable", requestId },
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", requestId }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    audit({
      actor: username ?? "unknown",
      action: "LOGIN",
      status: "failure",
      reason: "Missing username or password",
      ip,
      requestId,
    });
    return NextResponse.json({ error: "Username and password required", requestId }, { status: 400 });
  }

  const user = await validateUser(username, password);
  if (!user) {
    audit({
      actor: username,
      action: "LOGIN",
      status: "failure",
      reason: "Invalid credentials",
      ip,
      requestId,
    });
    return NextResponse.json({ error: "Invalid credentials", requestId }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id, user.role, ip, userAgent);

  audit({
    actorId: user.id,
    actor: user.username,
    action: "LOGIN",
    status: "success",
    ip,
    requestId,
  });

  const res = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  res.headers.set("Set-Cookie", setSessionCookie(token, expiresAt));
  return res;
}
