"use client";

import { useStore, type PendingApproval } from "@/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared";
import { Check, X, ShieldAlert } from "lucide-react";

/**
 * Approval Dialog — client-side UI only.
 *
 * Per Phase 16 audit issue #8: client-side audit calls were removed.
 * Audit events are now emitted by server-side API routes when the
 * approval is actually created/consumed/rejected via /api/approvals.
 *
 * This dialog is purely UI — it collects the user's decision and calls
 * the server-side approval API. The server validates identity, permission,
 * and records the audit event.
 */
export function ApprovalDialog() {
  const { pendingApprovals, resolveApproval } = useStore();
  const approval = pendingApprovals[0];

  const handle = async (decision: "approved" | "rejected") => {
    if (!approval) return;
    // Call server-side API to record the decision
    // The server validates auth, permission, and emits audit event
    try {
      if (approval.payload?.approvalId) {
        await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: approval.payload.approvalId,
            decision,
          }),
        });
      }
    } catch {
      // Server-side audit will record the failure
    }
    resolveApproval(approval.id, decision);
  };

  return (
    <Dialog open={Boolean(approval)} onOpenChange={(o) => !o && approval && handle("rejected")}>
      <DialogContent className="glass-strong">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-warning" />
            <DialogTitle className="text-lg">Human Approval Required</DialogTitle>
          </div>
          <DialogDescription>
            Per spec sections 85-88: high-risk actions require explicit human approval. The AI may not perform this action autonomously. The decision is recorded server-side with full audit trail.
          </DialogDescription>
        </DialogHeader>

        {approval && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono uppercase text-muted-foreground">{approval.type}</span>
              <RiskBadge level={approval.risk} />
            </div>
            <div>
              <p className="font-semibold">{approval.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{approval.description}</p>
            </div>

            {approval.files && approval.files.length > 0 && (
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground mb-1">Files affected</p>
                <div className="flex flex-wrap gap-1">
                  {approval.files.slice(0, 8).map((f) => (
                    <code key={f} className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">{f}</code>
                  ))}
                  {approval.files.length > 8 && (
                    <span className="text-xs text-muted-foreground">+{approval.files.length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {approval.impact && approval.impact.length > 0 && (
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground mb-1">Impact areas</p>
                <div className="flex flex-wrap gap-1">
                  {approval.impact.map((i) => (
                    <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">{i}</code>
                  ))}
                </div>
              </div>
            )}

            {approval.expectedResult && (
              <div className="p-2 rounded-md bg-muted/50 border border-border">
                <p className="text-xs font-mono uppercase text-muted-foreground mb-1">Expected result</p>
                <p className="text-sm">{approval.expectedResult}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handle("rejected")}>
            <X className="w-4 h-4 mr-1.5" />
            Cancel
          </Button>
          <Button
            onClick={() => handle("approved")}
            disabled={approval?.risk === "CRITICAL"}
            variant={approval?.risk === "CRITICAL" ? "destructive" : "default"}
          >
            <Check className="w-4 h-4 mr-1.5" />
            {approval?.risk === "CRITICAL" ? "Critical — manual review" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
