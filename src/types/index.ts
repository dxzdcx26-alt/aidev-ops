// AI Dev Control Center — Shared Types
// These types model the entire domain across V1-V4 + Production.

// ============ Repository / GitHub ============
export type RepoOwner = {
  login: string;
  avatar_url: string;
  html_url: string;
};

export type Repository = {
  id: number;
  name: string;
  full_name: string;
  owner: RepoOwner;
  private: boolean;
  description: string | null;
  default_branch: string;
  html_url: string;
  updated_at: string;
  stargazers_count: number;
  open_issues_count: number;
  language: string | null;
};

export type Branch = {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
};

export type PullRequest = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  user: { login: string; avatar_url: string };
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: { name: string; color: string }[];
};

export type DiffFile = {
  sha: string;
  filename: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  raw_url: string;
  blob_url: string;
};

export type Commit = {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
  stats?: { additions: number; deletions: number; total: number };
};

export type Review = {
  id: number;
  user: { login: string; avatar_url: string };
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";
  body: string | null;
  submitted_at: string;
  html_url: string;
};

export type CheckStatus = "queued" | "in_progress" | "completed";
export type CheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "stale"
  | null;

export type CheckRun = {
  id: number;
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  head_sha: string;
};

export type Workflow = {
  id: number;
  name: string;
  path: string;
  state: "active" | "disabled_manually" | "disabled_inactivity";
  badge_url: string;
  html_url: string;
};

export type WorkflowRun = {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: CheckConclusion;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  event: string;
};

// ============ Diff Analysis ============
export type FileCategory =
  | "frontend"
  | "backend"
  | "api"
  | "auth"
  | "database"
  | "payment"
  | "security"
  | "configuration"
  | "infrastructure"
  | "dependencies"
  | "tests"
  | "docs"
  | "unknown";

export type DiffFileStatus = "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged" | "binary";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type ImpactArea =
  | "auth"
  | "api"
  | "database"
  | "frontend"
  | "backend"
  | "infrastructure"
  | "security"
  | "performance"
  | "unknown";

export type ClassifiedFile = DiffFile & {
  category: FileCategory;
  risk: RiskLevel;
  impactAreas: ImpactArea[];
  baselineHits: string[];
};

export type DiffSummary = {
  totalFiles: number;
  additions: number;
  deletions: number;
  byCategory: Record<FileCategory, number>;
  byRisk: Record<RiskLevel, number>;
  byStatus: Record<DiffFile["status"], number>;
  files: ClassifiedFile[];
};

// ============ AI Analysis ============
export type AIProvider = "zai" | "openrouter" | "glm" | "deepseek" | "claude" | "openai";

export type AIDecision = {
  id?: string;
  decision: string;
  reason: string;
  risk: RiskLevel;
  files: string[];
  impact: ImpactArea[];
  recommendation?: string;
};

export type SecurityFinding = {
  id?: string;
  file: string;
  line: number;
  severity: Severity;
  evidence: string;
  reason: string;
  recommendation: string;
  category:
    | "secret"
    | "injection"
    | "auth"
    | "xss"
    | "ssrf"
    | "cors"
    | "csrf"
    | "headers"
    | "upload"
    | "logging"
    | "path_traversal"
    | "command_injection"
    | "sql_injection"
    | "database"
    | "other";
};

export type ArchitectureNode = {
  id: string;
  label: string;
  type: "frontend" | "backend" | "api" | "database" | "service" | "auth" | "infra" | "external";
  file?: string;
  line?: number;
  function?: string;
  module?: string;
};

export type ArchitectureEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: "call" | "data" | "depends" | "extends" | "implements";
};

export type AIAnalysisResult = {
  id: string;
  summary: string;
  riskLevel: RiskLevel;
  confidence: number; // 0..1 — AI self-reported confidence
  changedAreas: ImpactArea[];
  files: { filename: string; category: FileCategory; risk: RiskLevel; note: string }[];
  decisions: AIDecision[];
  security: SecurityFinding[];
  architecture: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
  dataFlow: { step: string; from: string; to: string; description: string }[];
  apiFlow: { method: string; path: string; auth: boolean; change: "added" | "removed" | "changed" | "unchanged" }[];
  apiImpact: { breaking: boolean; endpoints: string[]; summary: string };
  dependencies: { name: string; version: string; change: "added" | "removed" | "changed" }[];
  dependencyImpact: { added: string[]; removed: string[]; risk: RiskLevel; notes: string };
  recommendations: string[];
  blockers: string[]; // hard blockers that prevent merge
  tests: { area: string; recommended: string; reason: string }[]; // recommended test coverage
  deploymentRisk: { level: RiskLevel; reasons: string[]; canaryRecommended: boolean };
  // meta
  provider: AIProvider;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  fallback: boolean; // true if baseline analyzer was used
  redactedSecrets: number; // how many secrets were redacted before AI call
  promptInjectionDetected: boolean; // true if injection patterns were found (and neutralized)
  timestamp: string;
  prNumber?: number;
  repository?: string;
};

// ============ Decision Log ============
export type DecisionLogEntry = {
  id: string;
  agent: string;
  model?: string;
  promptVersion?: string;
  decision: string;
  reason: string;
  risk: RiskLevel;
  files: string[];
  impact: ImpactArea[];
  commitSha?: string;
  prNumber?: number;
  timestamp: string;
};

// ============ Permissions ============
export type Permission =
  | "VIEW"
  | "ANALYZE"
  | "COMMENT"
  | "APPROVE"
  | "COMMIT"
  | "MERGE"
  | "DEPLOY"
  | "ROLLBACK"
  | "ADMIN";

export type PermissionMode = "allowed" | "approval" | "human" | "denied";

export type PermissionMatrix = Record<Permission, PermissionMode>;

export type Role = "viewer" | "analyst" | "operator" | "admin";

export type PermissionDecision = {
  allowed: boolean;
  reason: string;
  requiredMode: PermissionMode;
  hasApproval: boolean;
};

// ============ Merge Gate (Phase 8) ============
export type GateId = "build" | "tests" | "typecheck" | "security" | "ai_risk" | "human_approval";
export type GateStatus = "PASS" | "FAIL" | "BLOCKED" | "SKIPPED" | "PENDING";

export type MergeGate = {
  id: GateId;
  label: string;
  status: GateStatus;
  reason?: string;
  required: boolean;
  evaluatedAt?: string;
};

export type MergeGateResult = {
  gates: MergeGate[];
  overall: "READY" | "BLOCKED" | "PENDING";
  blockingReasons: string[];
};

// ============ Approval Record (Phase 9) ============
export type ApprovalAction = "deploy" | "rollback" | "merge" | "commit";

export type ApprovalRecord = {
  id: string;
  user: string;
  action: ApprovalAction;
  target: string; // e.g. "PR #42", "deployment dpl_abc123"
  timestamp: string;
  reason: string;
  decision: "approved" | "rejected" | "pending";
  metadata: {
    repository?: string;
    branch?: string;
    commit?: string;
    risk?: RiskLevel;
    files?: string[];
    impact?: string[];
    expectedResult?: string;
  };
};

// ============ Audit Log Events (Phase 13) ============
export type AuditAction =
  | "LOGIN"
  | "VIEW"
  | "ANALYZE"
  | "APPROVE"
  | "REJECT"
  | "MERGE"
  | "DEPLOY"
  | "DEPLOY_SUCCESS"
  | "DEPLOY_FAILED"
  | "ROLLBACK"
  | "ROLLBACK_SUCCESS"
  | "ROLLBACK_FAILED"
  | "SECURITY_ALERT"
  | "PERMISSION_DENIED"
  | "AI_CALL"
  | "GITHUB_CALL"
  | "VERCEL_CALL"
  | "VERIFY"
  | "COMMIT";

export type AuditEventStatus = "success" | "failure" | "denied" | "warning";

export type AuditLogEntry = {
  id: string;
  eventId: string;
  timestamp: string;
  actor: string; // user or agent name
  action: AuditAction;
  target?: string;
  status: AuditEventStatus;
  risk?: RiskLevel;
  metadata?: Record<string, unknown>;
  requestId?: string;
  reason?: string;
  ip?: string;
  // legacy fields kept for backward compat with V1
  user?: string;
  agent?: string;
  repository?: string;
  branch?: string;
  commit?: string;
  result?: "success" | "failure" | "denied";
  detail?: string;
};

// ============ Deployment ============
export type DeploymentStatus =
  | "QUEUED"
  | "BUILDING"
  | "READY"
  | "ERROR"
  | "CANCELED"
  | "VERIFYING"
  | "VERIFIED"
  | "ROLLBACK_PENDING"
  | "ROLLED_BACK";

export type Deployment = {
  id: string;
  uid: string;
  url: string | null;
  state: DeploymentStatus;
  target: "production" | "preview" | "staging";
  branch: string;
  commitSha: string;
  commitMessage: string;
  createdAt: string;
  readyAt: string | null;
  buildingDurationMs: number | null;
  inspectorUrl: string | null;
  meta: { framework?: string; packageName?: string };
};

export type DeploymentVerification = {
  deploymentId: string;
  httpStatus: number | null;
  pageLoadOk: boolean;
  apiHealthOk: boolean;
  consoleErrors: string[];
  notFoundErrors: number;
  serverErrors: number;
  smokeTestPassed: boolean;
  timestamp: string;
};

// ============ Agent / Command ============
export type AgentRunState =
  | "IDLE"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type AgentStep = {
  id: string;
  tool: string;
  description: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  input?: string;
  output?: string;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
  error?: string;
};

export type AgentRun = {
  id: string;
  state: AgentRunState;
  prompt: string;
  steps: AgentStep[];
  startedAt: string;
  endedAt?: string;
  result?: string;
  error?: string;
};

// ============ Review Gate ============
export type ReviewGateStatus = "pending" | "reviewing" | "approved" | "blocked";

export type ReviewGate = {
  status: ReviewGateStatus;
  checks: {
    prLoaded: boolean;
    diffReviewed: boolean;
    securityPassed: boolean;
    testsPassed: boolean;
    aiReviewed: boolean;
    humanApproved: boolean;
  };
};
