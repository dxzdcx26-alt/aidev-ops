/**
 * Authentication — Phase 1
 *
 * Server-side session-based authentication.
 * - Username/password login (password hashed with scrypt)
 * - Session token in HttpOnly, Secure, SameSite=Strict cookie
 * - Sessions stored in DB with expiration
 * - No client-provided identity is trusted
 *
 * Per spec Phase 1:
 *   - ทุก privileged API ต้องรู้ identity ของ caller จาก server-side session/auth
 *   - ห้ามรับ user identity จาก request body เพื่อใช้เป็น authority
 *   - unauthorized request ต้องได้ 401
 *   - authenticated แต่ไม่มี permission ต้องได้ 403
 */

import "server-only";
import { db } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { cookies } from "next/headers";
import type { Role, Permission } from "@/types";
import { ROLE_PERMISSIONS, checkPermission, DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { PermissionMatrix } from "@/types";

const SESSION_COOKIE = "adcc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const TOKEN_BYTES = 32;

// ============ Password hashing (scrypt) ============

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.startsWith("scrypt$")) return false;
  const [, salt, expectedHash] = stored.split("$");
  if (!salt || !expectedHash) return false;
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

// ============ Session management ============

/**
 * The session cookie is a signed payload: <userId>.<role>.<expiresAt>.<signature>
 * The middleware verifies the signature (stateless, fast). The API route handler
 * does a full DB session lookup for revocation support.
 */

/**
 * Get the session signing secret.
 * In production, SESSION_SECRET must be set — otherwise this is a security vulnerability.
 * The fallback to DATABASE_URL is for development convenience only.
 */
function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return process.env.DATABASE_URL || "fallback-dev-secret-not-secure";
}

/**
 * Validate that SESSION_SECRET is properly configured.
 * Returns { valid, reason } — used by production-readiness checks.
 */
export function validateSessionSecret(): { valid: boolean; reason: string } {
  const secret = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProduction) {
      return {
        valid: false,
        reason: "SESSION_SECRET is not set — mandatory for production. Generate with: openssl rand -hex 32",
      };
    }
    return {
      valid: false,
      reason: "SESSION_SECRET not set — using DATABASE_URL fallback (not secure for production)",
    };
  }

  // Check minimum length (256 bits = 32 bytes = 64 hex chars)
  if (secret.length < 32) {
    return {
      valid: false,
      reason: `SESSION_SECRET is too short (${secret.length} chars) — minimum 32 characters required for cryptographic security`,
    };
  }

  // Check entropy — reject obvious weak secrets
  const weakSecrets = ["secret", "password", "changeme", "test", "default", "fallback"];
  if (weakSecrets.includes(secret.toLowerCase())) {
    return {
      valid: false,
      reason: "SESSION_SECRET is a known weak value — use a cryptographically random secret",
    };
  }

  return { valid: true, reason: "SESSION_SECRET configured" };
}

function signSession(userId: string, role: string, expiresAt: number): string {
  const payload = `${userId}.${role}.${expiresAt}`;
  const sig = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export type AuthenticatedUser = {
  id: string;
  username: string;
  role: Role;
};

export async function createSession(userId: string, role: Role, ip?: string, userAgent?: string): Promise<{ token: string; expiresAt: Date; cookieValue: string }> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const expiresAtMs = expiresAt.getTime();
  // The cookie value is the signed payload (verified by middleware)
  const cookieValue = signSession(userId, role, expiresAtMs);
  // The DB token is the random token (for revocation lookup)
  const dbToken = generateSessionToken();
  await db.session.create({
    data: {
      userId,
      token: dbToken,
      expiresAt,
      ip,
      userAgent,
    },
  });
  // Store the mapping: cookieValue -> dbToken (in DB, the session row has both)
  // For simplicity, we store the cookieValue as the session token too, so
  // requireAuth() can look it up. But the cookie is signed, so we verify
  // the signature in requireAuth() and then look up by userId + expiresAt.
  // Actually, let's store the cookieValue as the token for simpler lookup.
  await db.session.update({
    where: { token: dbToken },
    data: { token: cookieValue },
  });
  return { token: cookieValue, expiresAt, cookieValue };
}

export async function getSession(cookieValue: string): Promise<AuthenticatedUser | null> {
  if (!cookieValue) return null;
  // First verify the signature (same as middleware)
  const parts = cookieValue.split(".");
  if (parts.length !== 4) return null;
  const [userId, role, expiresAtStr, sig] = parts;
  if (!userId || !role || !expiresAtStr || !sig) return null;

  const payload = `${userId}.${role}.${expiresAtStr}`;
  const expectedSig = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  // Full DB lookup for revocation support
  const session = await db.session.findUnique({
    where: { token: cookieValue },
    include: { user: true },
  });
  if (!session) return null; // session was revoked
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role as Role,
  };
}

export async function destroySession(cookieValue: string): Promise<void> {
  await db.session.deleteMany({ where: { token: cookieValue } }).catch(() => {});
}

// ============ Cookie helpers ============

export function setSessionCookie(token: string, expiresAt: Date): string {
  const isProduction = process.env.NODE_ENV === "production";
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
    "HttpOnly",
    `SameSite=${isProduction ? "Strict" : "Lax"}`,
    isProduction ? "Secure" : "",
    `Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`,
  ].filter(Boolean);
  return attrs.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict`;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// ============ Request-level auth ============

/**
 * Get the authenticated user from the current request.
 * Reads the session cookie and does a full DB lookup.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSession(token);
}

/**
 * Require authentication. Throws AuthError if not authenticated.
 * Use in API route handlers.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

/**
 * Require authentication + permission. Throws AuthError if not authenticated or not authorized.
 * Per Phase 2: server-side enforcement of permission matrix.
 */
export async function requirePermission(
  permission: Permission,
  matrix: PermissionMatrix = DEFAULT_PERMISSIONS,
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  const decision = checkPermission(matrix, permission, false, user.role);
  if (!decision.allowed) {
    throw new AuthError(decision.reason, 403);
  }
  return user;
}

/**
 * Require a specific action permission with an explicit server-side approval state.
 * This is used by privileged mutation routes whose policy is "approval required".
 */
export async function requireActionPermission(
  permission: Permission,
  hasApproval: boolean,
  matrix: PermissionMatrix = DEFAULT_PERMISSIONS,
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  const decision = checkPermission(matrix, permission, hasApproval, user.role);
  if (!decision.allowed) {
    throw new AuthError(decision.reason, 403);
  }
  return user;
}

// ============ Error class ============

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

// ============ User management ============

export async function createUser(username: string, password: string, role: Role = "operator"): Promise<AuthenticatedUser> {
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) throw new Error(`User "${username}" already exists`);
  const user = await db.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role,
    },
  });
  return { id: user.id, username: user.username, role: user.role as Role };
}

export async function validateUser(username: string, password: string): Promise<AuthenticatedUser | null> {
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, username: user.username, role: user.role as Role };
}

/**
 * Validate the production bootstrap admin password.
 * Production must never silently create an admin with a generated password.
 */
export function validateAdminPasswordConfig(): { valid: boolean; reason: string } {
  const password = process.env.CONTROL_CENTER_ADMIN_PASSWORD;
  const isProduction = process.env.NODE_ENV === "production";

  if (!password) {
    return {
      valid: false,
      reason: isProduction
        ? "CONTROL_CENTER_ADMIN_PASSWORD is not set — required for production bootstrap"
        : "CONTROL_CENTER_ADMIN_PASSWORD not set — development bootstrap may generate a one-time password",
    };
  }

  if (password.length < 16) {
    return {
      valid: false,
      reason: "CONTROL_CENTER_ADMIN_PASSWORD must be at least 16 characters",
    };
  }

  const weak = new Set(["admin", "admin123", "password", "changeme", "change-me", "test", "default"]);
  if (weak.has(password.toLowerCase())) {
    return { valid: false, reason: "CONTROL_CENTER_ADMIN_PASSWORD is a known weak value" };
  }

  return { valid: true, reason: "Production admin bootstrap password configured" };
}

/**
 * Seed a default admin user if no users exist.
 * The password is read from CONTROL_CENTER_ADMIN_PASSWORD env var.
 * If not set, a random password is generated and printed once to stderr.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const count = await db.user.count();
  if (count > 0) return;

  const isProduction = process.env.NODE_ENV === "production";
  const configuredPassword = process.env.CONTROL_CENTER_ADMIN_PASSWORD;

  // Production must fail closed: never create a known/predictable bootstrap path.
  if (isProduction) {
    const validation = validateAdminPasswordConfig();
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
  }

  const password = configuredPassword || randomBytes(24).toString("hex");
  await createUser("admin", password, "admin");

  // Development-only bootstrap hint. Never print credentials in production logs.
  if (!configuredPassword && !isProduction) {
    console.error("[dev] Default admin created. Set CONTROL_CENTER_ADMIN_PASSWORD before production use.");
    console.error("[dev] Generated password is intentionally printed only in development logs.");
    console.error(`  Username: admin`);
    console.error(`  Password: ${password}`);
  }
}

// Re-export for convenience
export { ROLE_PERMISSIONS };
