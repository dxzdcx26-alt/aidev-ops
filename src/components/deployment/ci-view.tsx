"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, EmptyState } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { Workflow, WorkflowRun } from "@/types";
import { Workflow as WorkflowIcon, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Play, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function CIView() {
  const { selectedRepo, selectedBranch } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const branch = selectedBranch ?? "feat/ai-engine";
  const { data, loading, mock, refetch } = useFetch<{ workflows: Workflow[]; runs: WorkflowRun[] }>(
    `/api/github/workflows?owner=${owner}&repo=${repo}&branch=${branch}`,
  );

  const passing = data?.runs.filter((r) => r.conclusion === "success").length ?? 0;
  const failing = data?.runs.filter((r) => r.conclusion === "failure").length ?? 0;
  const running = data?.runs.filter((r) => r.status === "in_progress" || r.status === "queued").length ?? 0;

  return (
    <div>
      <PageHeader
        title="CI / CD"
        subtitle={`Workflows on ${branch} · V4 §45-50`}
        icon={<WorkflowIcon className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            {mock ? <MockBadge /> : <RealBadge />}
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold text-success">{passing}</span>
          </div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Passing</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-2xl font-bold text-destructive">{failing}</span>
          </div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Failing</p>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold text-info">{running}</span>
          </div>
          <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">In progress</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workflows */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3">Workflows (V4 §46)</h3>
          <div className="space-y-2">
            {data?.workflows.map((w) => (
              <div key={w.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                <WorkflowIcon className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{w.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{w.path}</p>
                </div>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${w.state === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {w.state}
                </span>
              </div>
            ))}
            {data && data.workflows.length === 0 && <EmptyState title="No workflows" icon={<WorkflowIcon className="w-8 h-8" />} />}
          </div>
        </GlassCard>

        {/* Recent runs */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Runs (V4 §47-49)</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data?.runs.map((run, i) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-2 rounded-md bg-muted/30 flex items-center gap-2"
              >
                {run.status === "completed" ? (
                  run.conclusion === "success" ? <CheckCircle2 className="w-4 h-4 text-success" />
                  : run.conclusion === "failure" ? <XCircle className="w-4 h-4 text-destructive" />
                  : <AlertTriangle className="w-4 h-4 text-warning" />
                ) : <RefreshCw className="w-4 h-4 text-info animate-spin" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{run.name}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <GitBranch className="w-2.5 h-2.5" /> {run.head_branch}
                    <span>#{run.run_number}</span>
                    <span>{run.event}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </motion.div>
            ))}
            {data && data.runs.length === 0 && <EmptyState title="No runs" icon={<Play className="w-8 h-8" />} />}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Test Engine Coverage (V4 §48)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {["TypeScript", "ESLint", "Unit", "Integration", "E2E", "Build", "Security Scan"].map((t) => (
            <div key={t} className="p-2 rounded-md bg-muted/30 text-center">
              <p className="text-[10px] font-mono uppercase">{t}</p>
              <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-success" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
