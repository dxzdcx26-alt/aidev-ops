/**
 * API tests — auth + protected routes
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";

class AuthError extends Error {
  statusCode: number;
  constructor(message = "Unauthorized", statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

mock.module("server-only", () => ({}));

mock.module("@/lib/db", () => ({
  db: {
    $queryRaw: async () => [{ ok: 1 }],
    $executeRawUnsafe: async () => 0,
    user: { count: async () => 1, findUnique: async () => null },
  },
  ensureDatabase: async () => {},
}));

mock.module("@/lib/auth", () => ({
  AuthError,
  requireAuth: async () => {
    throw new AuthError("Unauthorized", 401);
  },
  getAuthenticatedUser: async () => null,
  ensureDefaultAdmin: async () => {},
  validateUser: async (_u: string, _p: string) => null,
  createSession: async () => ({ token: "tok", expiresAt: new Date(Date.now() + 3600_000) }),
  setSessionCookie: () => "adcc_session=tok; Path=/; HttpOnly; SameSite=Strict",
  destroySession: async () => {},
  clearSessionCookie: () => "adcc_session=; Path=/; Max-Age=0",
}));

mock.module("@/lib/audit", () => ({
  audit: () => {},
  listAudit: async () => ({ events: [], total: 0 }),
}));

mock.module("@/lib/approvals", () => ({
  ApprovalError: class extends Error {},
  listApprovals: async () => [],
  createApproval: async () => ({}),
  approveApproval: async () => ({}),
  rejectApproval: async () => ({}),
}));

let loginPOST: (req: Request) => Promise<Response>;
let meGET: () => Promise<Response>;
let logoutPOST: () => Promise<Response>;
let approvalsGET: () => Promise<Response>;
let approvalsPOST: (req: Request) => Promise<Response>;
let auditGET: (req: Request) => Promise<Response>;
let envCheckGET: () => Promise<Response>;

beforeAll(async () => {
  ({ POST: loginPOST } = await import("@/app/api/auth/login/route"));
  ({ GET: meGET } = await import("@/app/api/auth/me/route"));
  ({ POST: logoutPOST } = await import("@/app/api/auth/logout/route"));
  ({ GET: approvalsGET, POST: approvalsPOST } = await import("@/app/api/approvals/route"));
  ({ GET: auditGET } = await import("@/app/api/audit/route"));
  ({ GET: envCheckGET } = await import("@/app/api/env-check/route"));
});

describe("POST /api/auth/login", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await loginPOST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
    expect(body.requestId).toBeTruthy();
  });

  it("returns 400 when username or password missing", async () => {
    const res = await loginPOST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Username and password");
  });

  it("returns 401 for invalid credentials", async () => {
    const res = await loginPOST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong-password" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid credentials");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when there is no session", async () => {
    const res = await meGET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.user).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("returns ok and clears the session cookie", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie.toLowerCase()).toContain("adcc_session");
  });
});

describe("protected APIs without session", () => {
  it("GET /api/approvals → 401", async () => {
    const res = await approvalsGET();
    expect(res.status).toBe(401);
  });

  it("POST /api/approvals → 401 and ignores body identity", async () => {
    const res = await approvalsPOST(
      new Request("http://localhost/api/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: "admin", action: "deploy", target: "x", reason: "no" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/audit → 401", async () => {
    const res = await auditGET(new Request("http://localhost/api/audit"));
    expect(res.status).toBe(401);
  });

  it("GET /api/env-check → 401 and does not leak secrets", async () => {
    const res = await envCheckGET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/sk-|ghp_|postgres:\/\//i);
  });
});
