/**
 * Diff Analyzer — V3 spec sections 13-18
 *
 * 13. Diff Parser (Added/Modified/Deleted/Renamed, Additions/Deletions)
 * 14. File Classification (Frontend/Backend/API/Auth/Database/...)
 * 15. Baseline Analyzer (auth, jwt, token, password, secret, middleware, sql, ...)
 * 16. Risk Engine (LOW / MEDIUM / HIGH / CRITICAL)
 * 17. Impact Engine (Auth/API/Database/Frontend/Backend/Infrastructure)
 * 18. Fallback — must work without AI
 */

import type {
  DiffFile,
  ClassifiedFile,
  DiffSummary,
  FileCategory,
  RiskLevel,
  ImpactArea,
} from "@/types";

// ============ Section 14: File Classification (Phase 3 — extended categories) ============
const CATEGORY_RULES: { category: FileCategory; patterns: RegExp[] }[] = [
  { category: "auth", patterns: [/(^|\/)auth\//i, /login|logout|signin|signout|session|jwt|passport/i, /middleware\.ts$/i, /permission|rbac|policy/i] },
  { category: "payment", patterns: [/stripe|paypal|adyen|square|braintree|payment|checkout|billing/i, /(^|\/)payments?\//i] },
  { category: "security", patterns: [/(^|\/)security\//i, /crypt|aes|rsa|hmac|signature|verify/i, /redact|sanitize|escape/i] },
  { category: "api", patterns: [/(^|\/)api\//i, /route\.ts$|route\.js$/i, /controller|handler/i, /openapi|swagger/i] },
  { category: "database", patterns: [/prisma\/|schema\.prisma$/i, /\.sql$/i, /migration/i, /model\./i, /repository\./i, /\.entity\.ts$/i] },
  { category: "frontend", patterns: [/(^|\/)components\//i, /\.(tsx|jsx|vue|svelte)$/i, /page\.tsx$|layout\.tsx$/i, /(^|\/)app\//i, /\.css$|\.scss$/i] },
  { category: "backend", patterns: [/(^|\/)lib\//i, /service\./i, /use-case|usecase/i, /worker|queue|cron/i, /\.(py|go|rs|java)$/i] },
  { category: "infrastructure", patterns: [/^(\.github|infra|deploy|docker|k8s|terraform)/i, /Dockerfile|docker-compose/i, /\.ya?ml$/i, /terraform|helm/i] },
  { category: "configuration", patterns: [/^\.env|\.config\./i, /next\.config|tsconfig|tailwind\.config/i, /\.toml$|\.ini$|\.json$/i] },
  { category: "tests", patterns: [/(__tests__|\.test\.|\.spec\.|tests?\/)/i, /e2e|cypress|playwright/i] },
  { category: "dependencies", patterns: [/^package\.json$/i, /package-lock\.json|yarn\.lock|bun\.lock|pnpm-lock/i, /requirements\.txt|go\.mod|cargo\.toml/i] },
  { category: "docs", patterns: [/\.mdx?$|README|CHANGELOG|LICENSE/i] },
];

export function classifyFile(filename: string): FileCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((re) => re.test(filename))) return rule.category;
  }
  return "unknown";
}

// ============ Section 15: Baseline Analyzer ============
const BASELINE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "auth", re: /\b(auth|authenticate|authorization)\b/i },
  { key: "jwt", re: /\b(jwt|jsonwebtoken|sign\(|verify\()/i },
  { key: "token", re: /\b(token|bearer|apikey|api_key)\b/i },
  { key: "password", re: /\b(password|passwd|pwd|secret)\b/i },
  { key: "secret", re: /\b(secret|private[_-]?key|client[_-]?secret)\b/i },
  { key: "middleware", re: /\b(middleware|use\(|next\()\b/i },
  { key: "database", re: /\b(prisma|database|db\.|@db|model\s+\w+\s*\{)/i },
  { key: "schema", re: /\b(schema|entity|model)\b/i },
  { key: "migration", re: /\b(migration|migrate|up\(|down\()\b/i },
  { key: "sql", re: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP|ALTER)\b/i },
  { key: "api", re: /\b(api|endpoint|route|fetch\(|axios)\b/i },
  { key: "route", re: /\b(route|router|path)\b/i },
  { key: "fetch", re: /\b(fetch|http\.get|http\.post|axios)\b/i },
  { key: "axios", re: /\baxios\b/i },
  { key: "permission", re: /\b(permission|rbac|role|policy|guard)\b/i },
  { key: "cors", re: /\b(cors|access-control-allow-origin)\b/i },
  { key: "csrf", re: /\b(csrf|xsrf|synchronizer\s+token)\b/i },
  { key: "eval", re: /\b(eval\(|new\s+Function\(|setTimeout\([^,]*["']\))/i },
  { key: "exec", re: /\b(exec\(|execSync\(|spawn\(|child_process)\b/i },
];

export function scanBaseline(patch: string): string[] {
  const hits = new Set<string>();
  for (const p of BASELINE_PATTERNS) {
    if (p.re.test(patch)) hits.add(p.key);
  }
  return [...hits];
}

// ============ Section 16: Risk Engine ============
const CRITICAL_KEYWORDS = [
  /jwt\.sign|jwt\.verify/i,
  /process\.env\.(JWT_SECRET|SESSION_SECRET|DATABASE_URL)/i,
  /password\s*=\s*["']/i,
  /private[_-]?key/i,
  /eval\(|new\s+Function\(/i,
  /exec\(|execSync\(|spawn\(/i,
  /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i,
];
const HIGH_KEYWORDS = [
  /middleware\.(ts|js)$/i,
  /schema\.prisma$/i,
  /migration/i,
  /route\.ts$/i,
  /permission|rbac/i,
  /cors|csrf/i,
  /session|cookie/i,
];
const MEDIUM_KEYWORDS = [
  /api\//i,
  /auth\//i,
  /service\./i,
  /use-case/i,
  /worker|cron/i,
];

export function computeRisk(file: DiffFile, baselineHits: string[]): RiskLevel {
  const text = `${file.filename}\n${file.patch ?? ""}`;
  if (CRITICAL_KEYWORDS.some((re) => re.test(text))) return "CRITICAL";
  if (baselineHits.includes("auth") || baselineHits.includes("jwt") || baselineHits.includes("secret")) return "HIGH";
  if (HIGH_KEYWORDS.some((re) => re.test(file.filename))) return "HIGH";
  if (MEDIUM_KEYWORDS.some((re) => re.test(file.filename))) return "MEDIUM";
  if (baselineHits.length > 0) return "MEDIUM";
  if (file.changes > 100) return "MEDIUM";
  return "LOW";
}

// ============ Section 17: Impact Engine ============
export function computeImpactAreas(file: DiffFile, category: FileCategory, baselineHits: string[]): ImpactArea[] {
  const areas = new Set<ImpactArea>();
  switch (category) {
    case "auth": areas.add("auth"); areas.add("security"); break;
    case "api": areas.add("api"); areas.add("backend"); break;
    case "database": areas.add("database"); areas.add("backend"); break;
    case "frontend": areas.add("frontend"); break;
    case "backend": areas.add("backend"); break;
    case "infrastructure": areas.add("infrastructure"); break;
    case "configuration": areas.add("infrastructure"); break;
    case "tests": break;
    case "dependencies": areas.add("infrastructure"); areas.add("security"); break;
    case "docs": break;
    case "unknown": areas.add("unknown"); break;
  }
  if (baselineHits.includes("auth") || baselineHits.includes("jwt") || baselineHits.includes("permission")) areas.add("auth");
  if (baselineHits.includes("sql") || baselineHits.includes("migration") || baselineHits.includes("schema")) areas.add("database");
  if (baselineHits.includes("api") || baselineHits.includes("route") || baselineHits.includes("fetch")) areas.add("api");
  if (baselineHits.includes("cors") || baselineHits.includes("csrf") || baselineHits.includes("secret")) areas.add("security");
  return [...areas];
}

// ============ Section 13: Diff Parser ============
export function analyzeDiff(files: DiffFile[]): DiffSummary {
  const byCategory: Record<FileCategory, number> = {
    frontend: 0, backend: 0, api: 0, auth: 0, database: 0, payment: 0, security: 0,
    configuration: 0, infrastructure: 0, tests: 0, dependencies: 0, docs: 0, unknown: 0,
  };
  const byRisk: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const byStatus: Record<DiffFile["status"], number> = {
    added: 0, modified: 0, removed: 0, renamed: 0, copied: 0, changed: 0, unchanged: 0, binary: 0,
  };

  let additions = 0;
  let deletions = 0;
  const classified: ClassifiedFile[] = files.map((f) => {
    const category = classifyFile(f.filename);
    const baselineHits = scanBaseline(f.patch ?? "");
    const risk = computeRisk(f, baselineHits);
    const impactAreas = computeImpactAreas(f, category, baselineHits);

    byCategory[category]++;
    byRisk[risk]++;
    byStatus[f.status]++;
    additions += f.additions;
    deletions += f.deletions;

    return { ...f, category, risk, impactAreas, baselineHits };
  });

  return {
    totalFiles: files.length,
    additions,
    deletions,
    byCategory,
    byRisk,
    byStatus,
    files: classified,
  };
}

// ============ Section 18: Fallback Baseline Analyzer (used when AI is unavailable) ============
import type { AIAnalysisResult, SecurityFinding, ArchitectureNode, ArchitectureEdge } from "@/types";
import { v4 as uuid } from "uuid";

export function baselineAnalyze(
  files: DiffFile[],
  context: { prNumber?: number; repository?: string },
): AIAnalysisResult {
  const summary = analyzeDiff(files);
  const findings: SecurityFinding[] = [];

  // Generate security findings from baseline patterns
  for (const f of summary.files) {
    const lines = (f.patch ?? "").split("\n");
    lines.forEach((line, idx) => {
      if (!line.startsWith("+")) return;
      if (/password\s*=\s*["'][^"']+["']/i.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "CRITICAL",
          evidence: line.replace(/^./, "").trim().slice(0, 80),
          reason: "Possible hardcoded password",
          recommendation: "Move the secret to an environment variable and read via process.env",
          category: "secret",
        });
      }
      if (/gh[ps]_[A-Za-z0-9]{36}/.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "CRITICAL",
          evidence: "GitHub token detected",
          reason: "Hardcoded GitHub PAT in source",
          recommendation: "Rotate the token immediately and move to GITHUB_TOKEN env var",
          category: "secret",
        });
      }
      if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "CRITICAL",
          evidence: "JWT token detected",
          reason: "Hardcoded JWT in source",
          recommendation: "Remove the JWT and ensure tokens are only ever minted at runtime",
          category: "secret",
        });
      }
      if (/eval\(/.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "HIGH",
          evidence: line.slice(0, 80),
          reason: "Use of eval() is dangerous with untrusted input",
          recommendation: "Refactor to avoid eval; use JSON.parse or a proper parser",
          category: "injection",
        });
      }
      if (/innerHTML\s*=/.test(line) && !/textContent\s*=/.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "MEDIUM",
          evidence: line.slice(0, 80),
          reason: "Direct innerHTML assignment may allow XSS",
          recommendation: "Use textContent or sanitize with DOMPurify",
          category: "xss",
        });
      }
      if (/SELECT.*\$\{.*\}/i.test(line) || /INSERT.*\$\{.*\}/i.test(line)) {
        findings.push({
          id: uuid(),
          file: f.filename,
          line: idx,
          severity: "HIGH",
          evidence: line.slice(0, 80),
          reason: "Possible SQL injection via string interpolation",
          recommendation: "Use parameterized queries (Prisma.$queryRaw with $1, $2, ...)",
          category: "sql_injection",
        });
      }
    });
  }

  // Build architecture nodes from classified files
  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];
  for (const f of summary.files) {
    const node: ArchitectureNode = {
      id: `node-${f.sha}`,
      label: f.filename.split("/").pop() ?? f.filename,
      type:
        f.category === "frontend" ? "frontend"
        : f.category === "api" ? "api"
        : f.category === "database" ? "database"
        : f.category === "auth" ? "auth"
        : f.category === "infrastructure" ? "infra"
        : "service",
      file: f.filename,
    };
    nodes.push(node);
  }

  // Crude edges: frontend -> api -> backend -> database
  const frontends = nodes.filter((n) => n.type === "frontend");
  const apis = nodes.filter((n) => n.type === "api");
  const backends = nodes.filter((n) => n.type === "service");
  const dbs = nodes.filter((n) => n.type === "database");
  const auths = nodes.filter((n) => n.type === "auth");

  for (const f of frontends) for (const a of apis) edges.push({ id: uuid(), from: f.id, to: a.id, type: "call" });
  for (const a of apis) for (const b of backends) edges.push({ id: uuid(), from: a.id, to: b.id, type: "call" });
  for (const b of backends) for (const d of dbs) edges.push({ id: uuid(), from: b.id, to: d.id, type: "data" });
  for (const a of apis) for (const au of auths) edges.push({ id: uuid(), from: a.id, to: au.id, type: "depends" });

  const overallRisk: RiskLevel =
    summary.byRisk.CRITICAL > 0 ? "CRITICAL"
    : summary.byRisk.HIGH > 0 ? "HIGH"
    : summary.byRisk.MEDIUM > 0 ? "MEDIUM"
    : "LOW";

  const changedAreas = new Set<ImpactArea>();
  summary.files.forEach((f) => f.impactAreas.forEach((a) => changedAreas.add(a)));

  // Compute API impact (breaking if any API file is removed or has auth changes)
  const apiFiles = summary.files.filter((f) => f.category === "api");
  const apiBreaking = apiFiles.some((f) => f.status === "removed") || apiFiles.some((f) => f.baselineHits.includes("auth"));

  // Compute dependency impact
  const depFiles = summary.files.filter((f) => f.category === "dependencies");
  const addedDeps: string[] = [];
  const removedDeps: string[] = [];
  depFiles.forEach((f) => {
    const patch = f.patch ?? "";
    const added = patch.matchAll(/^\+\s+"([^"]+)":\s+"([^"]+)"/gm);
    for (const m of added) addedDeps.push(`${m[1]}@${m[2]}`);
    const removed = patch.matchAll(/^-\s+"([^"]+)":\s+"([^"]+)"/gm);
    for (const m of removed) removedDeps.push(`${m[1]}@${m[2]}`);
  });

  // Compute blockers (hard issues that prevent merge)
  const blockers: string[] = [];
  if (findings.some((f) => f.severity === "CRITICAL")) {
    blockers.push(`${findings.filter((f) => f.severity === "CRITICAL").length} critical security finding(s) must be remediated`);
  }
  if (apiBreaking) {
    blockers.push("API breaking change detected — coordinate with consumers before merge");
  }

  // Test recommendations based on changed areas
  const testRecs: { area: string; recommended: string; reason: string }[] = [];
  if (changedAreas.has("auth")) testRecs.push({ area: "auth", recommended: "Integration tests for login/logout/session", reason: "Auth code changed — verify session handling" });
  if (changedAreas.has("api")) testRecs.push({ area: "api", recommended: "Contract tests for affected endpoints", reason: "API surface changed — verify backwards compatibility" });
  if (changedAreas.has("database")) testRecs.push({ area: "database", recommended: "Migration tests + rollback tests", reason: "Database schema changed — verify migrations are reversible" });
  if (changedAreas.has("security")) testRecs.push({ area: "security", recommended: "Security regression tests", reason: "Security-sensitive code changed" });
  if (testRecs.length === 0) testRecs.push({ area: "general", recommended: "Unit tests for changed files", reason: "No high-risk areas detected — basic coverage suffices" });

  // Deployment risk
  const deploymentRisk = {
    level: overallRisk,
    reasons: [
      overallRisk === "CRITICAL" ? "Critical findings present" : `${summary.byRisk.HIGH} high-risk files`,
      apiBreaking ? "API breaking change" : "No breaking API changes",
      findings.length > 0 ? `${findings.length} security findings` : "No security findings",
    ].filter(Boolean),
    canaryRecommended: overallRisk === "HIGH" || overallRisk === "CRITICAL" || apiBreaking,
  };

  return {
    id: uuid(),
    summary: `Baseline analysis of ${summary.totalFiles} files (+${summary.additions} -${summary.deletions}). Risk: ${overallRisk}. Found ${findings.length} security findings.`,
    riskLevel: overallRisk,
    confidence: 0.6, // baseline analyzer is moderately confident (no semantic understanding)
    changedAreas: [...changedAreas],
    files: summary.files.map((f) => ({
      filename: f.filename,
      category: f.category,
      risk: f.risk,
      note: `Baseline hits: ${f.baselineHits.join(", ") || "none"}. Impact: ${f.impactAreas.join(", ") || "none"}`,
    })),
    decisions: [
      {
        id: uuid(),
        decision: "REQUEST_CHANGES",
        reason: overallRisk === "CRITICAL" ? "Critical risk detected — manual review required" : "Auto-classified by baseline analyzer (AI unavailable)",
        risk: overallRisk,
        files: summary.files.filter((f) => f.risk === "HIGH" || f.risk === "CRITICAL").map((f) => f.filename),
        impact: [...changedAreas],
        recommendation: "Run with AI provider configured for deeper analysis",
      },
    ],
    security: findings,
    architecture: { nodes, edges },
    dataFlow: frontends.length > 0
      ? [{ step: "request", from: "Frontend", to: apis[0]?.label ?? "API", description: "User request enters via frontend" }]
      : [],
    apiFlow: apiFiles.map((f) => ({
      method: "POST",
      path: f.filename,
      auth: f.baselineHits.includes("auth"),
      change: f.status === "added" ? "added" : f.status === "removed" ? "removed" : "changed",
    })),
    apiImpact: {
      breaking: apiBreaking,
      endpoints: apiFiles.map((f) => f.filename),
      summary: apiBreaking
        ? `Breaking changes detected across ${apiFiles.length} API file(s)`
        : `${apiFiles.length} API file(s) changed without breaking changes`,
    },
    dependencies: depFiles.flatMap((f) => {
      const patch = f.patch ?? "";
      const added = [...patch.matchAll(/^\+\s+"([^"]+)":\s+"([^"]+)"/gm)].map((m) => ({ name: m[1], version: m[2], change: "added" as const }));
      const removed = [...patch.matchAll(/^-\s+"([^"]+)":\s+"([^"]+)"/gm)].map((m) => ({ name: m[1], version: m[2], change: "removed" as const }));
      return [...added, ...removed];
    }),
    dependencyImpact: {
      added: addedDeps,
      removed: removedDeps,
      risk: addedDeps.length + removedDeps.length > 5 ? "HIGH" : addedDeps.length + removedDeps.length > 0 ? "MEDIUM" : "LOW",
      notes: depFiles.length === 0 ? "No dependency changes" : `${addedDeps.length} added, ${removedDeps.length} removed`,
    },
    recommendations: [
      overallRisk === "CRITICAL" ? "Block merge — critical security findings require remediation before deploy" : "Review high-risk files manually",
      findings.length > 0 ? `Address ${findings.length} security finding${findings.length === 1 ? "" : "s"} before merging` : "No baseline security issues detected",
      "Configure AI provider (AI_API_KEY) for deeper semantic analysis",
    ],
    blockers,
    tests: testRecs,
    deploymentRisk,
    provider: "zai",
    model: "baseline-fallback",
    promptVersion: "baseline-v1",
    tokensIn: 0,
    tokensOut: 0,
    durationMs: 0,
    fallback: true,
    redactedSecrets: 0,
    promptInjectionDetected: false,
    timestamp: new Date().toISOString(),
    prNumber: context.prNumber,
    repository: context.repository,
  };
}
