"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { GraphNodeRecord } from "@/lib/graph/schema";
import type { ThoughtNodeData } from "@/lib/graph/layout";
import { cn } from "@/lib/utils";

const typeStyles: Record<GraphNodeRecord["type"], string> = {
  seed: "border-teal-700/25 bg-teal-50 text-teal-950",
  inspiration: "border-teal-700/15 bg-teal-50/95 text-teal-950",
  target_audience: "border-blue-700/15 bg-blue-50/95 text-blue-950",
  technical_constraints: "border-orange-700/15 bg-orange-50/95 text-orange-950",
  business_constraints: "border-violet-700/15 bg-violet-50/95 text-violet-950",
  risks_failure_modes: "border-red-700/15 bg-red-50/95 text-red-950",
  prior_art: "border-amber-700/15 bg-amber-50/95 text-amber-950",
  adjacent_analogies: "border-indigo-700/15 bg-indigo-50/95 text-indigo-950",
  open_questions: "border-slate-700/15 bg-slate-50/95 text-slate-950",
  tensions: "border-rose-700/15 bg-rose-50/95 text-rose-950",
};

export function ThoughtNode({ data, selected }: NodeProps) {
  const record = (data as ThoughtNodeData).record as GraphNodeRecord;

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full border text-center shadow-[0_16px_36px_rgba(15,23,42,0.12)] transition",
        typeStyles[record.type],
        selected ? "scale-[1.03] ring-4 ring-slate-950/8 shadow-[0_22px_48px_rgba(15,23,42,0.18)]" : "",
      )}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-slate-800/45" />
      <div className="px-4">
        <h3 className="text-sm font-semibold leading-5 md:text-[15px]">{record.label}</h3>
        <p className="mt-2 text-[10px] uppercase tracking-[0.22em] opacity-60">
          {record.depth === 0 ? "Seed" : `${record.priorArt.length} crosschecks`}
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-slate-800/45" />
    </div>
  );
}
