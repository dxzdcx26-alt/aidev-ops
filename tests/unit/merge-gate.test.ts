/**
 * Merge Gate Tests — Phase 20
 *
 * Tests the 6-gate evaluation engine:
 *   build, tests, typecheck, security, ai_risk, human_approval
 */

import { describe, it, expect } from "bun:test";
import { evaluateMergeGates } from "@/lib/merge-gate";
import type { CheckRun, AIAnalysisResult, SecurityFinding } from "@/types";

const makeCheck = (name: string, status: CheckRun["status"], conclusion: CheckRun["conclusion"]): CheckRun => ({
  id: Math.random(),
  name,
  status,
  conclusion,
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  html_url: "",
  head_sha: "abc",
});

const makeAIResult = (riskLevel: AIAnalysisResult["riskLevel"], blockers: string[] = []): Partial<AIAnalysisResult> => ({
  riskLevel,
  confidence: 0.8,
  blockers,
  security: [],
});

describe("evaluateMergeGates", () => {
  it("returns BLOCKED when all gates fail", () => {
    const result = evaluateMergeGates({
      checks: [],
      aiAnalysis: undefined,
      securityFindings: [],
      humanApproved: false,
      typecheckPassed: false,
    });
    expect(result.overall).toBe("BLOCKED");
    expect(result.blockingReasons.length).toBeGreaterThan(0);
  });

  it("returns READY when all gates pass", () => {
    const result = evaluateMergeGates({
      checks: [
        makeCheck("build", "completed", "success"),
        makeCheck("test", "completed", "success"),
      ],
      aiAnalysis: makeAIResult("LOW") as AIAnalysisResult,
      securityFindings: [],
      humanApproved: true,
      typecheckPassed: true,
    });
    expect(result.overall).toBe("READY");
    expect(result.gates.every((g) => g.status === "PASS")).toBe(true);
  });

  it("fails build gate when build check fails", () => {
    const result = evaluateMergeGates({
      checks: [makeCheck("build", "completed", "failure")],
      aiAnalysis: makeAIResult("LOW") as AIAnalysisResult,
      humanApproved: true,
      typecheckPassed: true,
    });
    const buildGate = result.gates.find((g) => g.id === "build");
    expect(buildGate?.status).toBe("FAIL");
    expect(result.overall).toBe("BLOCKED");
  });

  it("fails security gate when CRITICAL finding present", () => {
    const findings: SecurityFinding[] = [
      { id: "1", file: "f.ts", line: 1, severity: "CRITICAL", evidence: "x", reason: "r", recommendation: "r", category: "secret" },
    ];
    const result = evaluateMergeGates({
      checks: [makeCheck("build", "completed", "success"), makeCheck("test", "completed", "success")],
      aiAnalysis: makeAIResult("LOW") as AIAnalysisResult,
      securityFindings: findings,
      humanApproved: true,
      typecheckPassed: true,
    });
    const secGate = result.gates.find((g) => g.id === "security");
    expect(secGate?.status).toBe("FAIL");
    expect(result.overall).toBe("BLOCKED");
  });

  it("fails AI risk gate when risk is CRITICAL", () => {
    const result = evaluateMergeGates({
      checks: [makeCheck("build", "completed", "success"), makeCheck("test", "completed", "success")],
      aiAnalysis: makeAIResult("CRITICAL", ["hard blocker"]) as AIAnalysisResult,
      humanApproved: true,
      typecheckPassed: true,
    });
    const aiGate = result.gates.find((g) => g.id === "ai_risk");
    expect(aiGate?.status).toBe("FAIL");
  });

  it("always fails human_approval gate when not approved (AI cannot approve)", () => {
    const result = evaluateMergeGates({
      checks: [makeCheck("build", "completed", "success"), makeCheck("test", "completed", "success")],
      aiAnalysis: makeAIResult("LOW") as AIAnalysisResult,
      humanApproved: false,
      typecheckPassed: true,
    });
    const humanGate = result.gates.find((g) => g.id === "human_approval");
    expect(humanGate?.status).toBe("FAIL");
    expect(humanGate?.reason).toContain("human");
  });

  it("returns PENDING when AI analysis not yet run", () => {
    const result = evaluateMergeGates({
      checks: [makeCheck("build", "completed", "success"), makeCheck("test", "completed", "success")],
      aiAnalysis: undefined,
      humanApproved: true,
      typecheckPassed: true,
    });
    const aiGate = result.gates.find((g) => g.id === "ai_risk");
    expect(aiGate?.status).toBe("PENDING");
    expect(result.overall).toBe("PENDING");
  });

  it("all 6 gates are present", () => {
    const result = evaluateMergeGates({});
    expect(result.gates.length).toBe(6);
    expect(result.gates.map((g) => g.id)).toEqual([
      "build", "tests", "typecheck", "security", "ai_risk", "human_approval",
    ]);
  });

  it("all gates are required", () => {
    const result = evaluateMergeGates({});
    expect(result.gates.every((g) => g.required)).toBe(true);
  });
});
