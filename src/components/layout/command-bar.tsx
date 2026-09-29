"use client";

import { useStore } from "@/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Bot, ShieldCheck, Boxes, Database, Rocket, RotateCcw, AlertTriangle, GitBranch } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { v4 as uuid } from "uuid";

const COMMANDS = [
  { id: "analyze-pr", label: "วิเคราะห์ PR #42", desc: "Run AI analysis on the current pull request", icon: Bot, color: "text-primary" },
  { id: "security-scan", label: "ตรวจ Security", desc: "Scan diff for secrets, injections, web vulns", icon: ShieldCheck, color: "text-destructive" },
  { id: "generate-whiteboard", label: "สร้าง Whiteboard", desc: "Generate architecture graph from diff", icon: Boxes, color: "text-info" },
  { id: "analyze-db", label: "ตรวจ Database", desc: "Inspect schema/migration changes", icon: Database, color: "text-warning" },
  { id: "analyze-api", label: "ตรวจ API", desc: "Detect added/removed/changed endpoints", icon: GitBranch, color: "text-info" },
  { id: "diagnose-build", label: "ทำไม Build ไม่ผ่าน", desc: "Diagnose the last failed CI build", icon: AlertTriangle, color: "text-destructive" },
  { id: "deploy", label: "Deploy โปรเจกต์นี้", desc: "Trigger Vercel deploy (requires approval)", icon: Rocket, color: "text-primary" },
  { id: "verify-prod", label: "ตรวจ Production", desc: "Smoke-test the production URL", icon: ShieldCheck, color: "text-success" },
  { id: "rollback", label: "Rollback Deployment", desc: "Promote previous deployment (requires approval)", icon: RotateCcw, color: "text-warning" },
] as const;

export function CommandBar({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        setQuery("");
        setSelected(0);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const filtered = COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()),
  );

  const runCommand = async (id: string) => {
    onOpenChange(false);
    const { startAgentRun, setView } = useStore.getState();
    const cmd = COMMANDS.find((c) => c.id === id);
    if (!cmd) return;
    const prompt = `${cmd.label} — ${cmd.desc}`;

    // Route to the appropriate view + start agent run
    const viewMap: Record<string, string> = {
      "analyze-pr": "ai",
      "security-scan": "security",
      "generate-whiteboard": "whiteboard",
      "analyze-db": "ai",
      "analyze-api": "ai",
      "diagnose-build": "ci",
      deploy: "deployments",
      "verify-prod": "deployments",
      rollback: "deployments",
    };
    const targetView = viewMap[id] ?? "dashboard";
    setView(targetView as never);

    const runId = startAgentRun(prompt);
    // The view component will pick up the current agent run and execute it
    void runId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden glass-strong">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Center</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Terminal className="w-4 h-4 text-primary" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && filtered[selected]) {
                runCommand(filtered[selected].id);
              }
            }}
            placeholder="พิมพ์คำสั่ง... (e.g. วิเคราะห์ PR, deploy, rollback)"
            className="border-0 bg-transparent focus-visible:ring-0 px-0 font-mono text-sm"
          />
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-2">
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matching commands</div>
            )}
            {filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <motion.button
                  key={cmd.id}
                  initial={false}
                  onClick={() => runCommand(cmd.id)}
                  onMouseEnter={() => setSelected(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                    idx === selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${cmd.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cmd.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{cmd.desc}</p>
                  </div>
                  {idx === selected && (
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd>
                  )}
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground font-mono flex items-center justify-between">
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span>Permission-gated · Audit logged</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
