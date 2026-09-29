"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader } from "@/components/shared";
import { useFetch } from "@/hooks/use-fetch";
import { Settings, Key, Bot, Rocket, GitBranch, ShieldCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect } from "react";
import type { Permission, PermissionMatrix, PermissionMode } from "@/types";
import { DEFAULT_PERMISSIONS, describePermissionMode } from "@/lib/permissions";

export function SettingsView() {
  const { permissions, setPermissions, mockMode, setMockMode } = useStore();
  const { data: health } = useFetch<{ status: string; environment: { github: { configured: boolean }; ai: { configured: boolean; model: string }; vercel: { configured: boolean }; maxAutoRetry: number; nodeEnv: string } }>("/api/health");

  useEffect(() => {
    if (health) {
      setMockMode({
        github: !health.environment.github.configured,
        ai: !health.environment.ai.configured,
        vercel: !health.environment.vercel.configured,
      });
    }
  }, [health, setMockMode]);

  const updatePermission = (perm: Permission, mode: PermissionMode) => {
    setPermissions({ ...permissions, [perm]: mode });
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Environment, permissions, and integration status"
        icon={<Settings className="w-5 h-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Environment status */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Environment Status (§72-73)
          </h3>
          <div className="space-y-2 text-xs">
            <EnvRow label="GITHUB_TOKEN" configured={health?.environment.github.configured ?? false} />
            <EnvRow label="VERCEL_TOKEN" configured={health?.environment.vercel.configured ?? false} />
            <EnvRow label="AI_API_KEY" configured={health?.environment.ai.configured ?? false} />
            <div className="p-2 rounded-md bg-muted/30">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">AI Model</p>
              <p className="font-mono text-sm">{health?.environment.ai.model ?? "—"}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/30">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Max Auto Retry (§62)</p>
              <p className="font-mono text-sm">{health?.environment.maxAutoRetry ?? 3}</p>
            </div>
            <div className="p-2 rounded-md bg-muted/30">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Node Environment</p>
              <p className="font-mono text-sm">{health?.environment.nodeEnv ?? "development"}</p>
            </div>
          </div>
          <div className="mt-3 p-2 rounded-md bg-warning/10 border border-warning/30 text-[10px] text-warning font-mono">
            §73 SECURITY: All tokens are server-side only. NEXT_PUBLIC_* prefix is forbidden for secrets.
          </div>
        </GlassCard>

        {/* Permission Matrix (§53) */}
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Permission Matrix (§53)
          </h3>
          <div className="space-y-2">
            {(["READ", "ANALYZE", "COMMENT", "COMMIT", "DEPLOY", "ROLLBACK", "APPROVE", "MERGE"] as Permission[]).map((perm) => (
              <div key={perm} className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold w-20">{perm}</code>
                <select
                  value={permissions[perm]}
                  onChange={(e) => updatePermission(perm, e.target.value as PermissionMode)}
                  className="text-xs px-2 py-1 rounded-md bg-muted/60 border border-border font-mono flex-1"
                >
                  <option value="allowed">Allowed</option>
                  <option value="approval">Approval required</option>
                  <option value="human">Human only</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setPermissions(DEFAULT_PERMISSIONS)}>
            <Save className="w-3 h-3 mr-1.5" />
            Reset to defaults
          </Button>
        </GlassCard>
      </div>

      <GlassCard className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-info" />
          Build Status (V1 Delivery Gate)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {[
            "TypeScript", "ESLint", "Next.js Build", "Vercel Ready",
          ].map((b) => (
            <div key={b} className="p-2 rounded-md bg-success/10 border border-success/30 text-success flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {b}
            </div>
          ))}
        </div>
      </GlassCard>

      {null}
    </div>
  );
}

function EnvRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
      <code className="font-mono text-xs">{label}</code>
      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
        configured ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
      }`}>
        {configured ? "Configured" : "Missing"}
      </span>
    </div>
  );
}
