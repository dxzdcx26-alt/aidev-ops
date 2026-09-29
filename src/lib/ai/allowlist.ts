/**
 * AI Provider Allowlist — Phase 9
 *
 * Pure URL validation — no server-only guard, no node: imports.
 * Safe to import from tests and client components.
 */

const ALLOWED_AI_HOSTS = new Set([
  "api.z.ai",
  "api.chatglm.cn",
  "openrouter.ai",
  "api.openai.com",
  "api.deepseek.com",
  "api.anthropic.com",
]);

export type AiUrlValidation = { allowed: boolean; reason: string; normalizedUrl?: string };

export function validateAiBaseUrl(baseUrl: string): AiUrlValidation {
  if (!baseUrl || typeof baseUrl !== "string") {
    return { allowed: false, reason: "AI_BASE_URL is empty" };
  }
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { allowed: false, reason: `Invalid AI_BASE_URL: ${baseUrl}` };
  }
  // HTTPS only (per Phase 9)
  if (url.protocol !== "https:") {
    return { allowed: false, reason: `AI_BASE_URL must be HTTPS (got ${url.protocol})` };
  }
  // Hostname allowlist
  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_AI_HOSTS.has(hostname)) {
    return {
      allowed: false,
      reason: `AI_BASE_URL host "${hostname}" not in allowlist. Allowed: ${[...ALLOWED_AI_HOSTS].join(", ")}`,
    };
  }
  // Normalize — strip trailing slash
  const normalizedUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
  return { allowed: true, reason: "OK", normalizedUrl };
}
