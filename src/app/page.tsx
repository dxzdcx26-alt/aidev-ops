"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ApprovalDialog } from "@/components/layout/approval-dialog";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ProductionReadinessView } from "@/components/dashboard/production-readiness-view";
import { MergeGateView } from "@/components/dashboard/merge-gate-view";
import { RepositoriesView } from "@/components/github/repositories-view";
import { PullRequestsView } from "@/components/github/pull-requests-view";
import { DiffView } from "@/components/github/diff-view";
import { AIConsoleView } from "@/components/ai/ai-console-view";
import { SecurityView } from "@/components/security/security-view";
import { WhiteboardView } from "@/components/whiteboard/whiteboard-view";
import { CIView } from "@/components/deployment/ci-view";
import { DeploymentsView } from "@/components/deployment/deployments-view";
import { AuditView } from "@/components/dashboard/audit-view";
import { SettingsView } from "@/components/dashboard/settings-view";
import { LoginView } from "@/components/layout/login-view";
import { useStore } from "@/store";
import { useEffect, useState } from "react";

export default function Home() {
  const { view, setRepositories, setPullRequests, setMockMode, setSystemStatus } = useStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (r.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  // Load initial data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch("/api/github/repos")
      .then((r) => r.json())
      .then((j) => {
        if (j.repositories) {
          setRepositories(j.repositories);
          setMockMode({ github: Boolean(j.mock) });
          setSystemStatus({ github: j.mock ? "MOCK" : "LIVE" });
        }
      })
      .catch(() => setSystemStatus({ github: "ERROR" }));
    void fetch("/api/vercel/deployments")
      .then((r) => r.json())
      .then((j) => {
        if (j.deployments) {
          useStore.getState().setDeployments(j.deployments);
          setMockMode({ vercel: Boolean(j.mock) });
          setSystemStatus({ vercel: j.mock ? "MOCK" : "LIVE" });
        }
      })
      .catch(() => setSystemStatus({ vercel: "ERROR" }));
    void fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        setMockMode({
          github: false,
          ai: !j.environment.ai.configured,
          vercel: false,
        });
        setSystemStatus({
          github: j.environment.github.configured ? "LIVE" : "ERROR",
          ai: j.environment.ai.configured ? "LIVE" : "FALLBACK",
          vercel: j.environment.vercel.configured ? "LIVE" : "OFFLINE",
        });
      })
      .catch(() => setSystemStatus({ github: "OFFLINE", ai: "OFFLINE", vercel: "OFFLINE" }));
  }, [isAuthenticated, setRepositories, setPullRequests, setMockMode, setSystemStatus]);

  // Load PRs when repo changes
  useEffect(() => {
    if (!isAuthenticated) return;
    const repo = useStore.getState().selectedRepo;
    if (!repo) return;
    const [owner, r] = repo.split("/");
    void fetch(`/api/github/pr?owner=${owner}&repo=${r}&state=open`)
      .then((res) => res.json())
      .then((j) => {
        if (j.pullRequests) setPullRequests(j.pullRequests);
      })
      .catch(() => {});
  }, [isAuthenticated, setPullRequests]);

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground font-mono">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "production-readiness" && <ProductionReadinessView />}
      {view === "repositories" && <RepositoriesView />}
      {view === "pull-requests" && <PullRequestsView />}
      {view === "diff" && <DiffView />}
      {view === "merge-gate" && <MergeGateView />}
      {view === "ai" && <AIConsoleView />}
      {view === "security" && <SecurityView />}
      {view === "whiteboard" && <WhiteboardView />}
      {view === "ci" && <CIView />}
      {view === "deployments" && <DeploymentsView />}
      {view === "audit" && <AuditView />}
      {view === "settings" && <SettingsView />}
      <ApprovalDialog />
    </AppShell>
  );
}
