"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, RiskBadge, EmptyState } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { MergeGateResult, AIAnalysisResult, PullRequest } from "@/types";
import { GitBranch, ShieldCheck, Bot, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { v4 as uuid } from "uuid";
import { useState } from "react";

export function MergeGateView() {
  const { selectedRepo, selectedPRNumber, currentAnalysis, pushApproval, setView } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const prNum = selectedPRNumber ?? 42;
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<MergeGateResult | null>(null);

  // Fetch PR to get head sha for checks
  const prRes = useFetch<{ pullRequest: PullRequest }>(`/api/github/pr?owner=${owner}&repo=${repo}&pr=${prNum}`);

  const evaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch("/api/merge-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          ref: prRes.data?.pullRequest.head.sha ?? "HEAD",
          aiAnalysis: currentAnalysis,
          humanApproved: false,
          typecheckPassed: true,
        }),
      });
      const json = await res.json();
      setResult(json as MergeGateResult);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Merge Gate"
        subtitle={`6 gates for PR #${prNum} — all required gates must PASS before merge (Phase 8)`}
        icon={<ShieldCheck className="w-5 h-5" />}
        action={
          <Button onClick={evaluate} disabled={evaluating} size="sm">
            {evaluating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
            {evaluating ? "Evaluating…" : "Evaluate Gates"}
          </Button>
        }
      />

      {!currentAnalysis && (
        <GlassCard className="p-4 mb-4 border-warning/40">
          <p className="text-sm text-warning flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            No AI analysis yet — run analysis in the AI Console first for the AI Risk gate.
            <Button variant="link" size="sm" onClick={() => setView("ai")} className="ml-auto">Go to AI Console →</Button>
          </p>
        </GlassCard>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className={`p-4 mb-4 ${
            result.overall === "READY" ? "border-success/40"
            : result.overall === "BLOCKED" ? "border-destructive/40"
            : "border-warning/40"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {result.overall === "READY" ? <CheckCircle2 className="w-8 h-8 text-success" />
                : result.overall === "BLOCKED" ? <XCircle className="w-8 h-8 text-destructive" />
                : <Clock className="w-8 h-8 text-warning" />}
                <div>
                  <p className="text-2xl font-bold">{result.overall}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.gates.filter((g) => g.status === "PASS").length}/{result.gates.length} gates passed
                  </p>
                </div>
              </div>
              {result.overall === "READY" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    pushApproval({
                      id: `merge-${Date.now()}`,
                      type: "merge",
                      title: `Merge PR #${prNum}`,
                      description: `All 6 merge gates passed. Merge ${selectedRepo}#${prNum} into main. This is a HUMAN-ONLY action — AI cannot merge.`,
                      risk: "MEDIUM",
                      files: currentAnalysis?.files.map((f) => f.filename).slice(0, 8),
                      impact: currentAnalysis?.changedAreas,
                      expectedResult: "PR merged into main branch, deployment triggered",
                    });
                  }}
                >
                  <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                  Request Merge Approval
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-destructive font-mono text-sm">
                  <Lock className="w-4 h-4" />
                  MERGE LOCKED
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(result?.gates ?? []).map((gate, i) => (
          <motion.div key={gate.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard className={`p-4 ${
              gate.status === "PASS" ? "border-success/30"
              : gate.status === "FAIL" || gate.status === "BLOCKED" ? "border-destructive/30"
              : gate.status === "PENDING" ? "border-warning/30"
              : "border-border"
            }`}>
              <div className="flex items-start justify-between mb-2">
                <GateIcon gateId={gate.id} />
                <GateStatusBadge status={gate.status} />
              </div>
              <p className="text-sm font-semibold">{gate.label}</p>
              {gate.reason && <p className="text-xs text-muted-foreground mt-1">{gate.reason}</p>}
              {gate.required && <p className="text-[10px] font-mono text-warning mt-2">REQUIRED</p>}
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {result && result.blockingReasons.length > 0 && (
        <GlassCard className="p-4 mt-4 border-destructive/40">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Blocking Reasons
          </h3>
          <ul className="space-y-1 text-sm">
            {result.blockingReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">✗</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {!result && (
        <GlassCard className="p-12">
          <EmptyState
            title="No gate evaluation yet"
            description="Click 'Evaluate Gates' to check all 6 gates: Build, Tests, Type Check, Security, AI Risk, Human Approval."
            icon={<ShieldCheck className="w-12 h-12" />}
          />
        </GlassCard>
      )}
    </div>
  );
}

function GateIcon({ gateId }: { gateId: string }) {
  const cls = "w-5 h-5 text-primary";
  switch (gateId) {
    case "build": return <ShieldCheck className={cls} />;
    case "tests": return <CheckCircle2 className={cls} />;
    case "typecheck": return <Bot className={cls} />;
    case "security": return <ShieldCheck className={cls} />;
    case "ai_risk": return <Bot className={cls} />;
    case "human_approval": return <Lock className={cls} />;
    default: return <Clock className={cls} />;
  }
}

function GateStatusBadge({ status }: { status: string }) {
  const cls = {
    PASS: "bg-success/15 text-success border-success/30",
    FAIL: "bg-destructive/15 text-destructive border-destructive/30",
    BLOCKED: "bg-destructive/15 text-destructive border-destructive/30",
    PENDING: "bg-warning/15 text-warning border-warning/30",
    SKIPPED: "bg-muted text-muted-foreground border-border",
  }[status as keyof typeof cls] ?? "bg-muted text-muted-foreground border-border";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${cls}`}>{status}</span>;
}
