"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, RiskBadge, EmptyState } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { MergeGateResult, AIAnalysisResult, PullRequest, ApprovalRecord } from "@/types";
import { ShieldCheck, Key, Bot, Rocket, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type EnvCheckResult = {
  variables: { name: string; status: "CONFIGURED" | "MISSING" | "INVALID"; maskedValue: string; hint?: string }[];
  summary: { github: string; ai: string; vercel: string; appUrl: string; environment: string };
};

type ReadinessResult = {
  overall: "READY" | "NOT READY" | "DEGRADED";
  checks: { id: string; label: string; status: "PASS" | "FAIL" | "WARN" | "SKIP"; reason?: string }[];
};

export function ProductionReadinessView() {
  const envCheck = useFetch<EnvCheckResult>("/api/env-check");
  const readiness = useFetch<ReadinessResult>("/api/production-readiness");

  return (
    <div>
      <PageHeader
        title="Production Readiness"
        subtitle="Phase 28-29 · Environment checker + readiness checklist"
        icon={<FileCheck className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { envCheck.refetch(); readiness.refetch(); }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Re-check
            </Button>
          </div>
        }
      />

      {/* Overall status */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <GlassCard className={`p-5 ${
          readiness.data?.overall === "READY" ? "border-success/40"
          : readiness.data?.overall === "DEGRADED" ? "border-warning/40"
          : "border-destructive/40"
        }`} glow={readiness.data?.overall === "READY" ? "blue" : "none"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {readiness.data?.overall === "READY" ? <CheckCircle2 className="w-10 h-10 text-success" />
              : readiness.data?.overall === "DEGRADED" ? <AlertTriangle className="w-10 h-10 text-warning" />
              : <XCircle className="w-10 h-10 text-destructive" />}
              <div>
                <p className="text-3xl font-bold">{readiness.data?.overall ?? "…"}</p>
                <p className="text-sm text-muted-foreground">
                  {readiness.data?.overall === "READY"
                    ? "All systems configured — production deployment is fully functional"
                    : readiness.data?.overall === "DEGRADED"
                    ? "Some integrations missing — system runs in mock/fallback mode"
                    : "Critical checks failed — production deployment not recommended"}
                </p>
              </div>
            </div>
            <div className="text-right text-xs font-mono text-muted-foreground">
              <p>{readiness.data?.checks.filter((c) => c.status === "PASS").length ?? 0} PASS</p>
              <p>{readiness.data?.checks.filter((c) => c.status === "WARN").length ?? 0} WARN</p>
              <p>{readiness.data?.checks.filter((c) => c.status === "FAIL").length ?? 0} FAIL</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Readiness checklist */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            Readiness Checklist (Phase 29)
          </h3>
          <div className="space-y-1.5">
            {readiness.data?.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                {check.status === "PASS" ? <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                : check.status === "WARN" ? <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                : check.status === "FAIL" ? <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                : <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{check.label}</p>
                  {check.reason && <p className="text-xs text-muted-foreground mt-0.5">{check.reason}</p>}
                </div>
                <span className={`text-[10px] font-mono uppercase ${
                  check.status === "PASS" ? "text-success"
                  : check.status === "WARN" ? "text-warning"
                  : check.status === "FAIL" ? "text-destructive"
                  : "text-muted-foreground"
                }`}>{check.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Environment checker (Phase 28) */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Environment Checker (Phase 28)
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3 font-mono">
            Per spec §28: values are masked — never displayed.
          </p>
          <div className="space-y-1.5">
            {envCheck.data?.variables.map((v) => (
              <div key={v.name} className="flex items-center gap-3 p-2 rounded-md bg-muted/20">
                <code className="text-xs font-mono flex-1">{v.name}</code>
                {v.status === "CONFIGURED" ? (
                  <span className="text-success font-mono text-xs">✓ {v.maskedValue}</span>
                ) : v.status === "MISSING" ? (
                  <span className="text-warning font-mono text-xs">⚠ MISSING</span>
                ) : (
                  <span className="text-destructive font-mono text-xs">✗ INVALID</span>
                )}
              </div>
            ))}
            {envCheck.data?.variables.some((v) => v.hint) && (
              <div className="mt-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-[11px] text-warning">
                {envCheck.data.variables.filter((v) => v.hint).map((v) => (
                  <p key={v.name}>• {v.name}: {v.hint}</p>
                ))}
              </div>
            )}
          </div>

          {envCheck.data?.summary && (
            <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
              <SystemStatusCard label="GitHub" status={envCheck.data.summary.github} />
              <SystemStatusCard label="AI" status={envCheck.data.summary.ai} />
              <SystemStatusCard label="Vercel" status={envCheck.data.summary.vercel} />
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Phase 16: Mock/Fallback Policy</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Per spec §16: Mock/Fallback is allowed ONLY when credentials are missing or API unavailable. The system never pretends mock data is real.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-md bg-muted/30">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">When MOCK</p>
            <p className="mt-1">UI shows <code className="text-warning">MOCK</code> badge. No privileged actions execute.</p>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">When FALLBACK</p>
            <p className="mt-1">UI shows <code className="text-warning">FALLBACK</code> badge. Baseline analyzer runs (no AI call).</p>
          </div>
          <div className="p-2 rounded-md bg-muted/30">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">When LIVE</p>
            <p className="mt-1">UI shows <code className="text-success">LIVE</code> badge. Real API calls, real audit trail.</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function SystemStatusCard({ label, status }: { label: string; status: string }) {
  const isConfigured = status === "CONFIGURED";
  return (
    <div className={`p-2 rounded-md border ${isConfigured ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"}`}>
      <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
      <p className={`text-xs font-mono font-bold ${isConfigured ? "text-success" : "text-warning"}`}>
        {isConfigured ? "LIVE" : "MOCK"}
      </p>
    </div>
  );
}
