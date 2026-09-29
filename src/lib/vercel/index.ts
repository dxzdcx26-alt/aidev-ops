/**
 * Vercel Client — Phase 10 (Live Deployment) + Production §55-67
 *
 * Server-side only. VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID.
 * Falls back to mock deployments when token is missing (clearly labeled).
 *
 * Production features:
 *   - Structured errors (Phase 10)
 *   - Timeout: 30s for status, 10s for create
 *   - Retry: only for GET operations
 *   - requestId for tracing
 *   - Per spec §10: "ห้ามแสดงว่า deployment สำเร็จ จนกว่าจะ verify จริง"
 */

import "server-only";
import { getEnv } from "@/lib/env";
import { StructuredError, vercelError, networkError, withRetry, withTimeout } from "@/lib/errors";
import { v4 as uuid } from "uuid";
import type { Deployment, DeploymentStatus } from "@/types";

const VERCEL_API = "https://api.vercel.com";
const TIMEOUT_MS = 30000;

async function vercelFetch<T>(path: string, init?: RequestInit & { requestId?: string }): Promise<T> {
  const env = getEnv();
  const requestId = (init as { requestId?: string })?.requestId ?? uuid();
  if (!env.vercel.configured) {
    throw new StructuredError({
      code: "VERCEL_NOT_CONFIGURED",
      message: "VERCEL_TOKEN not configured",
      status: 0,
      provider: "vercel",
      retryable: false,
      requestId,
    });
  }
  const url = new URL(`${VERCEL_API}${path}`);
  if (env.vercel.teamId) url.searchParams.set("teamId", env.vercel.teamId);

  const method = init?.method ?? "GET";
  const isMutation = method !== "GET";

  const doFetch = async (): Promise<T> => {
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        Authorization: `Bearer ${env.vercel.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw vercelError(res.status, text, requestId);
    }
    return res.json() as Promise<T>;
  };

  const withTimeoutPromise = withTimeout(doFetch(), TIMEOUT_MS, "vercel", requestId);
  if (isMutation) return withTimeoutPromise;
  return withRetry(() => withTimeoutPromise, {
    maxAttempts: 3,
    baseDelayMs: 500,
    isRetryable: (err) => err instanceof StructuredError && err.retryable,
  });
}

type VercelDeployment = {
  uid: string;
  url?: string;
  readyState: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED" | "INITIALIZING";
  target: "production" | "preview" | "staging" | null;
  meta: { framework?: string; packageName?: string };
  createdAt: number;
  readyAt?: number;
  buildingAt?: number;
  inspectorUrl?: string;
  source: string;
  commit: string;
  branch: string;
  name: string;
};

function mapState(s: VercelDeployment["readyState"]): DeploymentStatus {
  if (s === "INITIALIZING" || s === "QUEUED") return "QUEUED";
  if (s === "BUILDING") return "BUILDING";
  if (s === "READY") return "READY";
  if (s === "ERROR") return "ERROR";
  if (s === "CANCELED") return "CANCELED";
  return "QUEUED";
}

function toDeployment(d: VercelDeployment): Deployment {
  return {
    id: d.uid,
    uid: d.uid,
    url: d.url ? `https://${d.url}` : null,
    state: mapState(d.readyState),
    target: (d.target ?? "preview") as "production" | "preview" | "staging",
    branch: d.branch,
    commitSha: d.commit?.slice(0, 7) ?? "unknown",
    commitMessage: d.source ?? "",
    createdAt: new Date(d.createdAt).toISOString(),
    readyAt: d.readyAt ? new Date(d.readyAt).toISOString() : null,
    buildingDurationMs: d.readyAt && d.buildingAt ? d.readyAt - d.buildingAt : null,
    inspectorUrl: d.inspectorUrl ?? null,
    meta: d.meta,
  };
}

export async function listDeployments(limit = 20): Promise<{ deployments: Deployment[]; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    return { deployments: [], mock: false };
  }
  const data = await vercelFetch<{ deployments: VercelDeployment[] }>(`/v6/deployments?limit=${limit}${env.vercel.projectId ? `&projectId=${env.vercel.projectId}` : ""}`);
  return { deployments: data.deployments.map(toDeployment), mock: false };
}

export async function getDeployment(id: string): Promise<{ deployment: Deployment; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    throw new StructuredError({ code: "VERCEL_NOT_CONFIGURED", message: "VERCEL_TOKEN not configured", status: 401, provider: "vercel", retryable: false });
  }
  const data = await vercelFetch<VercelDeployment>(`/v13/deployments/${id}`);
  return { deployment: toDeployment(data), mock: false };
}

export async function createDeployment(opts: {
  ref: string;
  sha?: string;
  target?: "production" | "preview";
  projectOverrides?: Record<string, unknown>;
}): Promise<{ deployment: Deployment; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    throw new StructuredError({ code: "VERCEL_NOT_CONFIGURED", message: "VERCEL_TOKEN not configured", status: 401, provider: "vercel", retryable: false });
  }
  const body: Record<string, unknown> = {
    name: env.vercel.projectId ?? "ai-dev-control-center",
    ref: opts.ref,
    target: opts.target ?? "preview",
  };
  if (opts.sha) body.sha = opts.sha;
  if (env.vercel.projectId) body.project = env.vercel.projectId;
  if (opts.projectOverrides) Object.assign(body, opts.projectOverrides);

  const data = await vercelFetch<VercelDeployment>(`/v13/deployments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { deployment: toDeployment(data), mock: false };
}

/**
 * Phase 12: Rollback — promote a previous READY deployment to production.
 * Per spec §12: "ห้าม rollback ไป deployment ที่ไม่ healthy"
 */
export async function rollbackDeployment(redeploymentId: string): Promise<{ deployment: Deployment; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    throw new StructuredError({ code: "VERCEL_NOT_CONFIGURED", message: "VERCEL_TOKEN not configured", status: 401, provider: "vercel", retryable: false });
  }
    // Real Vercel: verify target deployment is READY before promoting
  const targetCheck = await getDeployment(redeploymentId);
  if (targetCheck.deployment.state !== "READY") {
    throw new StructuredError({
      code: "VERCEL_VALIDATION",
      message: `Cannot rollback — target deployment ${redeploymentId} state is ${targetCheck.deployment.state}, must be READY (healthy)`,
      status: 422,
      provider: "vercel",
      retryable: false,
    });
  }
  const data = await vercelFetch<VercelDeployment>(`/v13/deployments/${redeploymentId}/promote`, {
    method: "POST",
  });
  return { deployment: toDeployment(data), mock: false };
}

/**
 * Phase 12: Find the most recent READY deployment for rollback target.
 */
export async function findRollbackTarget(excludeId?: string): Promise<{ deployment: Deployment | null; mock: boolean }> {
  const { deployments, mock } = await listDeployments(20);
  const ready = deployments.find((d) => d.state === "READY" && d.id !== excludeId);
  return { deployment: ready ?? null, mock };
}

export async function getDeploymentLogs(id: string): Promise<{ logs: string[]; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    throw new StructuredError({ code: "VERCEL_NOT_CONFIGURED", message: "VERCEL_TOKEN not configured", status: 401, provider: "vercel", retryable: false });
  }
  const data = await vercelFetch<{ logs: { message: string; created: number }[] }>(`/v2/deployments/${id}/logs`);
  return { logs: data.logs.map((l) => l.message), mock: false };
}

export async function listDomains(): Promise<{ domains: { name: string; verified: boolean }[]; mock: boolean }> {
  const env = getEnv();
  if (!env.vercel.configured) {
    return { domains: [], mock: false };
  }
  const data = await vercelFetch<{ domains: { name: string; verified: boolean }[] }>(`/v9/projects/${env.vercel.projectId}/domains`);
  return { domains: data.domains ?? [], mock: false };
}

export { networkError };
