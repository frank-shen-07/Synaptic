"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { GraphNodeRecord } from "@/lib/graph/schema";
import type { ThoughtNodeData } from "@/lib/graph/layout";
import { cn, titleCase } from "@/lib/utils";

const typeStyles: Record<GraphNodeRecord["type"], string> = {
  seed: "border-teal-700/30 bg-teal-50 text-teal-950",
  inspiration: "border-teal-700/20 bg-teal-50/90 text-teal-950",
  target_audience: "border-blue-700/20 bg-blue-50/90 text-blue-950",
  technical_constraints: "border-orange-700/20 bg-orange-50/90 text-orange-950",
  business_constraints: "border-violet-700/20 bg-violet-50/90 text-violet-950",
  risks_failure_modes: "border-red-700/20 bg-red-50/90 text-red-950",
  prior_art: "border-amber-700/20 bg-amber-50/90 text-amber-950",
  adjacent_analogies: "border-indigo-700/20 bg-indigo-50/90 text-indigo-950",
  open_questions: "border-slate-700/20 bg-slate-50/90 text-slate-950",
  tensions: "border-rose-700/25 bg-rose-50/90 text-rose-950",
};

export function ThoughtNode({ data, selected }: NodeProps) {
  const record = (data as ThoughtNodeData).record as GraphNodeRecord;

  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[280px] rounded-[1.35rem] border p-4 shadow-[0_18px_38px_rgba(15,23,42,0.08)] transition",
        typeStyles[record.type],
        selected ? "scale-[1.02] shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-2 ring-slate-950/10" : "",
      )}
      style={{
        fontFamily: "var(--font-body)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-0 !bg-slate-800/55" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">{titleCase(record.type)}</p>
      <h3 className="mt-2 text-base font-semibold leading-5">{record.label}</h3>
      <p className="mt-2 text-sm leading-5 opacity-80">{record.summary}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] opacity-60">
        <span>Confidence {(record.confidence * 100).toFixed(0)}%</span>
        <span>{record.expandable ? "Expandable" : "Fixed"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-0 !bg-slate-800/55" />
    </div>
  );
}
