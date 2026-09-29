/**
 * AI Schema Validation Tests — Phase 20
 *
 * Tests the Zod schema validation for AI output.
 * Uses inline schema definition to avoid importing the server-only provider.
 */

import { describe, it, expect } from "bun:test";
import { z } from "zod";

// Re-declare the schema here (mirrors src/lib/ai/provider.ts) to test it in isolation
// without triggering the server-only import.
const AIResultSchema = z.object({
  summary: z.string().min(10),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  confidence: z.number().min(0).max(1),
  changedAreas: z.array(z.string()),
  files: z.array(
    z.object({
      filename: z.string(),
      category: z.enum(["frontend", "backend", "api", "auth", "database", "payment", "security", "configuration", "infrastructure", "tests", "dependencies", "docs", "unknown"]),
      risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      note: z.string(),
    }),
  ),
  decisions: z.array(z.object({
    decision: z.string(), reason: z.string(), risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    files: z.array(z.string()), impact: z.array(z.string()), recommendation: z.string().optional(),
  })),
  security: z.array(z.object({
    file: z.string(), line: z.number(), severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
    evidence: z.string(), reason: z.string(), recommendation: z.string(), category: z.string(),
  })),
  architecture: z.object({
    nodes: z.array(z.object({
      id: z.string(), label: z.string(),
      type: z.enum(["frontend", "backend", "api", "database", "service", "auth", "infra", "external"]),
      file: z.string().optional(), line: z.number().optional(),
      function: z.string().optional(), module: z.string().optional(),
    })),
    edges: z.array(z.object({
      id: z.string(), from: z.string(), to: z.string(),
      label: z.string().optional(), type: z.enum(["call", "data", "depends", "extends", "implements"]),
    })),
  }),
  dataFlow: z.array(z.object({ step: z.string(), from: z.string(), to: z.string(), description: z.string() })),
  apiFlow: z.array(z.object({
    method: z.string(), path: z.string(), auth: z.boolean(),
    change: z.enum(["added", "removed", "changed", "unchanged"]),
  })),
  apiImpact: z.object({ breaking: z.boolean(), endpoints: z.array(z.string()), summary: z.string() }),
  dependencies: z.array(z.object({
    name: z.string(), version: z.string(), change: z.enum(["added", "removed", "changed"]),
  })),
  dependencyImpact: z.object({
    added: z.array(z.string()), removed: z.array(z.string()),
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), notes: z.string(),
  }),
  recommendations: z.array(z.string()),
  blockers: z.array(z.string()),
  tests: z.array(z.object({ area: z.string(), recommended: z.string(), reason: z.string() })),
  deploymentRisk: z.object({
    level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    reasons: z.array(z.string()), canaryRecommended: z.boolean(),
  }),
});

function validateAIResult(raw: unknown): { ok: true; value: z.infer<typeof AIResultSchema> } | { ok: false; errors: string[] } {
  const parsed = AIResultSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

const validResult = {
  summary: "This PR adds a new login endpoint with proper authentication and rate limiting.",
  riskLevel: "MEDIUM",
  confidence: 0.85,
  changedAreas: ["auth", "api", "security"],
  files: [
    { filename: "src/app/api/auth/login/route.ts", category: "auth", risk: "MEDIUM", note: "Adds JWT-based login" },
  ],
  decisions: [
    { decision: "REQUEST_CHANGES", reason: "Add rate limiting", risk: "MEDIUM", files: ["login/route.ts"], impact: ["auth"], recommendation: "Use upstash/ratelimit" },
  ],
  security: [
    { file: "login/route.ts", line: 12, severity: "HIGH", evidence: "password compare", reason: "Timing attack risk", recommendation: "Use bcrypt.compare", category: "auth" },
  ],
  architecture: {
    nodes: [
      { id: "n1", label: "Login API", type: "api", file: "login/route.ts" },
    ],
    edges: [],
  },
  dataFlow: [
    { step: "1", from: "Client", to: "Login API", description: "POST /api/auth/login" },
  ],
  apiFlow: [
    { method: "POST", path: "/api/auth/login", auth: false, change: "added" },
  ],
  apiImpact: { breaking: false, endpoints: ["/api/auth/login"], summary: "New endpoint added" },
  dependencies: [],
  dependencyImpact: { added: [], removed: [], risk: "LOW", notes: "No dep changes" },
  recommendations: ["Add rate limiting", "Add input validation"],
  blockers: [],
  tests: [
    { area: "auth", recommended: "Login integration tests", reason: "Auth code changed" },
  ],
  deploymentRisk: { level: "MEDIUM", reasons: ["New auth endpoint"], canaryRecommended: true },
};

describe("AIResultSchema validation", () => {
  it("accepts valid result", () => {
    const result = validateAIResult(validResult);
    expect(result.ok).toBe(true);
  });

  it("rejects result with missing summary", () => {
    const invalid = { ...validResult, summary: "" };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.some((e) => e.includes("summary"))).toBe(true);
  });

  it("rejects result with invalid riskLevel", () => {
    const invalid = { ...validResult, riskLevel: "EXTREME" };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with confidence > 1", () => {
    const invalid = { ...validResult, confidence: 1.5 };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with confidence < 0", () => {
    const invalid = { ...validResult, confidence: -0.1 };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with missing apiImpact", () => {
    const invalid = { ...validResult };
    delete (invalid as Record<string, unknown>).apiImpact;
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with missing blockers", () => {
    const invalid = { ...validResult };
    delete (invalid as Record<string, unknown>).blockers;
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with missing tests", () => {
    const invalid = { ...validResult };
    delete (invalid as Record<string, unknown>).tests;
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with missing deploymentRisk", () => {
    const invalid = { ...validResult };
    delete (invalid as Record<string, unknown>).deploymentRisk;
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects result with invalid file category", () => {
    const invalid = {
      ...validResult,
      files: [{ ...validResult.files[0], category: "invalid_category" }],
    };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
  });

  it("rejects non-object input", () => {
    const result = validateAIResult("not an object");
    expect(result.ok).toBe(false);
  });

  it("rejects null input", () => {
    const result = validateAIResult(null);
    expect(result.ok).toBe(false);
  });

  it("accepts payment category (Phase 3 extension)", () => {
    const valid = {
      ...validResult,
      files: [{ ...validResult.files[0], category: "payment" }],
    };
    const result = validateAIResult(valid);
    expect(result.ok).toBe(true);
  });

  it("accepts security category (Phase 3 extension)", () => {
    const valid = {
      ...validResult,
      files: [{ ...validResult.files[0], category: "security" }],
    };
    const result = validateAIResult(valid);
    expect(result.ok).toBe(true);
  });
});

describe("AIResultSchema directly", () => {
  it("parses valid input", () => {
    const parsed = AIResultSchema.safeParse(validResult);
    expect(parsed.success).toBe(true);
  });

  it("returns multiple errors for multiple issues", () => {
    const invalid = { ...validResult, summary: "", riskLevel: "BAD", confidence: 2 };
    const result = validateAIResult(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});
