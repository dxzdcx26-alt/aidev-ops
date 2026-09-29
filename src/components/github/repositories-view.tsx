"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, MockBadge, RealBadge, EmptyState, RiskBadge } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { Repository } from "@/types";
import { Github, GitBranch, Star, Lock, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function RepositoriesView() {
  const { selectedRepo, setSelectedRepo, setSelectedBranch, setView, mockMode } = useStore();
  const { data, loading, error, mock, refetch } = useFetch<{ repositories: Repository[] }>("/api/github/repos");

  return (
    <div>
      <PageHeader
        title="Repositories"
        subtitle="Connected repositories — server-side GitHub token required for live data"
        icon={<Github className="w-5 h-5" />}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl glass animate-pulse" />
        ))}
        {!loading && data?.repositories.map((repo, i) => (
          <motion.div
            key={repo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <GlassCard
              className={`p-4 h-full cursor-pointer transition-all hover:scale-[1.01] ${
                selectedRepo === repo.full_name ? "border-primary neon-purple" : ""
              }`}
              onClick={() => {
                setSelectedRepo(repo.full_name);
                setSelectedBranch(repo.default_branch);
                setView("pull-requests");
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {repo.private ? <Lock className="w-3.5 h-3.5 text-warning shrink-0" /> : <Globe className="w-3.5 h-3.5 text-info shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-mono text-sm truncate">{repo.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{repo.language ?? "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3 h-3" />
                  {repo.stargazers_count}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                {repo.description ?? "No description"}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" /> {repo.default_branch}
                </span>
                <span>{repo.open_issues_count} issues</span>
                <span>updated {new Date(repo.updated_at).toLocaleDateString()}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
        {!loading && data?.repositories.length === 0 && (
          <EmptyState title="No repositories" description="Configure GITHUB_TOKEN to load live data" icon={<Github className="w-8 h-8" />} />
        )}
      </div>

      <GlassCard className="mt-4 p-3">
        <p className="text-[10px] font-mono text-muted-foreground">
          V3 spec §9-11: GITHUB_TOKEN must be server-side. {mock ? "Currently using mock fallback (section 18)." : "Live data from GitHub REST API."}
        </p>
      </GlassCard>
    </div>
  );
}
