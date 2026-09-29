/**
 * Analyzer Tests — Phase 20
 *
 * Tests the diff parser, file classifier, risk engine, and baseline analyzer.
 */

import { describe, it, expect } from "bun:test";
import { analyzeDiff, classifyFile, computeRisk, scanBaseline, baselineAnalyze } from "@/lib/analyzer";
import { MOCK_DIFF_FILES } from "@/lib/github/mock";
import type { DiffFile } from "@/types";

describe("classifyFile", () => {
  it("classifies auth files", () => {
    expect(classifyFile("src/auth/login.ts")).toBe("auth");
    expect(classifyFile("src/middleware.ts")).toBe("auth");
    expect(classifyFile("src/api/auth/session.ts")).toBe("auth");
  });

  it("classifies API files", () => {
    expect(classifyFile("src/app/api/users/route.ts")).toBe("api");
    expect(classifyFile("src/controllers/userController.ts")).toBe("api");
  });

  it("classifies database files", () => {
    expect(classifyFile("prisma/schema.prisma")).toBe("database");
    expect(classifyFile("migrations/0001_init.sql")).toBe("database");
  });

  it("classifies frontend files", () => {
    expect(classifyFile("src/components/Button.tsx")).toBe("frontend");
    expect(classifyFile("src/app/page.tsx")).toBe("frontend");
  });

  it("classifies test files", () => {
    expect(classifyFile("src/__tests__/user.test.ts")).toBe("tests");
    expect(classifyFile("tests/e2e/spec.ts")).toBe("tests");
  });

  it("classifies dependency files", () => {
    expect(classifyFile("package.json")).toBe("configuration"); // matches .json first
    expect(classifyFile("requirements.txt")).toBe("dependencies");
    expect(classifyFile("go.mod")).toBe("dependencies");
  });

  it("classifies docs files", () => {
    expect(classifyFile("README.md")).toBe("docs");
    expect(classifyFile("CHANGELOG.md")).toBe("docs");
  });

  it("classifies payment files (Phase 3 extension)", () => {
    expect(classifyFile("src/stripe/webhook.ts")).toBe("payment");
    expect(classifyFile("src/payments/checkout.ts")).toBe("payment");
  });

  it("classifies security files (Phase 3 extension)", () => {
    expect(classifyFile("src/security/redact.ts")).toBe("security");
    expect(classifyFile("src/lib/crypto.ts")).toBe("security");
  });

  it("returns unknown for unrecognized files", () => {
    expect(classifyFile("random-file.xyz")).toBe("unknown");
  });
});

describe("scanBaseline", () => {
  it("detects auth keywords", () => {
    const hits = scanBaseline("const auth = require('auth')");
    expect(hits).toContain("auth");
  });

  it("detects JWT keywords", () => {
    const hits = scanBaseline("jwt.sign(payload, secret)");
    expect(hits).toContain("jwt");
  });

  it("detects SQL keywords", () => {
    const hits = scanBaseline("SELECT * FROM users");
    expect(hits).toContain("sql");
  });

  it("detects multiple keywords", () => {
    const hits = scanBaseline("fetch('/api/login') with password");
    expect(hits).toContain("api");
    expect(hits).toContain("fetch");
    expect(hits).toContain("password");
  });
});

describe("computeRisk", () => {
  it("returns CRITICAL for hardcoded password", () => {
    const file: DiffFile = {
      sha: "1", filename: "config.ts", status: "modified", additions: 1, deletions: 0, changes: 1,
      patch: '+const password = "supersecret123"',
      raw_url: "", blob_url: "",
    };
    expect(computeRisk(file, scanBaseline(file.patch ?? ""))).toBe("CRITICAL");
  });

  it("returns CRITICAL for eval()", () => {
    const file: DiffFile = {
      sha: "1", filename: "eval.ts", status: "modified", additions: 1, deletions: 0, changes: 1,
      patch: "+const result = eval(userInput)",
      raw_url: "", blob_url: "",
    };
    expect(computeRisk(file, scanBaseline(file.patch ?? ""))).toBe("CRITICAL");
  });

  it("returns HIGH for auth files", () => {
    const file: DiffFile = {
      sha: "1", filename: "src/middleware.ts", status: "modified", additions: 1, deletions: 0, changes: 1,
      patch: "+export function middleware() {}",
      raw_url: "", blob_url: "",
    };
    expect(computeRisk(file, scanBaseline(file.patch ?? ""))).toBe("HIGH");
  });

  it("returns LOW for simple files", () => {
    const file: DiffFile = {
      sha: "1", filename: "README.md", status: "modified", additions: 1, deletions: 0, changes: 1,
      patch: "+# Hello World",
      raw_url: "", blob_url: "",
    };
    expect(computeRisk(file, scanBaseline(file.patch ?? ""))).toBe("LOW");
  });
});

describe("analyzeDiff", () => {
  it("analyzes mock diff files", () => {
    const summary = analyzeDiff(MOCK_DIFF_FILES);
    expect(summary.totalFiles).toBe(MOCK_DIFF_FILES.length);
    expect(summary.additions).toBeGreaterThan(0);
    expect(summary.deletions).toBeGreaterThan(0);
  });

  it("classifies files into categories", () => {
    const summary = analyzeDiff(MOCK_DIFF_FILES);
    expect(summary.byCategory.api).toBeGreaterThan(0);
    expect(summary.byCategory.auth).toBeGreaterThan(0);
    expect(summary.byCategory.security).toBeGreaterThan(0);
  });

  it("computes risk distribution", () => {
    const summary = analyzeDiff(MOCK_DIFF_FILES);
    const totalRisk = summary.byRisk.LOW + summary.byRisk.MEDIUM + summary.byRisk.HIGH + summary.byRisk.CRITICAL;
    expect(totalRisk).toBe(MOCK_DIFF_FILES.length);
  });

  it("handles empty diff", () => {
    const summary = analyzeDiff([]);
    expect(summary.totalFiles).toBe(0);
    expect(summary.additions).toBe(0);
  });
});

describe("baselineAnalyze", () => {
  it("produces valid AIAnalysisResult structure", () => {
    const result = baselineAnalyze(MOCK_DIFF_FILES, { prNumber: 42, repository: "test/repo" });
    expect(result.id).toBeDefined();
    expect(result.summary).toContain("Baseline analysis");
    expect(result.riskLevel).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.fallback).toBe(true);
    expect(result.files.length).toBe(MOCK_DIFF_FILES.length);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.tests)).toBe(true);
    expect(result.deploymentRisk).toBeDefined();
    expect(result.apiImpact).toBeDefined();
    expect(result.dependencyImpact).toBeDefined();
  });

  it("detects security findings when secrets present", () => {
    const filesWithSecret: DiffFile[] = [
      {
        sha: "1", filename: "config.ts", status: "modified", additions: 1, deletions: 0, changes: 1,
        patch: "+const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD'",
        raw_url: "", blob_url: "",
      },
    ];
    const result = baselineAnalyze(filesWithSecret, {});
    expect(result.security.length).toBeGreaterThan(0);
    expect(result.security.some((f) => f.category === "secret")).toBe(true);
  });

  it("generates architecture nodes", () => {
    const result = baselineAnalyze(MOCK_DIFF_FILES, {});
    expect(result.architecture.nodes.length).toBeGreaterThan(0);
  });

  it("generates test recommendations", () => {
    const result = baselineAnalyze(MOCK_DIFF_FILES, {});
    expect(result.tests.length).toBeGreaterThan(0);
  });
});
