/**
 * Structured Errors — Production spec §74 (Error System), §75 (Observability)
 *
 * Every external API failure produces a StructuredError with:
 *   - code: machine-readable error code
 *   - message: human-readable message (no secrets)
 *   - status: HTTP status (or 0 for network errors)
 *   - retryable: whether retry is safe (NEVER for mutations without idempotency)
 *   - requestId: correlation ID for tracing
 *   - provider: which external system failed
 */

import { v4 as uuid } from "uuid";

export type ErrorCode =
  // Auth
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_TOKEN"
  | "AUTH_PERMISSION_DENIED"
  // GitHub
  | "GITHUB_UNAUTHORIZED"
  | "GITHUB_FORBIDDEN"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_CONFLICT"
  | "GITHUB_VALIDATION"
  | "GITHUB_SERVER_ERROR"
  | "GITHUB_NETWORK"
  | "GITHUB_TIMEOUT"
  // AI
  | "AI_UNAUTHORIZED"
  | "AI_RATE_LIMIT"
  | "AI_TIMEOUT"
  | "AI_INVALID_RESPONSE"
  | "AI_SCHEMA_VALIDATION"
  | "AI_SERVER_ERROR"
  | "AI_NETWORK"
  | "AI_NOT_CONFIGURED"
  // Vercel
  | "VERCEL_UNAUTHORIZED"
  | "VERCEL_NOT_FOUND"
  | "VERCEL_RATE_LIMIT"
  | "VERCEL_VALIDATION"
  | "VERCEL_SERVER_ERROR"
  | "VERCEL_NETWORK"
  | "VERCEL_NOT_CONFIGURED"
  // Generic
  | "NETWORK"
  | "TIMEOUT"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL"
  | "MOCK_FALLBACK";

export type ErrorProvider = "github" | "ai" | "vercel" | "internal" | "verify";

export class StructuredError extends Error {
  code: ErrorCode;
  status: number;
  retryable: boolean;
  requestId: string;
  provider: ErrorProvider;
  cause?: unknown;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    provider?: ErrorProvider;
    requestId?: string;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "StructuredError";
    this.code = opts.code;
    this.status = opts.status ?? 0;
    this.retryable = opts.retryable ?? false;
    this.provider = opts.provider ?? "internal";
    this.requestId = opts.requestId ?? uuid();
    this.cause = opts.cause;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
      provider: this.provider,
      requestId: this.requestId,
    };
  }
}

// ============ Factory helpers ============

export function githubError(status: number, body: string, requestId?: string): StructuredError {
  const reqId = requestId ?? uuid();
  switch (status) {
    case 401:
      return new StructuredError({
        code: "GITHUB_UNAUTHORIZED",
        message: "GitHub token is invalid or expired",
        status: 401,
        provider: "github",
        retryable: false,
        requestId: reqId,
      });
    case 403: {
      // Could be rate limit or permission
      const isRateLimit = body.includes("rate limit") || body.includes("secondary rate limit");
      if (isRateLimit) {
        return new StructuredError({
          code: "GITHUB_RATE_LIMIT",
          message: "GitHub API rate limit exceeded — see X-RateLimit-Reset header",
          status: 403,
          provider: "github",
          retryable: true, // safe to retry after backoff
          requestId: reqId,
        });
      }
      return new StructuredError({
        code: "GITHUB_FORBIDDEN",
        message: "GitHub token lacks required scope for this resource",
        status: 403,
        provider: "github",
        retryable: false,
        requestId: reqId,
      });
    }
    case 404:
      return new StructuredError({
        code: "GITHUB_NOT_FOUND",
        message: "GitHub resource not found",
        status: 404,
        provider: "github",
        retryable: false,
        requestId: reqId,
      });
    case 409:
      return new StructuredError({
        code: "GITHUB_CONFLICT",
        message: "GitHub conflict — resource already exists or state mismatch",
        status: 409,
        provider: "github",
        retryable: false, // never auto-retry mutations
        requestId: reqId,
      });
    case 422:
      return new StructuredError({
        code: "GITHUB_VALIDATION",
        message: `GitHub validation error: ${body.slice(0, 200)}`,
        status: 422,
        provider: "github",
        retryable: false,
        requestId: reqId,
      });
    case 429:
      return new StructuredError({
        code: "GITHUB_RATE_LIMIT",
        message: "GitHub API rate limit exceeded",
        status: 429,
        provider: "github",
        retryable: true,
        requestId: reqId,
      });
    default:
      if (status >= 500) {
        return new StructuredError({
          code: "GITHUB_SERVER_ERROR",
          message: `GitHub server error ${status}`,
          status,
          provider: "github",
          retryable: true, // safe for read-only
          requestId: reqId,
        });
      }
      return new StructuredError({
        code: "GITHUB_NETWORK",
        message: `GitHub network error ${status}`,
        status,
        provider: "github",
        retryable: false,
        requestId: reqId,
      });
  }
}

export function aiError(status: number, body: string, requestId?: string): StructuredError {
  const reqId = requestId ?? uuid();
  switch (status) {
    case 401:
    case 403:
      return new StructuredError({
        code: "AI_UNAUTHORIZED",
        message: "AI provider rejected the API key",
        status,
        provider: "ai",
        retryable: false,
        requestId: reqId,
      });
    case 429:
      return new StructuredError({
        code: "AI_RATE_LIMIT",
        message: "AI provider rate limit hit",
        status: 429,
        provider: "ai",
        retryable: true,
        requestId: reqId,
      });
    default:
      if (status >= 500) {
        return new StructuredError({
          code: "AI_SERVER_ERROR",
          message: `AI provider server error ${status}`,
          status,
          provider: "ai",
          retryable: true,
          requestId: reqId,
        });
      }
      return new StructuredError({
        code: "AI_NETWORK",
        message: `AI network error ${status}: ${body.slice(0, 100)}`,
        status,
        provider: "ai",
        retryable: false,
        requestId: reqId,
      });
  }
}

export function vercelError(status: number, body: string, requestId?: string): StructuredError {
  const reqId = requestId ?? uuid();
  switch (status) {
    case 401:
    case 403:
      return new StructuredError({
        code: "VERCEL_UNAUTHORIZED",
        message: "Vercel token invalid or lacks scope",
        status,
        provider: "vercel",
        retryable: false,
        requestId: reqId,
      });
    case 404:
      return new StructuredError({
        code: "VERCEL_NOT_FOUND",
        message: "Vercel resource not found",
        status: 404,
        provider: "vercel",
        retryable: false,
        requestId: reqId,
      });
    case 429:
      return new StructuredError({
        code: "VERCEL_RATE_LIMIT",
        message: "Vercel API rate limit hit",
        status: 429,
        provider: "vercel",
        retryable: true,
        requestId: reqId,
      });
    default:
      if (status >= 500) {
        return new StructuredError({
          code: "VERCEL_SERVER_ERROR",
          message: `Vercel server error ${status}`,
          status,
          provider: "vercel",
          retryable: true,
          requestId: reqId,
        });
      }
      return new StructuredError({
        code: "VERCEL_NETWORK",
        message: `Vercel network error ${status}`,
        status,
        provider: "vercel",
        retryable: false,
        requestId: reqId,
      });
  }
}

export function timeoutError(provider: ErrorProvider, ms: number, requestId?: string): StructuredError {
  return new StructuredError({
    code: provider === "github" ? "GITHUB_TIMEOUT" : provider === "ai" ? "AI_TIMEOUT" : "TIMEOUT",
    message: `${provider} request timed out after ${ms}ms`,
    status: 0,
    provider,
    retryable: true,
    requestId: requestId ?? uuid(),
  });
}

export function networkError(provider: ErrorProvider, err: unknown, requestId?: string): StructuredError {
  return new StructuredError({
    code: provider === "github" ? "GITHUB_NETWORK" : provider === "ai" ? "AI_NETWORK" : provider === "vercel" ? "VERCEL_NETWORK" : "NETWORK",
    message: err instanceof Error ? err.message : String(err),
    status: 0,
    provider,
    retryable: true,
    requestId: requestId ?? uuid(),
    cause: err,
  });
}

// ============ Retry helper (safe — only for read operations) ============

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    isRetryable?: (err: unknown) => boolean;
    onRetry?: (err: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;
  const maxDelay = opts.maxDelayMs ?? 5000;
  const isRetryable = opts.isRetryable ?? ((err) => err instanceof StructuredError && err.retryable);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) break;
      // Exponential backoff with jitter
      const exp = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.random() * baseDelay;
      const delay = exp + jitter;
      opts.onRetry?.(err, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ============ Timeout helper ============

export function withTimeout<T>(fn: Promise<T>, ms: number, provider: ErrorProvider, requestId?: string): Promise<T> {
  return Promise.race([
    fn,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(timeoutError(provider, ms, requestId)), ms);
    }),
  ]);
}
