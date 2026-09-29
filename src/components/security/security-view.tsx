"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, SeverityBadge, EmptyState, RiskBadge } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import type { DiffFile } from "@/types";
import { ShieldCheck, ShieldAlert, Lock, Bug, Globe, FileWarning, Database, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECURITY_POLICY, evaluateSecurityGate, type SecurityGatePolicy } from "@/lib/security";
import type { SecurityFinding } from "@/types";
import { v4 as uuid } from "uuid";

export function SecurityView() {
  const { selectedRepo, selectedPRNumber, currentAnalysis, addAudit, setReviewGateCheck } = useStore();
  const [owner, repo] = (selectedRepo ?? "neon-labs/ai-dev-control-center").split("/");
  const prNum = selectedPRNumber ?? 42;
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [policy, setPolicy] = useState<SecurityGatePolicy>(DEFAULT_SECURITY_POLICY);

  const { data, mock } = useFetch<{ files: DiffFile[] }>(`/api/github/diff?owner=${owner}&repo=${repo}&pr=${prNum}`);

  const runScan = async () => {
    setScanning(true);
    try {
      // Run the scan client-side using the security library
      const { scanPatch } = await import("@/lib/security");
      const newFindings: SecurityFinding[] = [];
      (data?.files ?? []).forEach((f) => {
        const sub = scanPatch(f.patch ?? "", f.filename);
        newFindings.push(...sub);
      });
      // Also include findings from AI analysis if present
      if (currentAnalysis) newFindings.push(...currentAnalysis.security);
      setFindings(newFindings);
      setReviewGateCheck("securityPassed", newFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length === 0);
      addAudit({
        id: uuid(),
        timestamp: new Date().toISOString(),
        actor: "security-engine",
        action: "ANALYZE",
        status: "success",
        target: "security-scan",
        metadata: { findings: newFindings.length, critical: newFindings.filter((f) => f.severity === "CRITICAL").length },
        detail: `Security scan: ${newFindings.length} findings (${newFindings.filter((f) => f.severity === "CRITICAL").length} critical)`,
      });
    } finally {
      setScanning(false);
    }
  };

  const gate = useMemo(() => evaluateSecurityGate(findings, policy), [findings, policy]);

  return (
    <div>
      <PageHeader
        title="Security Engine"
        subtitle="V4 §29-33 · Secrets / Injection / Web / Database / API · Gate policy configurable"
        icon={<ShieldCheck className="w-5 h-5" />}
        action={
          <Button onClick={runScan} disabled={scanning || !data} size="sm">
            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            {scanning ? "Scanning…" : "Scan Diff"}
          </Button>
        }
      />

      {/* Gate status */}
      <GlassCard className={`p-4 mb-4 ${gate.state === "BLOCKED" ? "border-destructive/40" : gate.state === "WARNING" ? "border-warning/40" : "border-success/40"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gate.state === "BLOCKED" ? <ShieldAlert className="w-6 h-6 text-destructive" />
            : gate.state === "WARNING" ? <FileWarning className="w-6 h-6 text-warning" />
            : <ShieldCheck className="w-6 h-6 text-success" />}
            <div>
              <p className="text-lg font-bold">{gate.state}</p>
              <p className="text-xs text-muted-foreground">
                {gate.blocked.length} blocking · {gate.warnings.length} warnings · {findings.length} total
              </p>
            </div>
          </div>
          <RiskBadge level={findings.some((f) => f.severity === "CRITICAL") ? "CRITICAL" : findings.some((f) => f.severity === "HIGH") ? "HIGH" : findings.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : "LOW"} />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Findings list */}
        <GlassCard className="p-4 lg:col-span-2 max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3">Findings ({findings.length})</h3>
          {findings.length === 0 ? (
            <EmptyState title="No findings" description="Run a scan to detect secrets, injections, and web vulnerabilities" icon={<ShieldCheck className="w-8 h-8" />} />
          ) : (
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={f.id} className="p-3 rounded-md bg-muted/30 border border-border/60">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={f.severity} />
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-muted">{f.category}</span>
                    <code className="text-[11px] font-mono text-muted-foreground ml-auto">{f.file}:{f.line}</code>
                  </div>
                  <p className="text-sm font-medium">{f.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-destructive">Evidence:</span> <code className="font-mono">{f.evidence}</code>
                  </p>
                  <p className="text-xs mt-1">
                    <span className="text-success">Recommendation:</span> {f.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Gate policy */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Security Gate Policy
          </h3>
          <div className="space-y-2">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) => (
              <div key={sev} className="flex items-center justify-between gap-2">
                <SeverityBadge severity={sev} />
                <select
                  value={policy[sev]}
                  onChange={(e) => setPolicy({ ...policy, [sev]: e.target.value as "block" | "warning" | "pass" })}
                  className="text-xs px-2 py-1 rounded-md bg-muted/60 border border-border font-mono"
                >
                  <option value="block">Block</option>
                  <option value="warning">Warning</option>
                  <option value="pass">Pass</option>
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-md bg-muted/40 text-[10px] font-mono text-muted-foreground">
            <p className="mb-1">Categories scanned (V4 §29-31):</p>
            <ul className="space-y-0.5">
              <li>• Secrets (GITHUB_TOKEN, JWT, AWS, Stripe, private keys)</li>
              <li>• SQL / Command / Path Injection</li>
              <li>• XSS (innerHTML, dangerouslySetInnerHTML)</li>
              <li>• SSRF (fetch with user input)</li>
              <li>• CORS / CSRF / Headers / Logging</li>
              <li>• Unsafe upload (multer/formidable)</li>
              <li>• Database (schema, migration, relations)</li>
            </ul>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
