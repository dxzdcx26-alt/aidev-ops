/**
 * API tests — /api/health
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";

mock.module("server-only", () => ({}));

mock.module("@/lib/db", () => ({
  db: {
    $queryRaw: async () => [{ "?column?": 1 }],
  },
  ensureDatabase: async () => {},
}));

mock.module("@/lib/env", () => ({
  getEnv: () => ({
    github: { token: null, configured: false },
    vercel: { token: null, teamId: null, projectId: null, configured: false },
    ai: { baseUrl: "https://api.z.ai/api/paas/v4", apiKey: null, model: "glm-4.6", configured: false },
    app: { url: "http://localhost:3000", environment: "development" },
    maxAutoRetry: 3,
    nodeEnv: "test",
    apiRateLimitPerMinute: 60,
  }),
  getPublicEnv: () => ({
    github: { configured: false },
    vercel: { configured: false },
    ai: { configured: false, model: "glm-4.6" },
    app: { url: "http://localhost:3000", environment: "development" },
    maxAutoRetry: 3,
    nodeEnv: "test",
  }),
}));

let healthGET: () => Promise<Response>;

beforeAll(async () => {
  ({ GET: healthGET } = await import("@/app/api/health/route"));
});

describe("GET /api/health", () => {
  it("returns JSON health payload", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.environment).toBeTruthy();
    expect(body.environment.github.configured).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/AI_API_KEY|GITHUB_TOKEN|passwordHash/i);
  });
});
