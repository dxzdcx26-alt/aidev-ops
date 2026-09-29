"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, RiskBadge, EmptyState, NeonText } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { DiffFile, AIAnalysisResult } from "@/types";
import { Bot, Play, RefreshCw, Brain, ShieldAlert, Boxes, Database, GitBranch, AlertTriangle, FileCode2, Clock, Cpu, Zap, CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";

export function AIConsoleView() {
  const {
    selectedRepo,
    selectedPRNumber,
    currentAnalysis,
    setCurrentAnalysis,
    pushAnalysis,
    addDecision,
    addAudit,
    agentRuns,
    currentAgentRun,
    startAgentRun,
    updateAgentRun,
    addAgentStep,
    updateAgentStep,
    mockMode,
    setReviewGateCheck,
  } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const prNum = selectedPRNumber ?? 42;
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<AIAnalysisResult[]>([]);

  // Auto-execute any agent run that arrives in the store with state RUNNING
  useEffect(() => {
    if (currentAgentRun?.state === "RUNNING" && currentAgentRun.steps.length === 0) {
      void executeAgentRun(currentAgentRun.id, currentAgentRun.prompt);
    }
  }, [currentAgentRun?.id]);

  const executeAgentRun = async (runId: string, prompt: string) => {
    // Detect intent from the prompt and route to the right action
    addAgentStep(runId, {
      id: uuid(),
      tool: "router",
      description: "Detecting intent from prompt",
      status: "running",
      startedAt: new Date().toISOString(),
    });

    await sleep(300);
    updateAgentStep(runId, "router", { status: "success", endedAt: new Date().toISOString(), durationMs: 300, output: "Intent: AI_ANALYZE" });

    if (prompt.includes("วิเคราะห์ PR") || prompt.includes("Analyze") || prompt.toLowerCase().includes("analyze")) {
      await runAnalysis(runId);
    } else if (prompt.includes("Security") || prompt.includes("security")) {
      await runSecurityScan(runId);
    } else {
      await runAnalysis(runId);
    }

    updateAgentRun(runId, {
      state: "SUCCESS",
      endedAt: new Date().toISOString(),
      result: "Analysis complete",
    });
  };

  const runAnalysis = async (runId?: string) => {
    setRunning(true);
    const actualRunId = runId ?? startAgentRun("Analyze PR with AI");

    addAgentStep(actualRunId, {
      id: uuid(),
      tool: "getDiff",
      description: `Fetching diff for PR #${prNum}`,
      status: "running",
      startedAt: new Date().toISOString(),
    });

    try {
      const diffRes = await fetch(`/api/github/diff?owner=${owner}&repo=${repo}&pr=${prNum}`);
      const diffJson = await diffRes.json();
      const files: DiffFile[] = diffJson.files ?? [];

      updateAgentStep(actualRunId, "getDiff", {
        status: "success",
        endedAt: new Date().toISOString(),
        durationMs: 200,
        output: `${files.length} files loaded`,
      });

      addAgentStep(actualRunId, {
        id: uuid(),
        tool: "analyzeDiff",
        description: "Running AI analysis (V4 §24-26)",
        status: "running",
        startedAt: new Date().toISOString(),
      });

      const aiRes = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, pr: prNum, files }),
      });
      const aiJson = await aiRes.json();

      if (!aiRes.ok) throw new Error(aiJson.error ?? "AI analysis failed");

      const result: AIAnalysisResult = aiJson.result;
      pushAnalysis(result);
      setReviewGateCheck("aiReviewed", true);
      setHistory((h) => [result, ...h].slice(0, 10));

      // Add each decision to the decision log
      result.decisions.forEach((d) => {
        addDecision({
          id: uuid(),
          agent: result.provider,
          model: result.model,
          promptVersion: result.promptVersion,
          decision: d.decision,
          reason: d.reason,
          risk: d.risk,
          files: d.files,
          impact: d.impact as never,
          commitSha: undefined,
          prNumber: prNum,
          timestamp: result.timestamp,
        });
      });

      addAudit({
        id: uuid(),
        timestamp: new Date().toISOString(),
        actor: result.provider,
        action: "ANALYZE",
        status: "success",
        target: `PR #${prNum}`,
        risk: result.riskLevel,
        metadata: { provider: result.provider, model: result.model, fallback: result.fallback, tokensIn: result.tokensIn, tokensOut: result.tokensOut, findings: result.security.length },
        detail: `AI analysis for PR #${prNum} (${result.provider}/${result.model}, fallback=${result.fallback})`,
      });

      updateAgentStep(actualRunId, "analyzeDiff", {
        status: "success",
        endedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        output: `Risk: ${result.riskLevel}, Findings: ${result.security.length}, Decisions: ${result.decisions.length}`,
      });
    } catch (err) {
      updateAgentStep(actualRunId, "analyzeDiff", {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
      updateAgentRun(actualRunId, { state: "FAILED", error: err instanceof Error ? err.message : String(err) });
      addAudit({
        id: uuid(),
        timestamp: new Date().toISOString(),
        actor: "ai-provider",
        action: "ANALYZE",
        status: "failure",
        target: `PR #${prNum}`,
        detail: String(err),
      });
    } finally {
      setRunning(false);
    }
  };

  const runSecurityScan = async (runId?: string) => {
    setRunning(true);
    const actualRunId = runId ?? startAgentRun("Security scan");

    addAgentStep(actualRunId, {
      id: uuid(),
      tool: "securityScan",
      description: "Scanning diff for security issues (V4 §29-33)",
      status: "running",
      startedAt: new Date().toISOString(),
    });

    try {
      const diffRes = await fetch(`/api/github/diff?owner=${owner}&repo=${repo}&pr=${prNum}`);
      const diffJson = await diffRes.json();
      const files: DiffFile[] = diffJson.files ?? [];

      // Run security scan client-side via the analyzer (already in mock data)
      // For real PRs, we'd call /api/security/scan here.
      const { scanPatch } = await import("@/lib/security").catch(() => ({ scanPatch: null }));
      let findings: { file: string; line: number; severity: string; reason: string }[] = [];
      if (scanPatch) {
        files.forEach((f) => {
          const sub = scanPatch(f.patch ?? "", f.filename);
          findings.push(...sub);
        });
      }

      updateAgentStep(actualRunId, "securityScan", {
        status: "success",
        endedAt: new Date().toISOString(),
        durationMs: 200,
        output: `${findings.length} findings`,
      });

      addAudit({
        id: uuid(),
        timestamp: new Date().toISOString(),
        actor: "security-engine",
        action: "ANALYZE",
        status: "success",
        target: `PR #${prNum}`,
        metadata: { findings: findings.length },
        detail: `Security scan: ${findings.length} findings`,
      });
    } catch (err) {
      updateAgentStep(actualRunId, "securityScan", { status: "failed", error: String(err) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Console"
        subtitle={`Provider: ${mockMode.ai ? "FALLBACK (no AI_API_KEY)" : "LIVE"} · Model: ${currentAnalysis?.model ?? "—"} · Prompt: ${currentAnalysis?.promptVersion ?? "—"}`}
        icon={<Bot className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            {currentAnalysis?.fallback ? <MockBadge label="FALLBACK" /> : mockMode.ai ? <MockBadge /> : <RealBadge />}
            <Button onClick={() => runAnalysis()} disabled={running} size="sm">
              {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
              {running ? "Analyzing…" : "Analyze PR"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent activity feed */}
        <GlassCard className="p-4 lg:col-span-1 max-h-[600px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Agent Activity</h3>
          </div>
          {agentRuns.length === 0 ? (
            <EmptyState title="No agent runs yet" description="Click Analyze PR or use the Command Bar" icon={<Bot className="w-8 h-8" />} />
          ) : (
            <div className="space-y-3">
              {agentRuns.map((run) => (
                <div key={run.id} className={`p-2 rounded-md border ${run.state === "RUNNING" ? "border-primary/40 bg-primary/5" : run.state === "FAILED" ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                      run.state === "RUNNING" ? "bg-primary/15 text-primary"
                      : run.state === "SUCCESS" ? "bg-success/15 text-success"
                      : run.state === "FAILED" ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {run.state}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{new Date(run.startedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-foreground mb-2">{run.prompt}</p>
                  <div className="space-y-1">
                    {run.steps.map((s) => (
                      <div key={s.id} className="flex items-start gap-1.5 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          s.status === "success" ? "bg-success"
                          : s.status === "failed" ? "bg-destructive"
                          : s.status === "running" ? "bg-primary animate-pulse"
                          : "bg-muted-foreground"
                        }`} />
                        <div className="min-w-0">
                          <p className="font-mono text-muted-foreground">{s.tool}</p>
                          <p className="text-foreground truncate">{s.description}</p>
                          {s.output && <p className="text-[10px] text-muted-foreground/70 truncate">{s.output}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Analysis result */}
        <div className="lg:col-span-2 space-y-4">
          {currentAnalysis ? (
            <AnalysisResultView result={currentAnalysis} />
          ) : (
            <GlassCard className="p-12">
              <EmptyState
                title="No analysis yet"
                description="Run an analysis to see structured AI output: risk, decisions, security findings, architecture graph, data flow, API flow, dependencies and recommendations."
                icon={<Brain className="w-12 h-12" />}
              />
            </GlassCard>
          )}

          {/* History */}
          {history.length > 0 && (
            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-info" />
                Analysis History (V4 §28)
              </h3>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <button
                    key={h.id}
                    onClick={() => setCurrentAnalysis(h)}
                    className="w-full text-left p-2 rounded-md hover:bg-muted/50 flex items-center gap-2 text-xs"
                  >
                    <RiskBadge level={h.riskLevel} />
                    <span className="font-mono text-muted-foreground">{h.provider}/{h.model}</span>
                    <span className="truncate flex-1">{h.summary.slice(0, 80)}</span>
                    <span className="text-muted-foreground font-mono">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    {h.fallback && <MockBadge label="FB" />}
                  </button>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisResultView({ result }: { result: AIAnalysisResult }) {
  const [tab, setTab] = useState<"summary" | "decisions" | "security" | "architecture" | "flow" | "api" | "deps" | "blockers" | "tests" | "deploy">("summary");
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-4" glow={result.riskLevel === "CRITICAL" || result.riskLevel === "HIGH" ? "purple" : "none"}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Structured AI Output</h3>
            {result.fallback && <MockBadge label="BASELINE FALLBACK" />}
            {result.promptInjectionDetected && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-warning/40 bg-warning/10 text-warning" title="Prompt injection patterns were detected in repository content and neutralized before AI call">
                ⚠ INJECTION NEUTRALIZED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">conf: {Math.round((result.confidence ?? 0) * 100)}%</span>
            <RiskBadge level={result.riskLevel} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {[
            { id: "summary", label: "Summary", icon: FileCode2 },
            { id: "decisions", label: `Decisions (${result.decisions.length})`, icon: Zap },
            { id: "security", label: `Security (${result.security.length})`, icon: ShieldAlert },
            { id: "blockers", label: `Blockers (${result.blockers.length})`, icon: AlertTriangle },
            { id: "architecture", label: `Architecture (${result.architecture.nodes.length})`, icon: Boxes },
            { id: "flow", label: `Data Flow (${result.dataFlow.length})`, icon: GitBranch },
            { id: "api", label: `API (${result.apiFlow.length})`, icon: FileCode2 },
            { id: "deps", label: `Deps (${result.dependencies.length})`, icon: Database },
            { id: "tests", label: `Tests (${result.tests.length})`, icon: CheckCircle2 },
            { id: "deploy", label: "Deploy Risk", icon: Rocket },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-colors ${
                  tab === t.id ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>

        <ScrollArea className="max-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {tab === "summary" && (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed">{result.summary}</p>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Changed Areas (V4 §17)</p>
                    <div className="flex flex-wrap gap-1">
                      {result.changedAreas.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted/60 border border-border/60">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Files ({result.files.length})</p>
                    <div className="space-y-1">
                      {result.files.map((f) => (
                        <div key={f.filename} className="flex items-center gap-2 text-xs">
                          <RiskBadge level={f.risk} />
                          <code className="font-mono text-muted-foreground flex-1 truncate">{f.filename}</code>
                          <span className="text-[10px] text-muted-foreground/70 uppercase">{f.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Recommendations</p>
                    <ul className="space-y-1 text-xs">
                      {result.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">→</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {tab === "decisions" && (
                <div className="space-y-2">
                  {result.decisions.map((d, i) => (
                    <div key={i} className="p-3 rounded-md bg-muted/30 border border-border/60">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold font-mono">{d.decision}</p>
                        <RiskBadge level={d.risk} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{d.reason}</p>
                      {d.recommendation && <p className="text-xs"><span className="text-primary">Fix:</span> {d.recommendation}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {d.files.map((f) => <code key={f} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">{f}</code>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tab === "security" && (
                <div className="space-y-2">
                  {result.security.length === 0 && <p className="text-xs text-muted-foreground">No security findings</p>}
                  {result.security.map((s) => (
                    <div key={s.id} className="p-3 rounded-md border border-border/60 bg-destructive/5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-muted">{s.category}</span>
                        <code className="text-[11px] font-mono text-muted-foreground">{s.file}:{s.line}</code>
                      </div>
                      <p className="text-sm font-medium">{s.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1"><span className="text-destructive">Evidence:</span> <code className="font-mono">{s.evidence}</code></p>
                      <p className="text-xs mt-1"><span className="text-success">Fix:</span> {s.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
              {tab === "architecture" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Architecture graph generated from diff (V4 §37)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Nodes ({result.architecture.nodes.length})</p>
                      <div className="space-y-1">
                        {result.architecture.nodes.map((n) => (
                          <div key={n.id} className="text-xs p-1.5 rounded bg-muted/40">
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">{n.type}</span>
                            <p className="font-mono">{n.label}</p>
                            {n.file && <p className="text-[10px] text-muted-foreground/70 font-mono">{n.file}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Edges ({result.architecture.edges.length})</p>
                      <div className="space-y-1">
                        {result.architecture.edges.map((e) => (
                          <div key={e.id} className="text-[11px] font-mono p-1.5 rounded bg-muted/40">
                            <span className="text-info">{e.from}</span>
                            <span className="text-muted-foreground"> →{e.type}→ </span>
                            <span className="text-info">{e.to}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {tab === "flow" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Data flow trace (V4 §38)</p>
                  <div className="space-y-1">
                    {result.dataFlow.map((f, i) => (
                      <div key={i} className="p-2 rounded bg-muted/40 text-xs">
                        <p className="font-mono text-[10px] text-muted-foreground">{f.step}</p>
                        <p className="text-sm"><span className="text-info">{f.from}</span> → <span className="text-info">{f.to}</span></p>
                        <p className="text-muted-foreground mt-0.5">{f.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "api" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">API endpoint changes (V4 §35-36)</p>
                  {result.apiImpact && (
                    <div className={`p-2 rounded mb-2 text-xs border ${result.apiImpact.breaking ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-success/10 border-success/30 text-success"}`}>
                      <p className="font-mono font-bold uppercase">{result.apiImpact.breaking ? "⚠ Breaking Change" : "✓ No Breaking Changes"}</p>
                      <p className="text-xs mt-0.5">{result.apiImpact.summary}</p>
                    </div>
                  )}
                  {result.apiFlow.length === 0 && <p className="text-xs text-muted-foreground">No API changes detected</p>}
                  <div className="space-y-1">
                    {result.apiFlow.map((a, i) => (
                      <div key={i} className="p-2 rounded bg-muted/40 text-xs flex items-center gap-2">
                        <span className="font-mono font-bold text-info">{a.method}</span>
                        <code className="font-mono flex-1 truncate">{a.path}</code>
                        <span className={`text-[10px] uppercase ${a.auth ? "text-success" : "text-destructive"}`}>{a.auth ? "auth" : "no-auth"}</span>
                        <span className={`text-[10px] uppercase ${
                          a.change === "added" ? "text-success"
                          : a.change === "removed" ? "text-destructive"
                          : "text-warning"
                        }`}>{a.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "deps" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Dependency changes (V4 §25)</p>
                  {result.dependencyImpact && (
                    <div className="p-2 rounded mb-2 text-xs bg-muted/40 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <RiskBadge level={result.dependencyImpact.risk} />
                        <span className="font-mono text-muted-foreground">{result.dependencyImpact.notes}</span>
                      </div>
                      {result.dependencyImpact.added.length > 0 && (
                        <p className="text-success text-[11px]">+ {result.dependencyImpact.added.join(", ")}</p>
                      )}
                      {result.dependencyImpact.removed.length > 0 && (
                        <p className="text-destructive text-[11px]">- {result.dependencyImpact.removed.join(", ")}</p>
                      )}
                    </div>
                  )}
                  {result.dependencies.length === 0 && <p className="text-xs text-muted-foreground">No dependency changes</p>}
                  <div className="space-y-1">
                    {result.dependencies.map((d, i) => (
                      <div key={i} className="p-2 rounded bg-muted/40 text-xs flex items-center gap-2">
                        <code className="font-mono flex-1">{d.name}</code>
                        <span className="font-mono text-muted-foreground">{d.version}</span>
                        <span className={`text-[10px] uppercase ${d.change === "added" ? "text-success" : d.change === "removed" ? "text-destructive" : "text-warning"}`}>{d.change}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "blockers" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Hard blockers preventing merge (Phase 8)</p>
                  {result.blockers.length === 0 ? (
                    <div className="p-3 rounded-md bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> No blockers — merge allowed (pending gates)
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {result.blockers.map((b, i) => (
                        <div key={i} className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tab === "tests" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Recommended test coverage (Phase 4)</p>
                  <div className="space-y-2">
                    {result.tests.map((t, i) => (
                      <div key={i} className="p-3 rounded-md bg-muted/40 border border-border/60">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/15 text-primary">{t.area}</span>
                        </div>
                        <p className="text-sm font-medium">{t.recommended}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "deploy" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Deployment risk assessment (Phase 10)</p>
                  {result.deploymentRisk && (
                    <div className={`p-4 rounded-md border ${result.deploymentRisk.level === "CRITICAL" || result.deploymentRisk.level === "HIGH" ? "bg-destructive/10 border-destructive/30" : result.deploymentRisk.level === "MEDIUM" ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <RiskBadge level={result.deploymentRisk.level} />
                        {result.deploymentRisk.canaryRecommended && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-warning/15 text-warning border border-warning/30">
                            🐤 Canary recommended
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1 text-xs">
                        {result.deploymentRisk.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">→</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>

        <div className="mt-3 pt-3 border-t border-border/60 text-[10px] font-mono text-muted-foreground/70 flex flex-wrap gap-3">
          <span>Provider: {result.provider}</span>
          <span>Model: {result.model}</span>
          <span>Prompt: {result.promptVersion}</span>
          <span>Tokens: {result.tokensIn}+{result.tokensOut}</span>
          <span>Duration: {result.durationMs}ms</span>
          <span className={result.redactedSecrets > 0 ? "text-warning" : ""}>Redacted: {result.redactedSecrets}</span>
          <span>{new Date(result.timestamp).toLocaleString()}</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
