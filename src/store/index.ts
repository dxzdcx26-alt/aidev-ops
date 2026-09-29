/**
 * Global control-center state (Zustand).
 * Holds the current view, selected repo/branch/PR, agent runs, decision log,
 * audit log, and AI analysis results. Single source of truth for the UI.
 */

import { create } from "zustand";
import type {
  AIAnalysisResult,
  AgentRun,
  AgentRunState,
  AuditLogEntry,
  DecisionLogEntry,
  Deployment,
  DeploymentVerification,
  PullRequest,
  Repository,
  ReviewGate,
  MergeGateResult,
  ApprovalRecord,
} from "@/types";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { PermissionMatrix, Permission } from "@/types";

export type ViewId =
  | "dashboard"
  | "production-readiness"
  | "repositories"
  | "pull-requests"
  | "diff"
  | "merge-gate"
  | "ai"
  | "security"
  | "whiteboard"
  | "ci"
  | "deployments"
  | "audit"
  | "settings";

type State = {
  // Navigation
  view: ViewId;
  setView: (v: ViewId) => void;

  // Selection
  selectedRepo: string | null; // "owner/name"
  selectedBranch: string | null;
  selectedPRNumber: number | null;
  setSelectedRepo: (r: string | null) => void;
  setSelectedBranch: (b: string | null) => void;
  setSelectedPR: (n: number | null) => void;

  // Data cache (mock or real)
  repositories: Repository[];
  pullRequests: PullRequest[];
  deployments: Deployment[];
  mockMode: { github: boolean; vercel: boolean; ai: boolean };
  setRepositories: (r: Repository[]) => void;
  setPullRequests: (p: PullRequest[]) => void;
  setDeployments: (d: Deployment[]) => void;
  setMockMode: (m: Partial<State["mockMode"]>) => void;

  // AI
  currentAnalysis: AIAnalysisResult | null;
  analysisHistory: AIAnalysisResult[];
  setCurrentAnalysis: (a: AIAnalysisResult | null) => void;
  pushAnalysis: (a: AIAnalysisResult) => void;

  // Agent runs (V4 spec section 51-52, 93)
  agentRuns: AgentRun[];
  currentAgentRun: AgentRun | null;
  startAgentRun: (prompt: string) => string;
  updateAgentRun: (id: string, patch: Partial<AgentRun>) => void;
  addAgentStep: (runId: string, step: AgentRun["steps"][number]) => void;
  updateAgentStep: (runId: string, stepId: string, patch: Partial<AgentRun["steps"][number]>) => void;

  // Decision Log (V4 spec section 27)
  decisionLog: DecisionLogEntry[];
  addDecision: (d: DecisionLogEntry) => void;

  // Audit Log (Production spec section 68) — client-side cache for UI display
  // Real audit events are persisted server-side via /api/audit (Prisma)
  auditLog: AuditLogEntry[];
  addAudit: (a: Partial<AuditLogEntry> & { action: AuditLogEntry["action"]; status: AuditLogEntry["status"] }) => void;

  // Review Gate (V1-08)
  reviewGate: ReviewGate;
  setReviewGate: (g: Partial<ReviewGate>) => void;
  setReviewGateCheck: (key: keyof ReviewGate["checks"], value: boolean) => void;

  // Permissions (V4 spec section 53)
  permissions: PermissionMatrix;
  setPermissions: (p: PermissionMatrix) => void;

  // Verifications (Production spec section 63)
  verifications: Record<string, DeploymentVerification>;
  setVerification: (id: string, v: DeploymentVerification) => void;

  // Phase 8: Merge Gate
  mergeGateResult: MergeGateResult | null;
  setMergeGateResult: (r: MergeGateResult | null) => void;

  // Phase 9: Approval Records
  approvalRecords: ApprovalRecord[];
  addApprovalRecord: (r: ApprovalRecord) => void;

  // Phase 15: System status badges
  systemStatus: {
    github: SystemStatus;
    ai: SystemStatus;
    vercel: SystemStatus;
  };
  setSystemStatus: (s: Partial<{ github: SystemStatus; ai: SystemStatus; vercel: SystemStatus }>) => void;

  // Approvals (Production spec sections 85-88) — pending approval requests
  pendingApprovals: PendingApproval[];
  pushApproval: (a: PendingApproval) => void;
  resolveApproval: (id: string, decision: "approved" | "rejected") => void;
};

export type SystemStatus = "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE";

export type PendingApproval = {
  id: string;
  type: "commit" | "deploy" | "rollback" | "merge";
  title: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  files?: string[];
  impact?: string[];
  expectedResult?: string;
  onApprove?: string; // server endpoint to call
  payload?: Record<string, unknown>;
};

export const useStore = create<State>((set, get) => ({
  view: "dashboard",
  setView: (v) => set({ view: v }),

  selectedRepo: "dxzdcx26-alt/ai-dev-control-center",
  selectedBranch: "main",
  selectedPRNumber: null,
  setSelectedRepo: (r) => set({ selectedRepo: r, selectedPRNumber: null }),
  setSelectedBranch: (b) => set({ selectedBranch: b }),
  setSelectedPR: (n) => set({ selectedPRNumber: n }),

  repositories: [],
  pullRequests: [],
  deployments: [],
  mockMode: { github: false, vercel: false, ai: false },
  setRepositories: (r) => set({ repositories: r }),
  setPullRequests: (p) => set({ pullRequests: p }),
  setDeployments: (d) => set({ deployments: d }),
  setMockMode: (m) => set((s) => ({ mockMode: { ...s.mockMode, ...m } })),

  currentAnalysis: null,
  analysisHistory: [],
  setCurrentAnalysis: (a) => set({ currentAnalysis: a }),
  pushAnalysis: (a) => set((s) => ({ analysisHistory: [a, ...s.analysisHistory].slice(0, 50), currentAnalysis: a })),

  agentRuns: [],
  currentAgentRun: null,
  startAgentRun: (prompt) => {
    const id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const run: AgentRun = {
      id,
      state: "RUNNING",
      prompt,
      steps: [],
      startedAt: new Date().toISOString(),
    };
    set((s) => ({ agentRuns: [run, ...s.agentRuns].slice(0, 50), currentAgentRun: run }));
    return id;
  },
  updateAgentRun: (id, patch) => set((s) => ({
    agentRuns: s.agentRuns.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    currentAgentRun: s.currentAgentRun?.id === id ? { ...s.currentAgentRun, ...patch } : s.currentAgentRun,
  })),
  addAgentStep: (runId, step) => set((s) => ({
    agentRuns: s.agentRuns.map((r) => (r.id === runId ? { ...r, steps: [...r.steps, step] } : r)),
    currentAgentRun: s.currentAgentRun?.id === runId ? { ...s.currentAgentRun, steps: [...s.currentAgentRun.steps, step] } : s.currentAgentRun,
  })),
  updateAgentStep: (runId, stepId, patch) => set((s) => ({
    agentRuns: s.agentRuns.map((r) => r.id === runId ? { ...r, steps: r.steps.map((st) => st.id === stepId ? { ...st, ...patch } : st) } : r),
    currentAgentRun: s.currentAgentRun?.id === runId ? { ...s.currentAgentRun, steps: s.currentAgentRun.steps.map((st) => st.id === stepId ? { ...st, ...patch } : st) } : s.currentAgentRun,
  })),

  decisionLog: [],
  addDecision: (d) => set((s) => ({ decisionLog: [d, ...s.decisionLog].slice(0, 200) })),

  auditLog: [],
  addAudit: (a) => set((s) => ({
    auditLog: [{
      id: a.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventId: a.eventId ?? `local_${Date.now()}`,
      timestamp: a.timestamp ?? new Date().toISOString(),
      actor: a.actor ?? "system",
      action: a.action,
      target: a.target,
      status: a.status,
      risk: a.risk,
      metadata: a.metadata,
      requestId: a.requestId,
      reason: a.reason,
      // legacy fields
      user: a.user ?? a.actor,
      agent: a.agent ?? a.actor,
      repository: a.repository,
      branch: a.branch,
      commit: a.commit,
      result: a.result ?? (a.status === "success" ? "success" : a.status === "denied" ? "denied" : "failure"),
      detail: a.detail ?? a.reason,
    } as AuditLogEntry, ...s.auditLog].slice(0, 200),
  })),

  reviewGate: {
    status: "reviewing",
    checks: {
      prLoaded: true,
      diffReviewed: false,
      securityPassed: false,
      testsPassed: false,
      aiReviewed: false,
      humanApproved: false,
    },
  },
  setReviewGate: (g) => set((s) => ({ reviewGate: { ...s.reviewGate, ...g } })),
  setReviewGateCheck: (key, value) => set((s) => {
    const checks = { ...s.reviewGate.checks, [key]: value };
    const allPass = Object.values(checks).every(Boolean);
    const anyBlock = !checks.securityPassed || !checks.testsPassed;
    const status: ReviewGate["status"] = allPass ? "approved" : anyBlock ? "blocked" : "reviewing";
    return { reviewGate: { status, checks } };
  }),

  permissions: DEFAULT_PERMISSIONS,
  setPermissions: (p) => set({ permissions: p }),

  verifications: {},
  setVerification: (id, v) => set((s) => ({ verifications: { ...s.verifications, [id]: v } })),

  // Phase 8: Merge Gate result
  mergeGateResult: null as MergeGateResult | null,
  setMergeGateResult: (r: MergeGateResult | null) => set({ mergeGateResult: r }),

  // Phase 9: Approval records
  approvalRecords: [] as ApprovalRecord[],
  addApprovalRecord: (r: ApprovalRecord) => set((s) => ({ approvalRecords: [r, ...s.approvalRecords].slice(0, 50) })),

  // Phase 15: System status (LIVE/MOCK/FALLBACK/ERROR/OFFLINE)
  systemStatus: {
    github: "LIVE" as "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE",
    ai: "LIVE" as "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE",
    vercel: "OFFLINE" as "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE",
  },
  setSystemStatus: (s: Partial<{ github: "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE"; ai: "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE"; vercel: "LIVE" | "MOCK" | "FALLBACK" | "ERROR" | "OFFLINE" }>) =>
    set((state) => ({ systemStatus: { ...state.systemStatus, ...s } })),

  pendingApprovals: [],
  pushApproval: (a) => set((s) => ({ pendingApprovals: [a, ...s.pendingApprovals.filter((p) => p.id !== a.id)] })),
  resolveApproval: (id, decision) => set((s) => ({ pendingApprovals: s.pendingApprovals.filter((p) => p.id !== id) })),
}));
