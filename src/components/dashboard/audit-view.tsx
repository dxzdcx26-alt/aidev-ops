"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, EmptyState, StatusDot } from "@/components/shared";
import { ScrollText, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AuditView() {
  const { auditLog } = useStore();
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = filter === "ALL" ? auditLog : auditLog.filter((e) => e.action === filter);
  const actions = ["ALL", "LOGIN", "VIEW", "ANALYZE", "AI_CALL", "GITHUB_CALL", "VERCEL_CALL", "APPROVE", "REJECT", "MERGE", "DEPLOY", "DEPLOY_SUCCESS", "DEPLOY_FAILED", "ROLLBACK", "ROLLBACK_SUCCESS", "ROLLBACK_FAILED", "VERIFY", "SECURITY_ALERT", "PERMISSION_DENIED", "COMMIT"];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Production spec §68 · Every action logged · Append-only (in-memory ring buffer in this build)"
        icon={<ScrollText className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded-md bg-muted/60 border border-border font-mono"
            >
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        }
      />

      <GlassCard className="p-4">
        {filtered.length === 0 ? (
          <EmptyState title="No audit events" description="Actions across the system will be logged here" icon={<ScrollText className="w-8 h-8" />} />
        ) : (
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 text-xs">
                <StatusDot
                  status={
                    entry.status === "success" ? "success"
                    : entry.status === "failure" ? "error"
                    : entry.status === "denied" ? "warning"
                    : "idle"
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                    <span className="font-mono font-bold text-primary uppercase">{entry.action}</span>
                    <span className="font-mono text-muted-foreground">by {entry.actor ?? entry.user ?? entry.agent}</span>
                    <span className={`font-mono text-[10px] uppercase px-1 rounded ${
                      entry.status === "success" ? "text-success"
                      : entry.status === "failure" ? "text-destructive"
                      : entry.status === "denied" ? "text-warning"
                      : "text-muted-foreground"
                    }`}>
                      {entry.status ?? entry.result}
                    </span>
                    {entry.risk && (
                      <span className="font-mono text-[10px] uppercase px-1 rounded bg-muted text-muted-foreground">{entry.risk}</span>
                    )}
                  </div>
                  {entry.target && <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">→ {entry.target}</p>}
                  {entry.detail && <p className="text-muted-foreground mt-0.5 font-mono text-[11px] break-all">{entry.detail}</p>}
                  {(entry.repository || entry.branch || entry.commit) && (
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                      {entry.repository && <span>repo: {entry.repository}</span>}
                      {entry.branch && <span>branch: {entry.branch}</span>}
                      {entry.commit && <span>commit: {entry.commit.slice(0, 7)}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Audit Immutability (§89)</h3>
        <p className="text-xs text-muted-foreground">
          This build uses an in-memory ring buffer (last 500 events). In production, this should be backed by an append-only
          store (e.g. DynamoDB Streams, S3 with object lock, or a forward-only Postgres table). Audit events are never
          edited or deleted from the UI.
        </p>
      </GlassCard>
    </div>
  );
}
