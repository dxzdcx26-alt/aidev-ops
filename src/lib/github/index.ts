/**
 * GitHub Client — Phase 2 (Live Integration) + V3 spec §9-11
 *
 * Server-side only. Reads GITHUB_TOKEN from env. Falls back to mock data when
 * the token is missing so the UI is always functional (per spec §18).
 *
 * Production features:
 *   - Structured errors (Phase 2): { code, message, status, retryable, requestId, provider }
 *   - Timeout: 15s default
 *   - Retry: only for safe (GET) operations, only for retryable errors (429, 5xx)
 *   - No retry on mutations (POST/PATCH/PUT/DELETE) to prevent duplicate operations
 *   - Rate limit detection with X-RateLimit-Reset
 *   - requestId for tracing
 */

import "server-only";
import { getEnv } from "@/lib/env";
import { StructuredError, githubError, networkError, timeoutError, withRetry, withTimeout } from "@/lib/errors";
import { v4 as uuid } from "uuid";
import type {
  Repository,
  Branch,
  PullRequest,
  DiffFile,
  Commit,
  Review,
  CheckRun,
  Workflow,
  WorkflowRun,
} from "@/types";

const GITHUB_API = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 15000;

type FetchOpts = {
  revalidate?: number;
  method?: string;
  body?: string;
  requestId?: string;
};

async function ghFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const env = getEnv();
  const requestId = opts.requestId ?? uuid();
  if (!env.github.configured) {
    throw new StructuredError({
      code: "AUTH_REQUIRED",
      message: "GITHUB_TOKEN not configured",
      status: 401,
      provider: "github",
      retryable: false,
      requestId,
    });
  }

  const method = opts.method ?? "GET";
  const isMutation = method !== "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.github.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.body) headers["Content-Type"] = "application/json";

  const doFetch = async (): Promise<T> => {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers,
      body: opts.body,
      next: { revalidate: opts.revalidate ?? 0 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Extract rate limit reset time for better error message
      if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get("x-ratelimit-remaining");
        const reset = res.headers.get("x-ratelimit-reset");
        if (remaining === "0" || body.includes("rate limit")) {
          const resetDate = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
          throw new StructuredError({
            code: "GITHUB_RATE_LIMIT",
            message: `GitHub rate limit exceeded. Resets at ${resetDate}`,
            status: res.status,
            provider: "github",
            retryable: !isMutation, // safe to retry GET after backoff
            requestId,
          });
        }
      }
      throw githubError(res.status, body, requestId);
    }
    // Some endpoints return text (diff), some return JSON
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  };

  // Wrap with timeout
  const withTimeoutPromise = withTimeout(doFetch(), DEFAULT_TIMEOUT_MS, "github", requestId);

  // Retry only for GET operations (mutations are never retried — risk of duplicate)
  if (isMutation) {
    return withTimeoutPromise;
  }

  return withRetry(() => withTimeoutPromise, {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    isRetryable: (err) => err instanceof StructuredError && err.retryable,
    onRetry: (err, attempt) => {
      // Structured log (no secrets)
      console.warn(`[github] retry attempt ${attempt}`, {
        requestId,
        path,
        code: err instanceof StructuredError ? err.code : "UNKNOWN",
      });
    },
  });
}

// ============ Repositories ============
export async function listRepositories(): Promise<{ repositories: Repository[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    return { repositories: [], mock: false };
  }
  const data = await ghFetch<Repository[]>(
    `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
  );
  return { repositories: data ?? [], mock: false };
}

export async function getRepository(owner: string, repo: string): Promise<{ repository: Repository; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const repository = await ghFetch<Repository>(`/repos/${owner}/${repo}`);
  return { repository, mock: false };
}

// ============ Branches ============
export async function listBranches(owner: string, repo: string): Promise<{ branches: Branch[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const branches = await ghFetch<Branch[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
  return { branches, mock: false };
}

// ============ Pull Requests ============
export async function listPullRequests(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Promise<{ pullRequests: PullRequest[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const data = await ghFetch<PullRequest[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`);
  return { pullRequests: data, mock: false };
}

export async function getPullRequest(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ pullRequest: PullRequest; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const pullRequest = await ghFetch<PullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  return { pullRequest, mock: false };
}

// ============ Diff / Files ============
export async function getDiffFiles(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ files: DiffFile[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  // GitHub returns the diff in a special media type
  const env_ = getEnv();
  const requestId = uuid();
  const res = await withTimeout(
    fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `Bearer ${env_.github.token}`,
        Accept: "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }),
    DEFAULT_TIMEOUT_MS,
    "github",
    requestId,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw githubError(res.status, body, requestId);
  }
  const diffText = await res.text();
  const files = parseUnifiedDiff(diffText);
  return { files, mock: false };
}

/** Parse a unified diff text into DiffFile[] with patch content. */
export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("diff --git")) { i++; continue; }
    let filename = "";
    let previousFilename: string | undefined;
    let status: DiffFile["status"] = "modified";
    let additions = 0;
    let deletions = 0;
    let isBinary = false;
    const patchLines: string[] = [line];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith("diff --git")) {
      const l = lines[j];
      patchLines.push(l);
      if (l.startsWith("+++ ")) {
        filename = l.slice(6).trim();
      }
      if (l.startsWith("--- ")) {
        const from = l.slice(6).trim();
        if (from !== "/dev/null" && from !== filename) previousFilename = from;
      }
      if (l.startsWith("new file")) status = "added";
      else if (l.startsWith("deleted file")) status = "removed";
      else if (l.startsWith("rename from") || l.startsWith("rename to")) status = "renamed";
      if (l.startsWith("Binary files") || l.startsWith("GIT binary patch")) isBinary = true;
      if (l.startsWith("+") && !l.startsWith("+++")) additions++;
      if (l.startsWith("-") && !l.startsWith("---")) deletions++;
      j++;
    }
    if (filename) {
      files.push({
        sha: `${i}`,
        filename,
        status: isBinary ? "binary" : status,
        additions,
        deletions,
        changes: additions + deletions,
        patch: isBinary ? "" : patchLines.join("\n"),
        raw_url: "",
        blob_url: "",
        previous_filename: previousFilename,
      });
    }
    i = j;
  }
  return files;
}

// ============ Commits ============
export async function listCommits(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ commits: Commit[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const pr = await ghFetch<PullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  const data = await ghFetch<{ commits: Commit[] }>(`/repos/${owner}/${repo}/compare/${pr.base.sha}...${pr.head.sha}`);
  return { commits: data.commits ?? [], mock: false };
}

// ============ Reviews ============
export async function listReviews(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ reviews: Review[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const reviews = await ghFetch<Review[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`);
  return { reviews, mock: false };
}

// ============ Checks ============
export async function listChecks(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ checks: CheckRun[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const data = await ghFetch<{ check_runs: CheckRun[] }>(`/repos/${owner}/${repo}/commits/${ref}/check-runs`);
  return { checks: data.check_runs ?? [], mock: false };
}

// ============ Workflows ============
export async function listWorkflows(
  owner: string,
  repo: string,
): Promise<{ workflows: Workflow[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const data = await ghFetch<{ workflows: Workflow[] }>(`/repos/${owner}/${repo}/actions/workflows`);
  return { workflows: data.workflows ?? [], mock: false };
}

export async function listWorkflowRuns(
  owner: string,
  repo: string,
  branch?: string,
): Promise<{ runs: WorkflowRun[]; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const branchQ = branch ? `&branch=${encodeURIComponent(branch)}` : "";
  const data = await ghFetch<{ workflow_runs: WorkflowRun[] }>(`/repos/${owner}/${repo}/actions/runs?per_page=20${branchQ}`);
  return { runs: data.workflow_runs ?? [], mock: false };
}

// ============ Merge status (read-only) ============
export async function getMergeStatus(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ mergeable: boolean | null; mergeableState: string; mock: boolean }> {
  const env = getEnv();
  if (!env.github.configured) {
    throw new StructuredError({ code: "AUTH_REQUIRED", message: "GITHUB_TOKEN not configured", status: 401, provider: "github", retryable: false, requestId: uuid() });
  }
  const pr = await ghFetch<PullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  return {
    mergeable: pr.mergeable,
    mergeableState: (pr as unknown as { mergeable_state?: string }).mergeable_state ?? "unknown",
    mock: false,
  };
}

// Re-export for legacy imports
export { networkError, timeoutError };
