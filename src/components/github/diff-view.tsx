"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, RiskBadge, EmptyState } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { DiffFile, DiffSummary, Commit, Review, CheckRun, PullRequest, ReviewGate } from "@/types";
import type { PendingApproval } from "@/store";
import { FileCode2, GitBranch, RefreshCw, Plus, Minus, FilePlus, FileMinus, FileEdit, FileOutput, CheckCircle2, XCircle, Clock, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

export function DiffView() {
  const { selectedRepo, selectedPRNumber, setView, setReviewGateCheck, pushApproval, reviewGate } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const prNum = selectedPRNumber ?? 42;

  const diffUrl = `/api/github/diff?owner=${owner}&repo=${repo}&pr=${prNum}`;
  const commitsUrl = `/api/github/commits?owner=${owner}&repo=${repo}&pr=${prNum}`;
  const reviewsUrl = `/api/github/reviews?owner=${owner}&repo=${repo}&pr=${prNum}`;

  const diff = useFetch<{ files: DiffFile[]; analysis: DiffSummary }>(diffUrl);
  const commits = useFetch<{ commits: Commit[] }>(commitsUrl);
  const reviews = useFetch<{ reviews: Review[] }>(reviewsUrl);

  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [tab, setTab] = useState<"files" | "diff" | "commits" | "reviews" | "checks">("files");

  // Auto-mark diffReviewed when loaded
  useMemo(() => {
    if (diff.data?.files.length) {
      setReviewGateCheck("diffReviewed", true);
    }
  }, [diff.data, setReviewGateCheck]);

  return (
    <div>
      <PageHeader
        title={`PR #${prNum} — Diff & Files`}
        subtitle={`${selectedRepo} · ${diff.data?.files.length ?? 0} files changed`}
        icon={<FileCode2 className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            {diff.mock ? <MockBadge /> : <RealBadge />}
            <Button variant="outline" size="sm" onClick={() => { diff.refetch(); commits.refetch(); reviews.refetch(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => setView("ai")}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5" />
              Analyze with AI
            </Button>
          </div>
        }
      />

      {/* Summary */}
      {diff.data?.analysis && (
        <GlassCard className="p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Stat label="Files" value={diff.data.analysis.totalFiles} />
            <Stat label="Additions" value={`+${diff.data.analysis.additions}`} className="text-success" />
            <Stat label="Deletions" value={`-${diff.data.analysis.deletions}`} className="text-destructive" />
            <Stat label="Risk" value={Object.entries(diff.data.analysis.byRisk).filter(([_, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ") || "LOW"} />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">By Category (V3 §14)</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(diff.data.analysis.byCategory)
                .filter(([_, v]) => v > 0)
                .map(([cat, v]) => (
                  <span key={cat} className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted/60 border border-border/60">
                    {cat}: {v}
                  </span>
                ))}
            </div>
          </div>
        </GlassCard>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-5 w-full max-w-md mb-3">
          <TabsTrigger value="files" className="text-xs">Files</TabsTrigger>
          <TabsTrigger value="diff" className="text-xs">Diff</TabsTrigger>
          <TabsTrigger value="commits" className="text-xs">Commits</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs">Reviews</TabsTrigger>
          <TabsTrigger value="checks" className="text-xs">Checks</TabsTrigger>
        </TabsList>

        {/* Files tab */}
        <TabsContent value="files">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <GlassCard className="p-2 lg:col-span-1 max-h-[600px] overflow-y-auto">
              {diff.data?.files.map((f) => {
                const Icon = f.status === "added" ? FilePlus : f.status === "removed" ? FileMinus : f.status === "renamed" ? FileOutput : FileEdit;
                return (
                  <button
                    key={f.sha}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full text-left p-2 rounded-md transition-colors flex items-start gap-2 ${
                      selectedFile?.sha === f.sha ? "bg-primary/15" : "hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono truncate">{f.filename}</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                        <span className="text-success">+{f.additions}</span>
                        <span className="text-destructive">-{f.deletions}</span>
                        <span className="text-muted-foreground uppercase">{f.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </GlassCard>
            <GlassCard className="p-4 lg:col-span-2 max-h-[600px] overflow-y-auto">
              {selectedFile ? (
                <div>
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-card/80 backdrop-blur-md py-2 -mx-4 px-4 z-10">
                    <p className="font-mono text-sm truncate">{selectedFile.filename}</p>
                    <RiskBadge level={diff.data?.analysis.files.find((cf) => cf.filename === selectedFile.filename)?.risk ?? "LOW"} />
                  </div>
                  <pre className="text-[11px] font-mono-code leading-relaxed">
                    {selectedFile.patch?.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={`px-2 ${
                          line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") ? "text-primary font-semibold"
                          : line.startsWith("+") ? "diff-add"
                          : line.startsWith("-") ? "diff-del"
                          : "diff-context"
                        }`}
                      >
                        {line || " "}
                      </div>
                    )) ?? "No patch available"}
                  </pre>
                </div>
              ) : (
                <EmptyState title="Select a file" description="Click a file on the left to view its diff" icon={<FileCode2 className="w-8 h-8" />} />
              )}
            </GlassCard>
          </div>
        </TabsContent>

        {/* Diff tab — full unified diff */}
        <TabsContent value="diff">
          <GlassCard className="p-4 max-h-[600px] overflow-y-auto">
            <pre className="text-[11px] font-mono-code leading-relaxed">
              {diff.data?.files.flatMap((f, fi) => [
                <div key={`${fi}-h`} className="text-primary font-semibold px-2 py-1 border-y border-border/60 my-2">
                  --- {f.filename} ({f.status}, +{f.additions} -{f.deletions})
                </div>,
                ...(f.patch?.split("\n").map((line, li) => (
                  <div key={`${fi}-${li}`} className={`px-2 ${line.startsWith("+") && !line.startsWith("+++") ? "diff-add" : line.startsWith("-") && !line.startsWith("---") ? "diff-del" : "diff-context"}`}>
                    {line || " "}
                  </div>
                )) ?? []),
              ]) ?? []}
            </pre>
          </GlassCard>
        </TabsContent>

        {/* Commits */}
        <TabsContent value="commits">
          <div className="space-y-2">
            {commits.data?.commits.map((c) => (
              <GlassCard key={c.sha} className="p-3">
                <div className="flex items-start gap-3">
                  <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                    {c.sha.slice(0, 7)}
                  </code>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.commit.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                      <img src={c.author?.avatar_url} alt={c.author?.login ?? "avatar"} className="w-4 h-4 rounded-full" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                      <span>@{c.author?.login ?? c.commit.author.name}</span>
                      <span>{new Date(c.commit.author.date).toLocaleString()}</span>
                      {c.stats && <span>+{c.stats.additions} -{c.stats.deletions}</span>}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews">
          <div className="space-y-2">
            {reviews.data?.reviews.map((r) => (
              <GlassCard key={r.id} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <img src={r.user.avatar_url} alt={r.user.login} className="w-5 h-5 rounded-full" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                  <span className="font-mono text-sm">@{r.user.login}</span>
                  <ReviewStateBadge state={r.state} />
                  <span className="text-[10px] text-muted-foreground ml-auto">{new Date(r.submitted_at).toLocaleString()}</span>
                </div>
                {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
              </GlassCard>
            ))}
          </div>
        </TabsContent>

        {/* Checks (use the same checks API) */}
        <TabsContent value="checks">
          <ChecksList owner={owner} repo={repo} pr={prNum} />
        </TabsContent>
      </Tabs>

      {/* Merge gate */}
      <MergeGateSection
        checks={reviewGate.checks}
        prNum={prNum}
        selectedRepo={selectedRepo}
        files={diff.data?.files}
        pushApproval={pushApproval}
      />
    </div>
  );
}

function MergeGateSection({
  checks,
  prNum,
  selectedRepo,
  files,
  pushApproval,
}: {
  checks: ReviewGate["checks"];
  prNum: number;
  selectedRepo: string | null;
  files?: DiffFile[];
  pushApproval: (a: PendingApproval) => void;
}) {
  return (
    <>
      <GlassCard className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            Merge Gate (V2 §10)
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3">
          {([
            { key: "prLoaded", label: "PR Loaded" },
            { key: "diffReviewed", label: "Diff Reviewed" },
            { key: "securityPassed", label: "Security" },
            { key: "testsPassed", label: "Tests" },
            { key: "aiReviewed", label: "AI Review" },
            { key: "humanApproved", label: "Human Approval" },
          ] as const).map((c) => {
            const passed = checks[c.key];
            return (
              <div key={c.key} className={`p-2 rounded-md text-center border ${passed ? "bg-success/10 border-success/30 text-success" : "bg-muted/30 border-border text-muted-foreground"}`}>
                <p className="text-[10px] font-mono uppercase">{c.label}</p>
                {passed ? <CheckCircle2 className="w-4 h-4 mx-auto mt-1" /> : <XCircle className="w-4 h-4 mx-auto mt-1" />}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive font-mono text-sm">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> MERGE LOCKED — Human approval required
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              pushApproval({
                id: `merge-${Date.now()}`,
                type: "merge",
                title: `Merge PR #${prNum}`,
                description: `Merge ${selectedRepo}#${prNum} into main. AI review and CI checks must pass first.`,
                risk: "HIGH",
                files: files?.map((f) => f.filename).slice(0, 8),
                impact: ["api", "backend", "security"],
                expectedResult: "PR merged into main branch, deployment triggered",
              });
            }}
          >
            Request Merge Approval
          </Button>
        </div>
      </GlassCard>
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${className ?? ""}`}>{value}</p>
      <p className="text-[10px] font-mono uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function ReviewStateBadge({ state }: { state: string }) {
  const cls = {
    APPROVED: "bg-success/15 text-success border-success/30",
    CHANGES_REQUESTED: "bg-destructive/15 text-destructive border-destructive/30",
    COMMENTED: "bg-info/15 text-info border-info/30",
    PENDING: "bg-warning/15 text-warning border-warning/30",
    DISMISSED: "bg-muted text-muted-foreground border-border",
  }[state as keyof typeof cls] ?? "bg-muted text-muted-foreground border-border";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${cls}`}>{state.replace("_", " ")}</span>;
}

function ChecksList({ owner, repo, pr }: { owner: string; repo: string; pr: number }) {
  // We need a ref — get PR head sha from the pr endpoint
  const prRes = useFetch<{ pullRequest: PullRequest }>(`/api/github/pr?owner=${owner}&repo=${repo}&pr=${pr}`);
  const headSha = prRes.data?.pullRequest.head.sha ?? "main";
  const { data, loading, mock } = useFetch<{ checks: CheckRun[] }>(`/api/github/checks?owner=${owner}&repo=${repo}&ref=${headSha}`);
  return (
    <div className="space-y-2">
      {loading && <p className="text-xs text-muted-foreground">Loading checks…</p>}
      {data?.checks.map((c) => (
        <GlassCard key={c.id} className="p-3 flex items-center gap-3">
          <CheckStatusIcon status={c.status} conclusion={c.conclusion} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium font-mono">{c.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {c.status === "completed"
                ? `completed ${c.completed_at ? new Date(c.completed_at).toLocaleString() : ""}`
                : c.status}
            </p>
          </div>
          {c.status === "completed" && c.conclusion && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
              c.conclusion === "success" ? "bg-success/15 text-success border-success/30"
              : c.conclusion === "failure" ? "bg-destructive/15 text-destructive border-destructive/30"
              : "bg-muted text-muted-foreground border-border"
            }`}>
              {c.conclusion}
            </span>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

function CheckStatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "completed") {
    return conclusion === "success" ? <CheckCircle2 className="w-4 h-4 text-success" />
      : conclusion === "failure" ? <XCircle className="w-4 h-4 text-destructive" />
      : <Clock className="w-4 h-4 text-muted-foreground" />;
  }
  if (status === "in_progress") return <RefreshCw className="w-4 h-4 text-info animate-spin" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}
