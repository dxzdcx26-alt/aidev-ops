"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, StatusDot, RiskBadge, MockBadge, RealBadge, NeonText } from "@/components/shared";
import { motion } from "framer-motion";
import {
  GitBranch,
  GitPullRequest,
  Bot,
  ShieldCheck,
  Workflow,
  Rocket,
  Activity,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Terminal,
} from "lucide-react";
import { useEffect } from "react";

export function DashboardView() {
  const {
    repositories,
    pullRequests,
    deployments,
    mockMode,
    currentAnalysis,
    agentRuns,
    decisionLog,
    auditLog,
    reviewGate,
    setView,
  } = useStore();

  const openPRs = pullRequests.filter((p) => p.state === "open" && !p.draft).length;
  const draftPRs = pullRequests.filter((p) => p.draft).length;
  const prodDeployments = deployments.filter((d) => d.target === "production");
  const latestProd = prodDeployments[0];
  const failedDeploys = deployments.filter((d) => d.state === "ERROR").length;
  const lastAgent = agentRuns[0];
  const lastDecision = decisionLog[0];

  const stats = [
    {
      label: "Repositories",
      value: repositories.length,
      icon: GitBranch,
      color: "text-info",
      glow: "blue" as const,
      sub: `${repositories.filter((r) => r.private).length} private`,
    },
    {
      label: "Open PRs",
      value: openPRs,
      icon: GitPullRequest,
      color: "text-primary",
      glow: "purple" as const,
      sub: `${draftPRs} drafts`,
    },
    {
      label: "AI Analyses",
      value: agentRuns.length,
      icon: Bot,
      color: "text-primary",
      glow: "purple" as const,
      sub: lastAgent?.state ?? "IDLE",
    },
    {
      label: "Security",
      value: currentAnalysis?.security.length ?? 0,
      icon: ShieldCheck,
      color: currentAnalysis && currentAnalysis.security.length > 0 ? "text-destructive" : "text-success",
      glow: currentAnalysis && currentAnalysis.security.length > 0 ? ("blue" as const) : ("none" as const),
      sub: currentAnalysis ? `${currentAnalysis.security.filter((s) => s.severity === "CRITICAL").length} critical` : "Not scanned",
    },
    {
      label: "CI Status",
      value: reviewGate.checks.testsPassed ? "PASS" : "FAIL",
      icon: Workflow,
      color: reviewGate.checks.testsPassed ? "text-success" : "text-destructive",
      glow: "none" as const,
      sub: reviewGate.checks.testsPassed ? "All checks green" : "Tests failing",
    },
    {
      label: "Deployments",
      value: deployments.length,
      icon: Rocket,
      color: "text-info",
      glow: "blue" as const,
      sub: `${failedDeploys} failed`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Mission Control"
        subtitle="Real-time view of repositories, PRs, AI analysis, security, CI/CD and deployments"
        icon={<Activity className="w-5 h-5" />}
      />

      {/* Hero status strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <GlassCard className="p-4 sm:p-5" glow="purple">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center neon-purple">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Repository</p>
                <p className="font-mono font-bold text-base sm:text-lg">
                  neon-labs/ai-dev-control-center
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-md bg-muted/60 text-[11px] font-mono flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" /> feat/ai-engine
              </span>
              <span className="px-2 py-1 rounded-md bg-muted/60 text-[11px] font-mono flex items-center gap-1.5">
                <GitPullRequest className="w-3 h-3" /> PR #42
              </span>
              <RiskBadge level={currentAnalysis?.riskLevel ?? "LOW"} />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <GlassCard className="p-3 sm:p-4 h-full" glow={stat.glow}>
                <div className="flex items-start justify-between mb-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <StatusDot status={stat.label === "CI Status" ? (stat.value === "PASS" ? "success" : "error") : "idle"} />
                </div>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">{stat.sub}</p>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Review Gate */}
        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Review Gate (V1-08)</h3>
            </div>
            <button
              onClick={() => setView("audit")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View audit →
            </button>
          </div>
          <div className="space-y-2">
            {[
              { key: "prLoaded", label: "PR Loaded", icon: GitPullRequest },
              { key: "diffReviewed", label: "Diff Reviewed", icon: GitBranch },
              { key: "securityPassed", label: "Security", icon: ShieldCheck },
              { key: "testsPassed", label: "Tests", icon: CheckCircle2 },
              { key: "aiReviewed", label: "AI Review", icon: Bot },
              { key: "humanApproved", label: "Human Approval", icon: CheckCircle2 },
            ].map((check) => {
              const passed = reviewGate.checks[check.key as keyof typeof reviewGate.checks];
              const Icon = check.icon;
              return (
                <div key={check.key} className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${passed ? "text-success" : "text-muted-foreground"}`} />
                  <span className="text-sm flex-1">{check.label}</span>
                  {passed ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground/60" />
                  )}
                </div>
              );
            })}
          </div>
          <div className={`mt-3 p-3 rounded-md border text-sm font-mono flex items-center justify-between ${
            reviewGate.status === "approved" ? "bg-success/10 border-success/30 text-success"
            : reviewGate.status === "blocked" ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-warning/10 border-warning/30 text-warning"
          }`}>
            <span className="flex items-center gap-2">
              {reviewGate.status === "approved" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              MERGE {reviewGate.status === "approved" ? "READY" : "LOCKED"}
            </span>
            <span className="text-xs uppercase tracking-wider">{reviewGate.status}</span>
          </div>
        </GlassCard>

        {/* Latest AI Decision */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Latest AI Decision</h3>
            </div>
            {mockMode.ai ? <MockBadge /> : <RealBadge />}
          </div>
          {lastDecision ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted-foreground">{lastDecision.agent}</span>
                <RiskBadge level={lastDecision.risk} />
              </div>
              <p className="text-sm font-medium">{lastDecision.decision}</p>
              <p className="text-xs text-muted-foreground">{lastDecision.reason}</p>
              <p className="text-[10px] font-mono text-muted-foreground/70 mt-2">
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(lastDecision.timestamp).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No AI analysis yet. Use the command bar (⌘K) to run one.
            </p>
          )}
        </GlassCard>

        {/* Recent Activity */}
        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-info" />
              <h3 className="text-sm font-semibold">Recent Activity</h3>
            </div>
            <button
              onClick={() => setView("audit")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {auditLog.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <StatusDot
                  status={
                    entry.result === "success" ? "success"
                    : entry.result === "failure" ? "error"
                    : "warning"
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono">
                    <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>{" "}
                    <span className="text-foreground">{entry.action}</span>{" "}
                    <span className="text-muted-foreground">by {entry.agent}</span>
                  </p>
                  {entry.detail && <p className="text-muted-foreground/80 truncate">{entry.detail}</p>}
                </div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">No activity logged yet.</p>
            )}
          </div>
        </GlassCard>

        {/* Production status */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-info" />
              <h3 className="text-sm font-semibold">Production</h3>
            </div>
            {mockMode.vercel ? <MockBadge /> : <RealBadge />}
          </div>
          {latestProd ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono">{latestProd.commitSha}</span>
                <StatusDot status={latestProd.state === "READY" ? "success" : latestProd.state === "ERROR" ? "error" : "idle"} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{latestProd.commitMessage}</p>
              {latestProd.url && (
                <a
                  href={latestProd.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-info hover:underline truncate block"
                >
                  {latestProd.url}
                </a>
              )}
              <p className="text-[10px] font-mono text-muted-foreground/70">
                Deployed {new Date(latestProd.createdAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">No production deployments.</p>
          )}
        </GlassCard>
      </div>

      <div className="mt-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Quick Start</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Press <NeonText color="purple">⌘K</NeonText> to open the Command Center. Try:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {["วิเคราะห์ PR #42", "ตรวจ Security", "สร้าง Whiteboard", "Deploy โปรเจกต์นี้", "Rollback Deployment"].map((c) => (
              <code key={c} className="px-2 py-1 rounded bg-muted/60 font-mono">{c}</code>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
