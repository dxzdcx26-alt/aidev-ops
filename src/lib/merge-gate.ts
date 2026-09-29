/**
 * Merge Gate Engine — Phase 8
 *
 * 6 gates:
 *   1. build         — CI build status
 *   2. tests         — CI test status
 *   3. typecheck     — TypeScript compilation
 *   4. security      — security scan result
 *   5. ai_risk       — AI risk assessment
 *   6. human_approval — explicit human approval (HUMAN-ONLY)
 *
 * Gate states:
 *   PASS    — gate passed
 *   FAIL    — gate failed (blocks merge)
 *   BLOCKED — gate cannot be evaluated (blocks merge)
 *   SKIPPED — gate not applicable (does not block)
 *   PENDING — gate evaluation in progress
 *
 * Per spec §8: "ห้าม merge หาก gate ที่ required ไม่ผ่าน"
 */

import type { MergeGate, MergeGateResult, GateId, GateStatus } from "@/types";
import type { AIAnalysisResult, SecurityFinding, CheckRun } from "@/types";

export type MergeGateInput = {
  checks?: CheckRun[];           // CI check runs from GitHub
  aiAnalysis?: AIAnalysisResult; // AI analysis result
  securityFindings?: SecurityFinding[]; // Security scan findings
  humanApproved?: boolean;       // Whether human has approved
  typecheckPassed?: boolean;     // Whether TypeScript compilation passed
};

export function evaluateMergeGates(input: MergeGateInput): MergeGateResult {
  const gates: MergeGate[] = [];
  const blockingReasons: string[] = [];

  // Gate 1: Build
  const buildCheck = input.checks?.find((c) => /build/i.test(c.name));
  let buildStatus: GateStatus = "PENDING";
  let buildReason: string | undefined;
  if (!buildCheck) {
    buildStatus = "BLOCKED";
    buildReason = "No build check found";
    blockingReasons.push("Build: no build check found");
  } else if (buildCheck.status !== "completed") {
    buildStatus = "PENDING";
    buildReason = `Build ${buildCheck.status}`;
  } else if (buildCheck.conclusion === "success") {
    buildStatus = "PASS";
  } else {
    buildStatus = "FAIL";
    buildReason = `Build ${buildCheck.conclusion}`;
    blockingReasons.push(`Build: ${buildCheck.conclusion}`);
  }
  gates.push({
    id: "build",
    label: "Build",
    status: buildStatus,
    reason: buildReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Gate 2: Tests
  const testCheck = input.checks?.find((c) => /test|unit|jest|vitest/i.test(c.name));
  let testStatus: GateStatus = "PENDING";
  let testReason: string | undefined;
  if (!testCheck) {
    testStatus = "BLOCKED";
    testReason = "No test check found";
    blockingReasons.push("Tests: no test check found");
  } else if (testCheck.status !== "completed") {
    testStatus = "PENDING";
    testReason = `Tests ${testCheck.status}`;
  } else if (testCheck.conclusion === "success") {
    testStatus = "PASS";
  } else {
    testStatus = "FAIL";
    testReason = `Tests ${testCheck.conclusion}`;
    blockingReasons.push(`Tests: ${testCheck.conclusion}`);
  }
  gates.push({
    id: "tests",
    label: "Tests",
    status: testStatus,
    reason: testReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Gate 3: Type Check
  let typeStatus: GateStatus = "PENDING";
  let typeReason: string | undefined;
  if (input.typecheckPassed === undefined) {
    typeStatus = "BLOCKED";
    typeReason = "No authoritative TypeScript/typecheck result found";
    blockingReasons.push("Type Check: no authoritative result found");
  } else if (input.typecheckPassed) {
    typeStatus = "PASS";
  } else {
    typeStatus = "FAIL";
    typeReason = "TypeScript compilation failed";
    blockingReasons.push("Type Check: compilation failed");
  }
  gates.push({
    id: "typecheck",
    label: "Type Check",
    status: typeStatus,
    reason: typeReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Gate 4: Security
  let secStatus: GateStatus = "PENDING";
  let secReason: string | undefined;
  const findings = input.securityFindings ?? input.aiAnalysis?.security ?? [];
  const criticalFindings = findings.filter((f) => f.severity === "CRITICAL");
  const highFindings = findings.filter((f) => f.severity === "HIGH");
  if (criticalFindings.length > 0) {
    secStatus = "FAIL";
    secReason = `${criticalFindings.length} critical security finding(s)`;
    blockingReasons.push(`Security: ${criticalFindings.length} critical finding(s) — ${criticalFindings[0].reason}`);
  } else if (highFindings.length > 0) {
    secStatus = "FAIL";
    secReason = `${highFindings.length} high-severity security finding(s)`;
    blockingReasons.push(`Security: ${highFindings.length} high-severity finding(s)`);
  } else {
    secStatus = "PASS";
  }
  gates.push({
    id: "security",
    label: "Security",
    status: secStatus,
    reason: secReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Gate 5: AI Risk
  let aiStatus: GateStatus = "PENDING";
  let aiReason: string | undefined;
  if (!input.aiAnalysis) {
    aiStatus = "PENDING";
    aiReason = "AI analysis not yet run";
    blockingReasons.push("AI Risk: analysis pending");
  } else if (input.aiAnalysis.riskLevel === "CRITICAL") {
    aiStatus = "FAIL";
    aiReason = `AI risk: CRITICAL — ${input.aiAnalysis.blockers.length} blocker(s)`;
    blockingReasons.push(`AI Risk: CRITICAL — ${input.aiAnalysis.blockers.join("; ")}`);
  } else if (input.aiAnalysis.riskLevel === "HIGH") {
    aiStatus = "FAIL";
    aiReason = `AI risk: HIGH`;
    blockingReasons.push("AI Risk: HIGH — manual review required");
  } else {
    aiStatus = "PASS";
    aiReason = `AI risk: ${input.aiAnalysis.riskLevel} (confidence ${Math.round(input.aiAnalysis.confidence * 100)}%)`;
  }
  gates.push({
    id: "ai_risk",
    label: "AI Risk",
    status: aiStatus,
    reason: aiReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Gate 6: Human Approval (HUMAN-ONLY — AI can never satisfy this)
  let humanStatus: GateStatus = "PENDING";
  let humanReason: string | undefined;
  if (input.humanApproved) {
    humanStatus = "PASS";
    humanReason = "Approved by human operator";
  } else {
    humanStatus = "FAIL";
    humanReason = "Awaiting human approval (AI cannot approve)";
    blockingReasons.push("Human Approval: required (HUMAN-ONLY — AI may not approve)");
  }
  gates.push({
    id: "human_approval",
    label: "Human Approval",
    status: humanStatus,
    reason: humanReason,
    required: true,
    evaluatedAt: new Date().toISOString(),
  });

  // Overall result
  const requiredGates = gates.filter((g) => g.required);
  const anyFailed = requiredGates.some((g) => g.status === "FAIL" || g.status === "BLOCKED");
  const anyPending = requiredGates.some((g) => g.status === "PENDING");
  const overall: "READY" | "BLOCKED" | "PENDING" = anyFailed ? "BLOCKED" : anyPending ? "PENDING" : "READY";

  return { gates, overall, blockingReasons };
}
