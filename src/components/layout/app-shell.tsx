"use client";

import { useStore, type ViewId } from "@/store";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  GitBranch,
  GitPullRequest,
  FileCode2,
  Bot,
  ShieldCheck,
  Workflow,
  Boxes,
  Rocket,
  ScrollText,
  Settings,
  Menu,
  X,
  Terminal,
  Github,
  Zap,
  FileCheck,
  Lock,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MockBadge, RealBadge } from "@/components/shared";
import { CommandBar } from "./command-bar";

const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { id: "production-readiness", label: "Production Readiness", icon: FileCheck, group: "Overview" },
  { id: "repositories", label: "Repositories", icon: Github, group: "GitHub" },
  { id: "pull-requests", label: "Pull Requests", icon: GitPullRequest, group: "GitHub" },
  { id: "diff", label: "Diff Viewer", icon: FileCode2, group: "GitHub" },
  { id: "merge-gate", label: "Merge Gate", icon: Lock, group: "GitHub" },
  { id: "ai", label: "AI Console", icon: Bot, group: "AI Engine" },
  { id: "security", label: "Security", icon: ShieldCheck, group: "AI Engine" },
  { id: "whiteboard", label: "Whiteboard", icon: Boxes, group: "AI Engine" },
  { id: "ci", label: "CI / CD", icon: Workflow, group: "Pipeline" },
  { id: "deployments", label: "Deployments", icon: Rocket, group: "Pipeline" },
  { id: "audit", label: "Audit Log", icon: ScrollText, group: "System" },
  { id: "settings", label: "Settings", icon: Settings, group: "System" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, setView, mockMode } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const grouped: Record<string, typeof NAV> = {};
  NAV.forEach((item) => {
    grouped[item.group] = grouped[item.group] ?? [];
    grouped[item.group].push(item);
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 glass-strong border-b border-border/60">
        <div className="flex items-center gap-3 px-3 sm:px-5 h-14">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center neon-purple">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none tracking-tight">Aidev Ops</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-mono">AI Dev V4 · control plane</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-1.5">
            <StatusChip label="GH" mock={mockMode.github} />
            <StatusChip label="AI" mock={mockMode.ai} />
            <StatusChip label="Vercel" mock={mockMode.vercel} />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center gap-2 font-mono text-xs"
            onClick={() => setCmdOpen(true)}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Command</span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘K</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hidden md:flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-destructive"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.reload();
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-border/60 glass">
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 mb-1.5">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-border/60 text-[10px] text-muted-foreground font-mono">
            <p>Aidev Ops</p>
            <p className="mt-1">AI Dev V4 · aidev-ops.vercel.app</p>
          </div>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 glass-strong border-r border-border p-3 overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold">Navigation</p>
                  <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group} className="mb-4">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 px-2 mb-1.5">
                      {group}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <NavButton
                          key={item.id}
                          item={item}
                          active={view === item.id}
                          onClick={() => {
                            setView(item.id);
                            setMobileOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6">
          <div className="max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>

      <CommandBar open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-all group relative",
        active
          ? "bg-primary/15 text-primary neon-text-purple"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      {active && <motion.span layoutId="nav-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />}
      <Icon className={cn("w-4 h-4 shrink-0", active && "neon-text-purple")} />
      <span>{item.label}</span>
    </button>
  );
}

function StatusChip({ label, mock }: { label: string; mock: boolean }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md glass text-[10px] font-mono">
      <span className="text-muted-foreground">{label}</span>
      {mock ? <MockBadge /> : <RealBadge />}
    </div>
  );
}
