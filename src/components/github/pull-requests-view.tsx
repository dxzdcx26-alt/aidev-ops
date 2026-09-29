"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, EmptyState, RiskBadge } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { PullRequest } from "@/types";
import { GitPullRequest, GitBranch, RefreshCw, MessageSquare, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState } from "react";

export function PullRequestsView() {
  const { selectedRepo, setSelectedPR, setView, reviewGate, setReviewGateCheck } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const { data, loading, error, mock, refetch } = useFetch<{ pullRequests: PullRequest[] }>(
    `/api/github/pr?owner=${owner}&repo=${repo}&state=open`,
  );

  return (
    <div>
      <PageHeader
        title="Pull Requests"
        subtitle={`${selectedRepo ?? "—"} · open PRs`}
        icon={<GitPullRequest className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            {mock ? <MockBadge label="MOCK DATA" /> : <RealBadge />}
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>
        }
      />

      {error && (
        <GlassCard className="p-4 mb-4 border-destructive/40">
          <p className="text-sm text-destructive">{error}</p>
        </GlassCard>
      )}

      <div className="space-y-2">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl glass animate-pulse" />
        ))}
        {!loading && data?.pullRequests.map((pr, i) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <GlassCard
              className="p-4 cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => {
                setSelectedPR(pr.number);
                setReviewGateCheck("prLoaded", true);
                setView("diff");
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">#{pr.number}</span>
                    {pr.draft && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground uppercase">
                        Draft
                      </span>
                    )}
                    <RiskBadge level={pr.additions > 500 ? "MEDIUM" : "LOW"} />
                  </div>
                  <p className="font-medium text-sm sm:text-base">{pr.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" /> {pr.head.ref} → {pr.base.ref}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCode2 className="w-3 h-3" /> {pr.changed_files} files
                    </span>
                    <span className="text-success">+{pr.additions}</span>
                    <span className="text-destructive">-{pr.deletions}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {pr.commits} commits
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <img
                    src={pr.user.avatar_url}
                    alt={pr.user.login}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                  <span className="font-mono text-muted-foreground">@{pr.user.login}</span>
                  <span className="font-mono text-muted-foreground hidden sm:inline">
                    {new Date(pr.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
        {!loading && data?.pullRequests.length === 0 && (
          <EmptyState title="No open PRs" icon={<GitPullRequest className="w-8 h-8" />} />
        )}
      </div>
    </div>
  );
}
