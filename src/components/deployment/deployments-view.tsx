"use client";

import { useStore, type PendingApproval } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, EmptyState } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { Deployment, DeploymentVerification } from "@/types";
import { Rocket, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink, RotateCcw, Play, Eye, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { v4 as uuid } from "uuid";
import { useState } from "react";

export function DeploymentsView() {
  const { selectedRepo, selectedBranch, mockMode, pushApproval, addAudit, verifications, setVerification } = useStore();
  const { data, loading, mock, refetch } = useFetch<{ deployments: Deployment[] }>("/api/vercel/deployments");
  const [verifying, setVerifying] = useState<string | null>(null);

  const handleDeploy = () => {
    const approval: PendingApproval = {
      id: `deploy-${Date.now()}`,
      type: "deploy",
      title: `Deploy ${selectedBranch} to production`,
      description: `Production deployment for ${selectedRepo}. Branch: ${selectedBranch}. Per spec §57, the deploy flow runs: GitHub check → Branch check → CI check → Security → AI review → Vercel deploy → Verify.`,
      risk: "HIGH",
      impact: ["infrastructure", "frontend", "backend", "api"],
      expectedResult: "Vercel production deployment created and verified via browser agent",
      payload: { ref: selectedBranch, target: "production" },
    };
    pushApproval(approval);
  };

  const handleRollback = (dep: Deployment) => {
    const approval: PendingApproval = {
      id: `rollback-${Date.now()}`,
      type: "rollback",
      title: `Rollback to ${dep.commitSha}`,
      description: `Promote previous deployment ${dep.id} (${dep.commitMessage}). Per spec §66, rollback requires human approval and is never silent.`,
      risk: "HIGH",
      expectedResult: `Production traffic rerouted to ${dep.url ?? dep.id}`,
      payload: { id: dep.id },
    };
    pushApproval(approval);
  };

  const handleVerify = async (dep: Deployment) => {
    if (!dep.url) return;
    setVerifying(dep.id);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dep.url, deploymentId: dep.id }),
      });
      const json = await res.json();
      setVerification(dep.id, json.verification as DeploymentVerification);
      addAudit({
        id: uuid(),
        timestamp: new Date().toISOString(),
        actor: "browser-verification",
        action: "VERIFY",
        status: json.verification.smokeTestPassed ? "success" : "failure",
        target: dep.id,
        metadata: { httpStatus: json.verification.httpStatus, consoleErrors: json.verification.consoleErrors.length },
        detail: `Verify ${dep.id}: HTTP ${json.verification.httpStatus}, ${json.verification.consoleErrors.length} console errors`,
      });
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Deployments"
        subtitle="Vercel integration · Production spec §55-67"
        icon={<Rocket className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            {mock ? <MockBadge /> : <RealBadge />}
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={handleDeploy}>
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
              Deploy
            </Button>
          </div>
        }
      />

      <div className="space-y-2">
        {data?.deployments.map((dep, i) => {
          const verification = verifications[dep.id];
          return (
            <motion.div
              key={dep.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <GlassCard className={`p-4 ${dep.state === "ERROR" ? "border-destructive/40" : dep.state === "READY" ? "border-success/30" : "border-border"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StateIcon state={dep.state} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                          dep.target === "production" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {dep.target}
                        </span>
                        <code className="text-xs font-mono text-muted-foreground">{dep.id}</code>
                        {dep.state === "READY" && <CheckCircle2 className="w-3 h-3 text-success" />}
                      </div>
                      <p className="text-sm font-medium truncate">{dep.commitMessage}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-mono text-muted-foreground">
                        <span>branch: {dep.branch}</span>
                        <span>sha: {dep.commitSha}</span>
                        <span>created: {new Date(dep.createdAt).toLocaleString()}</span>
                        {dep.buildingDurationMs && <span>build: {(dep.buildingDurationMs / 1000).toFixed(1)}s</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {dep.url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={dep.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                          <span className="ml-1.5">Open</span>
                        </a>
                      </Button>
                    )}
                    {dep.state === "READY" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerify(dep)}
                        disabled={verifying === dep.id}
                      >
                        {verifying === dep.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        <span className="ml-1.5">Verify</span>
                      </Button>
                    )}
                    {dep.state === "READY" && dep.target !== "production" && (
                      <Button variant="outline" size="sm" onClick={() => handleRollback(dep)}>
                        <RotateCcw className="w-3 h-3" />
                        <span className="ml-1.5">Promote</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Verification result */}
                {verification && (
                  <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <VerifyStat label="HTTP" value={verification.httpStatus?.toString() ?? "—"} ok={verification.httpStatus != null && verification.httpStatus < 400} />
                    <VerifyStat label="Page load" value={verification.pageLoadOk ? "OK" : "FAIL"} ok={verification.pageLoadOk} />
                    <VerifyStat label="API health" value={verification.apiHealthOk ? "OK" : "FAIL"} ok={verification.apiHealthOk} />
                    <VerifyStat label="Smoke" value={verification.smokeTestPassed ? "PASS" : "FAIL"} ok={verification.smokeTestPassed} />
                    {verification.consoleErrors.length > 0 && (
                      <div className="col-span-full text-[10px] text-destructive font-mono">
                        Console errors: {verification.consoleErrors.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
        {data && data.deployments.length === 0 && (
          <GlassCard className="p-12">
            <EmptyState title="No deployments" description="Click Deploy to trigger a Vercel deployment (requires approval for production)" icon={<Rocket className="w-8 h-8" />} />
          </GlassCard>
        )}
      </div>

      <GlassCard className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-info" />
          Production Gate (§65)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-[10px] font-mono">
          {[
            { label: "Build", ok: true },
            { label: "Tests", ok: true },
            { label: "Security", ok: true },
            { label: "AI Review", ok: false },
            { label: "Deploy", ok: false },
            { label: "Browser Verify", ok: false },
            { label: "Human Approval", ok: false },
          ].map((g) => (
            <div key={g.label} className={`p-2 rounded-md text-center border ${g.ok ? "bg-success/10 border-success/30 text-success" : "bg-muted/30 border-border text-muted-foreground"}`}>
              <p className="uppercase">{g.label}</p>
              {g.ok ? <CheckCircle2 className="w-3 h-3 mx-auto mt-1" /> : <Clock className="w-3 h-3 mx-auto mt-1" />}
            </div>
          ))}
        </div>
        <p className="text-xs font-mono text-destructive mt-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> PRODUCTION LOCKED — pending AI review, deploy, verification, and human approval
        </p>
      </GlassCard>
    </div>
  );
}

function StateIcon({ state }: { state: Deployment["state"] }) {
  if (state === "READY") return <CheckCircle2 className="w-5 h-5 text-success" />;
  if (state === "ERROR") return <XCircle className="w-5 h-5 text-destructive" />;
  if (state === "CANCELED") return <XCircle className="w-5 h-5 text-muted-foreground" />;
  if (state === "QUEUED" || state === "BUILDING") return <RefreshCw className="w-5 h-5 text-info animate-spin" />;
  return <Clock className="w-5 h-5 text-muted-foreground" />;
}

function VerifyStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`p-1.5 rounded ${ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
      <p className="text-[10px] uppercase opacity-70">{label}</p>
      <p className="text-sm font-mono font-bold">{value}</p>
    </div>
  );
}
