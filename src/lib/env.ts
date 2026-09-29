/**
 * Environment configuration — SERVER-SIDE ONLY.
 * Per spec Phase 1: support all required env vars.
 * Per spec §73: never expose secrets to client.
 */

import "server-only";

export type EnvConfig = {
  github: {
    token: string | null;
    configured: boolean;
  };
  vercel: {
    token: string | null;
    teamId: string | null;
    projectId: string | null;
    configured: boolean;
  };
  ai: {
    baseUrl: string;
    apiKey: string | null;
    model: string;
    configured: boolean;
  };
  app: {
    url: string;
    environment: "development" | "staging" | "production";
  };
  maxAutoRetry: number;
  nodeEnv: string;
  // rate limits
  apiRateLimitPerMinute: number;
};

export function getEnv(): EnvConfig {
  const githubToken = process.env.GITHUB_TOKEN ?? null;
  const vercelToken = process.env.VERCEL_TOKEN ?? null;
  const aiApiKey = process.env.AI_API_KEY ?? null;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  return {
    github: {
      token: githubToken,
      configured: Boolean(githubToken),
    },
    vercel: {
      token: vercelToken,
      teamId: process.env.VERCEL_TEAM_ID ?? null,
      projectId: process.env.VERCEL_PROJECT_ID ?? null,
      configured: Boolean(vercelToken && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID),
    },
    ai: {
      baseUrl: process.env.AI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
      apiKey: aiApiKey,
      model: process.env.AI_MODEL ?? "glm-4.6",
      configured: Boolean(aiApiKey),
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      environment: (nodeEnv === "production" ? "production" : "development") as "development" | "production",
    },
    maxAutoRetry: Number(process.env.MAX_AUTO_RETRY ?? 3),
    nodeEnv,
    apiRateLimitPerMinute: Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 60),
  };
}

/**
 * Safe config to expose to the client. Strips all secrets.
 * Per spec §91: health endpoint returns this without secrets.
 */
export function getPublicEnv() {
  const env = getEnv();
  return {
    github: { configured: env.github.configured },
    vercel: { configured: env.vercel.configured },
    ai: { configured: env.ai.configured, model: env.ai.model },
    app: { url: env.app.url, environment: env.app.environment },
    maxAutoRetry: env.maxAutoRetry,
    nodeEnv: env.nodeEnv,
  };
}

/**
 * Validate a single env var. Returns CONFIGURED / MISSING / INVALID.
 * Never returns the value.
 */
export type EnvCheckStatus = "CONFIGURED" | "MISSING" | "INVALID";

export type EnvCheckResult = {
  name: string;
  status: EnvCheckStatus;
  maskedValue: string; // "********" if configured, "" if missing
  hint?: string;
};

export function checkEnvVar(name: string): EnvCheckResult {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return { name, status: "MISSING", maskedValue: "" };
  }
  // Basic format validation
  if (name.includes("URL") && !value.startsWith("http")) {
    return { name, status: "INVALID", maskedValue: "********", hint: "URL must start with http(s)://" };
  }
  if (name.includes("TOKEN") && value.length < 16) {
    return { name, status: "INVALID", maskedValue: "********", hint: "Token appears too short (<16 chars)" };
  }
  return { name, status: "CONFIGURED", maskedValue: "********" };
}

export function checkAllEnv(): EnvCheckResult[] {
  return [
    checkEnvVar("GITHUB_TOKEN"),
    checkEnvVar("AI_API_KEY"),
    checkEnvVar("AI_BASE_URL"),
    checkEnvVar("AI_MODEL"),
    checkEnvVar("VERCEL_TOKEN"),
    checkEnvVar("VERCEL_PROJECT_ID"),
    checkEnvVar("VERCEL_TEAM_ID"),
    checkEnvVar("NEXT_PUBLIC_APP_URL"),
  ];
}
