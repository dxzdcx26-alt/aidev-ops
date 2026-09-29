"use client";

import { useStore } from "@/store";
import { GlassCard, PageHeader, EmptyState } from "@/components/shared";
import { Boxes, ZoomIn, ZoomOut, Move, Maximize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import type { ArchitectureNode, ArchitectureEdge } from "@/types";

const TYPE_COLORS: Record<ArchitectureNode["type"], string> = {
  frontend: "hsl(199 89% 60%)",
  backend: "hsl(263 70% 60%)",
  api: "hsl(142 71% 50%)",
  database: "hsl(38 92% 55%)",
  service: "hsl(322 80% 60%)",
  auth: "hsl(0 72% 56%)",
  infra: "hsl(240 5% 64.9%)",
  external: "hsl(240 5% 40%)",
};

export function WhiteboardView() {
  const { currentAnalysis } = useStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = currentAnalysis?.architecture.nodes ?? [];
  const edges = currentAnalysis?.architecture.edges ?? [];

  // Initialize positions in a circular layout (async to avoid set-state-in-effect warning)
  useEffect(() => {
    if (nodes.length === 0) return;
    const t = setTimeout(() => {
      setPositions((prev) => {
        const next = { ...prev };
        const cx = 400, cy = 300, r = 200;
        nodes.forEach((n, i) => {
          if (!next[n.id]) {
            const angle = (i / nodes.length) * Math.PI * 2;
            next[n.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
          }
        });
        return next;
      });
    }, 0);
    return () => clearTimeout(t);
  }, [nodes]);

  if (!currentAnalysis) {
    return (
      <div>
        <PageHeader title="Architecture Whiteboard" subtitle="V4 §41-44 · Generated from real diff + AI analysis" icon={<Boxes className="w-5 h-5" />} />
        <GlassCard className="p-12">
          <EmptyState
            title="No whiteboard yet"
            description="Run an AI analysis first — the whiteboard is generated from the architecture graph in the structured output."
            icon={<Boxes className="w-12 h-12" />}
          />
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Architecture Whiteboard"
        subtitle={`${nodes.length} nodes · ${edges.length} edges · click and drag to rearrange`}
        icon={<Boxes className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      <GlassCard className="p-0 overflow-hidden" style={{ height: "70vh" }}>
        <div
          ref={containerRef}
          className="relative w-full h-full cyber-grid cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDragging({ id: "__pan__", dx: e.clientX - pan.x, dy: e.clientY - pan.y });
            }
          }}
          onMouseMove={(e) => {
            if (dragging?.id === "__pan__") {
              setPan({ x: e.clientX - dragging.dx, y: e.clientY - dragging.dy });
            } else if (dragging) {
              setPositions((p) => ({
                ...p,
                [dragging.id]: {
                  x: (e.clientX - pan.x - dragging.dx) / zoom,
                  y: (e.clientY - pan.y - dragging.dy) / zoom,
                },
              }));
            }
          }}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
        >
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* SVG edges */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
              {edges.map((e) => {
                const from = positions[e.from];
                const to = positions[e.to];
                if (!from || !to) return null;
                return (
                  <g key={e.id}>
                    <motion.line
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      x1={from.x + 80}
                      y1={from.y + 20}
                      x2={to.x}
                      y2={to.y + 20}
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      markerEnd="url(#arrow)"
                    />
                    {e.label && (
                      <text
                        x={(from.x + 80 + to.x) / 2}
                        y={(from.y + 20 + to.y + 20) / 2 - 4}
                        fill="hsl(var(--muted-foreground))"
                        fontSize={10}
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--primary))" />
                </marker>
              </defs>
            </svg>

            {/* Nodes */}
            {nodes.map((n) => {
              const pos = positions[n.id];
              if (!pos) return null;
              const color = TYPE_COLORS[n.type];
              return (
                <motion.div
                  key={n.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute glass-strong rounded-lg p-2 cursor-grab active:cursor-grabbing select-none"
                  style={{ left: pos.x, top: pos.y, width: 160, borderColor: color }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragging({ id: n.id, dx: e.clientX - pan.x - pos.x * zoom, dy: e.clientY - pan.y - pos.y * zoom });
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-mono uppercase text-muted-foreground">{n.type}</span>
                  </div>
                  <p className="text-xs font-mono font-semibold truncate">{n.label}</p>
                  {n.file && <p className="text-[10px] text-muted-foreground/70 truncate font-mono">{n.file}</p>}
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 glass-strong rounded-md p-2 text-[10px] font-mono space-y-1">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="uppercase text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Code Linking (V4 §43)</p>
          <p className="text-xs">Each node carries <code className="font-mono text-info">file</code>, <code className="font-mono text-info">line</code>, <code className="font-mono text-info">function</code>, <code className="font-mono text-info">module</code> metadata.</p>
        </GlassCard>
        <GlassCard className="p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Interactions</p>
          <p className="text-xs">Zoom, pan, drag nodes, click to inspect. Selection routes to Diff Viewer with line context.</p>
        </GlassCard>
        <GlassCard className="p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Source</p>
          <p className="text-xs">Generated from AI analysis architecture graph. Falls back to baseline analyzer when AI is unavailable.</p>
        </GlassCard>
      </div>
    </div>
  );
}
