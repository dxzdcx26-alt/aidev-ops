/**
 * Security — Phase 5 (AI Security Pipeline) + Phase 6 (Prompt Injection Defense) + V4 §29-33
 *
 * Pipeline:
 *   INPUT → SECRET REDACTION → PROMPT INJECTION DETECTION → CONTENT SANITIZATION →
 *   AI ANALYSIS → OUTPUT VALIDATION → SECURITY POLICY → FINAL RESULT
 *
 * §81 Data Safety: redact secrets before AI prompt
 * §30 Injection: SQL / XSS / SSRF / Command / Path Traversal detectors (in source code being analyzed)
 * §31 Web: CORS / CSRF / Headers / Upload / Logging
 * §32 Security Finding: File / Line / Severity / Evidence / Reason / Recommendation
 * §33 Security Gate: CRITICAL/HIGH/MEDIUM/LOW/INFO + Block/Warning/Pass
 */

import type { Severity, SecurityFinding } from "@/types";
import { v4 as uuid } from "uuid";

// ============ Phase 5 §81: Secret Redaction for AI Prompts ============
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "GITHUB_TOKEN", re: /gh[ps]_[A-Za-z0-9]{36}/g },
  { name: "GITHUB_OAUTH", re: /gho_[A-Za-z0-9]{36}/g },
  { name: "GITHUB_USER", re: /ghu_[A-Za-z0-9]{36}/g },
  { name: "GITHUB_APP", re: /ghs_[A-Za-z0-9]{36}/g },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { name: "AWS_ACCESS_KEY", re: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS_SECRET", re: /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/g },
  { name: "STRIPE_KEY", re: /sk_(?:test|live)_[A-Za-z0-9]{24,}/g },
  { name: "PRIVATE_KEY", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/g },
  { name: "GOOGLE_API", re: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "SLACK_TOKEN", re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: "VERCEL_TOKEN", re: /[A-Za-z0-9]{24,}/g }, // heuristic — disabled in redaction (too broad), used in scanLine
  { name: "PASSWORD_ASSIGN", re: /(password|passwd|pwd|secret|api[_-]?key|token|client[_-]?secret)\s*[:=]\s*["'][^"'\n]{6,}["']/gi },
  { name: "DATABASE_URL", re: /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s/$?]+/g },
  { name: "COOKIE_SESSION", re: /(?:cookie|session[_-]?id|set[_-]?cookie)\s*[:=]\s*["'][^"'\n]{8,}["']/gi },
  { name: "AUTH_HEADER", re: /authorization\s*[:=]\s*["'](?:bearer|basic|token)\s+[A-Za-z0-9._-]+["']/gi },
  { name: "ENV_SECRET", re: /(?:JWT_SECRET|SESSION_SECRET|ENCRYPTION_KEY|SECRET_KEY)\s*[:=]\s*["'][^"'\n]{8,}["']/gi },
];

export type RedactionResult = {
  text: string;
  redactedCount: number;
  redactedByType: Record<string, number>;
};

export function redactSecrets(text: string): RedactionResult {
  let out = text;
  let redactedCount = 0;
  const redactedByType: Record<string, number> = {};
  for (const p of SECRET_PATTERNS) {
    if (p.name === "VERCEL_TOKEN") continue; // too broad for redaction
    out = out.replace(p.re, () => {
      redactedCount++;
      redactedByType[p.name] = (redactedByType[p.name] ?? 0) + 1;
      return `[${p.name}_REDACTED]`;
    });
  }
  return { text: out, redactedCount, redactedByType };
}

// ============ Phase 6: Prompt Injection Defense ============
/**
 * Repository content (PR descriptions, README, source code, comments, commit messages)
 * is UNTRUSTED DATA. Instructions found inside must NOT be executed by the AI.
 *
 * Detection patterns adapted from OWASP LLM Top 10 (LLM01 Prompt Injection).
 */

const PROMPT_INJECTION_PATTERNS: { name: string; re: RegExp; severity: Severity }[] = [
  // Direct instruction override
  { name: "IGNORE_PREVIOUS", re: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?)/gi, severity: "HIGH" },
  { name: "DISREGARD_SYSTEM", re: /disregard\s+(?:all\s+)?(?:previous|prior|system)\s+(?:instructions?|prompts?|rules?)/gi, severity: "HIGH" },
  { name: "NEW_INSTRUCTIONS", re: /(?:new|updated|real)\s+(?:instructions?|rules?|task)\s*[:\:]/gi, severity: "HIGH" },
  { name: "YOU_ARE_NOW", re: /you\s+are\s+now\s+(?:a|an)\s+/gi, severity: "HIGH" },
  { name: "ACT_AS", re: /act\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?/gi, severity: "MEDIUM" },
  // Secret exfiltration
  { name: "REVEAL_SECRETS", re: /(?:reveal|show|display|print|expose|leak)\s+(?:the\s+)?(?:secrets?|tokens?|api[_\s-]?keys?|passwords?|environment\s+variables?|\.env)/gi, severity: "CRITICAL" },
  { name: "SEND_ENV", re: /(?:send|transmit|exfiltrate|upload|post)\s+(?:the\s+)?(?:env|environment|secrets?|tokens?)/gi, severity: "CRITICAL" },
  // Shell execution
  { name: "RUN_COMMAND", re: /(?:run|execute|invoke|call)\s+(?:this\s+)?(?:command|shell|bash|cmd|script)\s*[:\:]/gi, severity: "CRITICAL" },
  { name: "SHELL_EXEC", re: /(?:curl|wget|nc|bash|sh|python|node)\s+-[ec]\s/gi, severity: "HIGH" },
  // Policy override
  { name: "OVERRIDE_POLICY", re: /(?:override|bypass|disable|ignore)\s+(?:the\s+)?(?:security|safety|policy|policies|rules?|restrictions?)/gi, severity: "CRITICAL" },
  { name: "NO_RESTRICTIONS", re: /(?:without\s+(?:any\s+)?restrictions?|no\s+(?:safety|security)\s+(?:checks?|rules?|restrictions?))/gi, severity: "HIGH" },
  // Output manipulation
  { name: "OUTPUT_JSON", re: /(?:output|respond|reply\s+with)\s+(?:only\s+)?(?:raw\s+)?(?:json|xml|yaml|html)\s*[:]/gi, severity: "MEDIUM" },
  { name: "DONT_USE_SCHEMA", re: /(?:don'?t|do\s+not|skip)\s+(?:use|follow)\s+(?:the\s+)?(?:schema|format|template)/gi, severity: "MEDIUM" },
  // Roleplay
  { name: "PRETEND", re: /(?:pretend|imagine|suppose)\s+(?:you\s+(?:are|were)|to\s+be)/gi, severity: "LOW" },
  // Data exfiltration via URL
  { name: "EXFIL_URL", re: /(?:fetch|curl|wget|http\.get)\s*\(\s*[`"']https?:\/\/[^`"']+\?(?:data|token|secret)=/gi, severity: "CRITICAL" },
];

export type InjectionDetectionResult = {
  detected: boolean;
  patterns: { name: string; severity: Severity; evidence: string }[];
  sanitizedText: string; // text with injection patterns wrapped in [UNTRUSTED:...] markers
};

export function detectPromptInjection(text: string): InjectionDetectionResult {
  const patterns: { name: string; severity: Severity; evidence: string }[] = [];
  let sanitized = text;

  for (const p of PROMPT_INJECTION_PATTERNS) {
    const matches = text.matchAll(p.re);
    for (const m of matches) {
      patterns.push({
        name: p.name,
        severity: p.severity,
        evidence: m[0].slice(0, 80),
      });
    }
    // Wrap injection phrases in markers so the AI treats them as data
    sanitized = sanitized.replace(p.re, (match) => `[UNTRUSTED_CONTENT: ${match.slice(0, 40)}...]`);
  }

  return {
    detected: patterns.length > 0,
    patterns,
    sanitizedText: sanitized,
  };
}

/**
 * Phase 5: Full content sanitization pipeline.
 * Call this BEFORE sending any repository content to the AI.
 */
export type SanitizationResult = {
  text: string;
  redactedSecrets: number;
  injectionDetected: boolean;
  injectionPatterns: { name: string; severity: Severity; evidence: string }[];
};

export function sanitizeForAI(text: string): SanitizationResult {
  // Step 1: Redact secrets
  const redaction = redactSecrets(text);
  // Step 2: Detect and neutralize prompt injection
  const injection = detectPromptInjection(redaction.text);
  return {
    text: injection.sanitizedText,
    redactedSecrets: redaction.redactedCount,
    injectionDetected: injection.detected,
    injectionPatterns: injection.patterns,
  };
}

// ============ §30: Injection Detectors (in source code being analyzed) ============
const CODE_INJECTION_PATTERNS: { category: SecurityFinding["category"]; re: RegExp; severity: Severity; reason: string; recommendation: string }[] = [
  {
    category: "sql_injection",
    re: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\s+.*\$\{[^}]+\}/i,
    severity: "HIGH",
    reason: "Possible SQL injection — query built via string interpolation",
    recommendation: "Use parameterized queries: Prisma.$queryRaw`...` with $1, $2 placeholders",
  },
  {
    category: "command_injection",
    re: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*[`"'][^`"']*\$\{[^}]+\}/,
    severity: "HIGH",
    reason: "Possible command injection — shell command built with user input",
    recommendation: "Use execFile with an arg array, never shell strings",
  },
  {
    category: "path_traversal",
    re: /(?:readFile|writeFile|readFileSync|writeFileSync|createReadStream|createWriteStream)\s*\(\s*[^,)]*\$\{[^}]+\}/,
    severity: "HIGH",
    reason: "Possible path traversal — file path built from user input",
    recommendation: "Resolve and verify the path stays within an allowed root",
  },
  {
    category: "xss",
    re: /\.innerHTML\s*=\s*[^,)\n]+/,
    severity: "MEDIUM",
    reason: "Direct innerHTML assignment — potential XSS",
    recommendation: "Use textContent, or sanitize with DOMPurify if HTML is required",
  },
  {
    category: "xss",
    re: /dangerouslySetInnerHTML\s*=\s*{\s*__html:\s*[^}]+}/,
    severity: "MEDIUM",
    reason: "dangerouslySetInnerHTML — XSS risk if input is untrusted",
    recommendation: "Sanitize the HTML before injecting; prefer not to use this prop",
  },
  {
    category: "ssrf",
    re: /(?:fetch|axios\.(?:get|post|put|delete)|http\.get|https\.get)\s*\(\s*[`"'][^`"']*\$\{[^}]+\}/,
    severity: "MEDIUM",
    reason: "Possible SSRF — fetch URL built from user input",
    recommendation: "Validate the URL host against an allowlist before fetching",
  },
  {
    category: "injection",
    re: /\beval\s*\(/,
    severity: "HIGH",
    reason: "Use of eval() — arbitrary code execution risk",
    recommendation: "Refactor to avoid eval; use JSON.parse or a proper parser",
  },
  {
    category: "injection",
    re: /new\s+Function\s*\(/,
    severity: "HIGH",
    reason: "new Function() is equivalent to eval()",
    recommendation: "Refactor to avoid dynamic code generation",
  },
];

// ============ §31: Web Security Detectors ============
const WEB_PATTERNS: { category: SecurityFinding["category"]; re: RegExp; severity: Severity; reason: string; recommendation: string }[] = [
  {
    category: "cors",
    re: /Access-Control-Allow-Origin[":\s]*["']\*["']/i,
    severity: "MEDIUM",
    reason: "CORS allows all origins",
    recommendation: "Restrict to known origins; use env var for allowed origin list",
  },
  {
    category: "csrf",
    re: /csrf\s*[:=]\s*false|sameSite\s*[:=]\s*["']none["']/i,
    severity: "MEDIUM",
    reason: "CSRF protection disabled or SameSite=None",
    recommendation: "Enable CSRF tokens and use SameSite=Lax or Strict",
  },
  {
    category: "headers",
    re: /helmet\s*[:=]\s*false|X-Frame-Options\s*[:=]\s*["']DENY["']/i,
    severity: "LOW",
    reason: "Security headers may be missing or weakened",
    recommendation: "Use next-secure-headers or middleware to set CSP, HSTS, X-Frame-Options",
  },
  {
    category: "logging",
    re: /console\.(?:log|info|warn|error)\s*\(\s*[^)]*(?:password|token|secret|api[_-]?key|jwt)/i,
    severity: "HIGH",
    reason: "Sensitive data may be logged",
    recommendation: "Never log credentials; redact before logging",
  },
  {
    category: "upload",
    re: /(?:multer|formidable|formData)\.(?:single|array|any)\s*\(\s*["'][^"']+["']\s*\)(?![\s\S]*fileFilter)/,
    severity: "MEDIUM",
    reason: "File upload without extension/mime validation",
    recommendation: "Add fileFilter + size limits + storage outside webroot",
  },
];

// ============ §32: Scan a single line of source code ============
function scanLine(line: string, file: string, lineNum: number, added: boolean): SecurityFinding[] {
  if (!added || line.startsWith("-") || line.startsWith("@@")) return [];
  const code = line.startsWith("+") ? line.slice(1) : line;
  const findings: SecurityFinding[] = [];
  for (const p of [...CODE_INJECTION_PATTERNS, ...WEB_PATTERNS]) {
    if (p.re.test(code)) {
      findings.push({
        id: uuid(),
        file,
        line: lineNum,
        severity: p.severity,
        evidence: code.trim().slice(0, 100),
        reason: p.reason,
        recommendation: p.recommendation,
        category: p.category,
      });
    }
  }
  // Direct secret detection (CRITICAL)
  for (const sp of SECRET_PATTERNS) {
    if (sp.name === "VERCEL_TOKEN") continue;
    if (sp.re.test(code)) {
      findings.push({
        id: uuid(),
        file,
        line: lineNum,
        severity: "CRITICAL",
        evidence: "[REDACTED]",
        reason: `Hardcoded ${sp.name} detected`,
        recommendation: "Rotate immediately and move to environment variable",
        category: "secret",
      });
    }
  }
  return findings;
}

// ============ Scan a patch ============
export function scanPatch(patch: string, filename: string): SecurityFinding[] {
  const lines = patch.split("\n");
  const findings: SecurityFinding[] = [];
  let lineNum = 0;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      const m = line.match(/\+(\d+)/);
      if (m) lineNum = Number(m[1]) - 1;
      continue;
    }
    if (line.startsWith("+")) lineNum++;
    const sub = scanLine(line, filename, lineNum, line.startsWith("+"));
    findings.push(...sub);
  }
  return findings;
}

// ============ §33: Security Gate ============
export type SecurityGatePolicy = {
  CRITICAL: "block" | "warning" | "pass";
  HIGH: "block" | "warning" | "pass";
  MEDIUM: "block" | "warning" | "pass";
  LOW: "block" | "warning" | "pass";
  INFO: "block" | "warning" | "pass";
};

export const DEFAULT_SECURITY_POLICY: SecurityGatePolicy = {
  CRITICAL: "block",
  HIGH: "block",
  MEDIUM: "warning",
  LOW: "warning",
  INFO: "pass",
};

export function evaluateSecurityGate(
  findings: SecurityFinding[],
  policy: SecurityGatePolicy = DEFAULT_SECURITY_POLICY,
): { state: "PASS" | "WARNING" | "BLOCKED" | "ERROR"; blocked: SecurityFinding[]; warnings: SecurityFinding[] } {
  const blocked: SecurityFinding[] = [];
  const warnings: SecurityFinding[] = [];
  for (const f of findings) {
    const action = policy[f.severity];
    if (action === "block") blocked.push(f);
    else if (action === "warning") warnings.push(f);
  }
  const state: "PASS" | "WARNING" | "BLOCKED" | "ERROR" =
    blocked.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "PASS";
  return { state, blocked, warnings };
}

// ============ Phase 17: SSRF Protection ============
// NOTE: SSRF protection (validateExternalUrl, safeFetch) has been moved to
// lib/ssrf.ts to avoid pulling node:dns into client bundles.
// Server-side callers should import from "@/lib/ssrf" directly.
// The validateExternalUrl function below is a PURE URL validator that does
// NOT do DNS resolution — safe for both client and server.

const PRIVATE_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

const BLOCKED_HOSTS = [
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/Azure metadata
  "metadata.aws.internal",
  "169.254.170.2", // ECS metadata
];

export type UrlValidationResult = { allowed: boolean; reason: string };

export function validateExternalUrl(urlStr: string, allowlist?: string[]): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }
  // Protocol check
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: `Protocol ${url.protocol} not allowed` };
  }
  // Allowlist check (if provided)
  if (allowlist && !allowlist.includes(url.hostname)) {
    return { allowed: false, reason: `Host ${url.hostname} not in allowlist` };
  }
  // Hostname normalization — strip IPv6 brackets
  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  // Blocked hosts (metadata endpoints)
  if (BLOCKED_HOSTS.includes(hostname)) {
    return { allowed: false, reason: `Host ${hostname} is blocked (metadata endpoint)` };
  }
  // Private IPv4 check
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { allowed: false, reason: `Host ${hostname} is a private/loopback address` };
  }
  }
  // IPv6-specific checks
  if (hostname.includes(":")) {
    // IPv6 address
    if (/^::1$/.test(hostname)) return { allowed: false, reason: `IPv6 ${hostname} is loopback` };
    if (/^fc00:/i.test(hostname)) return { allowed: false, reason: `IPv6 ${hostname} is unique local` };
    if (/^fe80:/i.test(hostname)) return { allowed: false, reason: `IPv6 ${hostname} is link-local` };
    if (/^::ffff:/i.test(hostname)) {
      // IPv4-mapped IPv6 — extract and check the IPv4 part
      const ipv4 = hostname.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/i);
      if (ipv4 && PRIVATE_IP_PATTERNS.some((re) => re.test(ipv4[1]))) {
        return { allowed: false, reason: `IPv4-mapped IPv6 ${hostname} resolves to private IPv4` };
      }
    }
  }
  // Block localhost variants
  if (hostname === "localhost" || hostname === "0.0.0.0") {
    return { allowed: false, reason: `Host ${hostname} blocked` };
  }
  return { allowed: true, reason: "OK" };
}

// NOTE: safeFetch has been moved to lib/ssrf.ts (server-only).
// Server-side callers: import { safeFetchHardened } from "@/lib/ssrf";
