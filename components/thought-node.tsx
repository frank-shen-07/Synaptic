"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps, useStore } from "@xyflow/react";

import type { GraphNodeRecord } from "@/lib/graph/schema";
import type { ThoughtNodeData } from "@/lib/graph/layout";

const DOT_COLORS: Record<GraphNodeRecord["type"], string> = {
  seed:                  "#14b8a6",
  inspiration:           "#2dd4bf",
  target_audience:       "#60a5fa",
  technical_constraints: "#fb923c",
  business_constraints:  "#a78bfa",
  risks_failure_modes:   "#f87171",
  prior_art:             "#fbbf24",
  adjacent_analogies:    "#818cf8",
  open_questions:        "#94a3b8",
  tensions:              "#fb7185",
};

const GLOW_COLORS: Record<GraphNodeRecord["type"], string> = {
  seed:                  "rgba(20,184,166,0.35)",
  inspiration:           "rgba(45,212,191,0.25)",
  target_audience:       "rgba(96,165,250,0.25)",
  technical_constraints: "rgba(251,146,60,0.25)",
  business_constraints:  "rgba(167,139,250,0.25)",
  risks_failure_modes:   "rgba(248,113,113,0.25)",
  prior_art:             "rgba(251,191,36,0.25)",
  adjacent_analogies:    "rgba(129,140,248,0.25)",
  open_questions:        "rgba(148,163,184,0.25)",
  tensions:              "rgba(251,113,133,0.25)",
};

function clampText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function ThoughtNodeInner({ data, selected }: NodeProps) {
  const record = (data as ThoughtNodeData).record as GraphNodeRecord;
  const zoom = useStore((s) => s.transform[2]);
  const [hovered, setHovered] = useState(false);

  const isSeed = record.depth === 0;
  const dotSize = isSeed ? 16 : Math.max(6, 11 - record.depth * 1.5);
  const color = DOT_COLORS[record.type];
  const glow = GLOW_COLORS[record.type];

  // Label appears only when zoomed in past 0.9
  const showLabel = zoom > 0.9 && !hovered;
  // Short 2-word label
  const shortLabel = clampText(record.label.split(" ").slice(0, 2).join(" "), 18);

  return (
    <div
      style={{ width: dotSize, height: dotSize, position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }}
      />

      {/* The dot */}
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: selected || hovered
            ? `0 0 0 3px ${glow}, 0 0 12px ${glow}`
            : isSeed
            ? `0 0 0 4px ${glow}`
            : "none",
          transform: hovered ? "scale(1.6)" : "scale(1)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />

      {/* Zoom-in label — floats below, no background */}
      {showLabel && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 5,
            whiteSpace: "nowrap",
            maxWidth: 88,
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            fontFamily: "var(--font-body)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: color,
            opacity: Math.min(1, (zoom - 0.9) * 5),
          }}
        >
          {shortLabel}
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 200,
            background: "rgba(255,253,249,0.97)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            padding: "10px 12px",
            pointerEvents: "none",
            zIndex: 1000,
            boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
            fontFamily: "var(--font-body)",
          }}
        >
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color, margin: 0 }}>
            {isSeed ? "Seed" : `Depth ${record.depth}`}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: "4px 0 0", lineHeight: 1.3 }}>
            {clampText(record.label, 82)}
          </p>
          {record.summary && (
            <p
              style={{
                fontSize: 11,
                color: "#64748b",
                margin: "5px 0 0",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {record.summary}
            </p>
          )}
          <p style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8", margin: "6px 0 0" }}>
            Click to explore →
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }}
      />
    </div>
  );
}

export const ThoughtNode = memo(ThoughtNodeInner);
