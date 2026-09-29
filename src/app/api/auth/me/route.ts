import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";

export async function GET() {
  try {
    await ensureDatabase();
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
