/**
 * Next.js Middleware — Phase 1 (Auth) + Phase 10 (Rate Limiting)
 *
 * Enforces authentication on all /api/* routes (except public ones).
 * Enforces rate limiting on sensitive endpoints.
 *
 * Runs on Edge Runtime — uses Web Crypto API (not Node.js crypto).
 *
 * The session cookie is a signed payload verified via HMAC-SHA256
 * using Web Crypto. Full DB session lookup happens in API route handlers.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
]);

// Rate limit config per route prefix
const RATE_LIMIT_CONFIG: { prefix: string; perMinute: number }[] = [
  { prefix: "/api/auth/login", perMinute: 5 },
  { prefix: "/api/ai/analyze", perMinute: 10 },
  { prefix: "/api/vercel/deploy", perMinute: 3 },
  { prefix: "/api/vercel/rollback", perMinute: 3 },
  { prefix: "/api/merge-gate", perMinute: 3 },
  { prefix: "/api/approvals", perMinute: 10 },
  { prefix: "/api/github", perMinute: 30 },
  { prefix: "/api/vercel", perMinute: 20 },
];

function getRateLimitPerMinute(path: string): number | undefined {
  for (const cfg of RATE_LIMIT_CONFIG) {
    if (path.startsWith(cfg.prefix)) return cfg.perMinute;
  }
  return undefined;
}

// ============ In-memory rate limit (Edge-compatible) ============
type Bucket = { tokens: number; lastRefill: number };
const rateLimitBuckets = new Map<string, Bucket>();

function checkRateLimit(identifier: string, route: string, perMinute: number): { allowed: boolean; retryAfterMs: number } {
  const key = `${identifier}:${route}`;
  const now = Date.now();
  const refillIntervalMs = 60_000 / perMinute;

  let bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    if (rateLimitBuckets.size > 5000) {
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey) rateLimitBuckets.delete(oldestKey);
    }
    bucket = { tokens: perMinute, lastRefill: now };
    rateLimitBuckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / refillIntervalMs);
  if (refill > 0) {
    bucket.tokens = Math.min(perMinute, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, retryAfterMs: Math.ceil(refillIntervalMs) };
  }
  bucket.tokens -= 1;
  return { allowed: true, retryAfterMs: 0 };
}

// ============ Session cookie validation (Edge-compatible) ============
// The session cookie format: <userId>.<role>.<expiresAt>.<signature>
// Signature is HMAC-SHA256 of the payload using the signing secret.

// Cache the imported key to avoid re-importing on every request
let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  const signingSecret = secret || process.env.DATABASE_URL || "fallback-dev-secret-not-secure";
  if (cachedKey && cachedSecret === signingSecret) return cachedKey;
  const enc = new TextEncoder();
  cachedKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedSecret = signingSecret;
  return cachedKey;
}

async function verifySession(token: string): Promise<{ userId: string; role: string; expiresAt: number } | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, role, expiresAtStr, sigHex] = parts;
  if (!userId || !role || !expiresAtStr || !sigHex) return null;

  const payload = `${userId}.${role}.${expiresAtStr}`;
  const enc = new TextEncoder();

  // Convert hex signature to Uint8Array
  const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);
  if (sigBytes.length === 0) return null;

  try {
    const key = await getSigningKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(payload),
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  return { userId, role, expiresAt };
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Only protect /api routes
  if (!path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Rate limiting
  const perMinute = getRateLimitPerMinute(path);
  if (perMinute) {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const sessionCookie = req.cookies.get("adcc_session")?.value;
    const identifier = sessionCookie ? `s:${sessionCookie.slice(0, 16)}` : `ip:${ip}`;
    const rl = checkRateLimit(identifier, path, perMinute);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        },
      );
    }
  }

  // Public routes — no auth required
  if (PUBLIC_ROUTES.has(path)) {
    return NextResponse.next();
  }

  // All other /api routes require authentication
  const sessionCookie = req.cookies.get("adcc_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Authentication required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const session = await verifySession(sessionCookie);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session", code: "AUTH_INVALID" }, { status: 401 });
  }

  // Add user info to request headers for downstream handlers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-auth-user-id", session.userId);
  requestHeaders.set("x-auth-user-role", session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
