"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className,
  glow,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  glow?: "blue" | "purple" | "none";
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-xl border border-border/60 shadow-lg",
        glow === "blue" && "neon-blue",
        glow === "purple" && "neon-purple",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatusDot({ status }: { status: "success" | "warning" | "error" | "info" | "idle" }) {
  const cls = {
    success: "bg-success pulse-success",
    warning: "bg-warning",
    error: "bg-destructive pulse-destructive",
    info: "bg-info",
    idle: "bg-muted-foreground",
  }[status];
  return <span className={cn("inline-block w-2 h-2 rounded-full", cls)} />;
}

export function NeonText({ children, color = "purple", className }: { children: ReactNode; color?: "blue" | "purple" | "pink"; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold",
        color === "blue" && "text-info neon-text-blue",
        color === "purple" && "text-primary neon-text-purple",
        color === "pink" && "text-[hsl(var(--neon-pink))] neon-text-purple",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }) {
  const cls = {
    LOW: "bg-success/15 text-success border-success/30",
    MEDIUM: "bg-warning/15 text-warning border-warning/30",
    HIGH: "bg-destructive/15 text-destructive border-destructive/30",
    CRITICAL: "bg-destructive/30 text-destructive border-destructive/60 pulse-destructive",
  }[level];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border", cls)}>
      {level}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" }) {
  const cls = {
    CRITICAL: "bg-destructive/30 text-destructive border-destructive/60",
    HIGH: "bg-destructive/15 text-destructive border-destructive/30",
    MEDIUM: "bg-warning/15 text-warning border-warning/30",
    LOW: "bg-info/15 text-info border-info/30",
    INFO: "bg-muted text-muted-foreground border-border",
  }[severity];
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border", cls)}>
      {severity}
    </span>
  );
}

export function PageHeader({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {icon && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-9 h-9 rounded-lg glass flex items-center justify-center text-primary neon-purple"
          >
            {icon}
          </motion.div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-muted-foreground/40 mb-3">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
    </div>
  );
}

export function MockBadge({ label = "MOCK" }: { label?: string }) {
  return (
    <span
      title="Data source is mock fallback — no real token configured"
      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-warning/40 bg-warning/10 text-warning"
    >
      {label}
    </span>
  );
}

export function RealBadge() {
  return (
    <span
      title="Connected to real API"
      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border border-success/40 bg-success/10 text-success"
    >
      LIVE
    </span>
  );
}
