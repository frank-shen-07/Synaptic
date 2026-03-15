"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

import type { GraphNodeRecord, GraphEdgeRecord } from "@/lib/graph/schema";

type GraphTheme = "light" | "dark";

const DEPTH_PALETTES: Record<GraphTheme, string[]> = {
  light: ["#0f766e", "#2563eb", "#d97706", "#be185d"],
  dark: ["#63d1c4", "#86c7ff", "#ffb85c", "#ff9cbc"],
};

const NODE_COLORS_HEX: Record<GraphNodeRecord["type"], number> = {
  seed:                  0x14b8a6,
  inspiration:           0x2dd4bf,
  target_audience:       0x60a5fa,
  technical_constraints: 0xfb923c,
  business_constraints:  0xa78bfa,
  risks_failure_modes:   0xf87171,
  prior_art:             0xfbbf24,
  adjacent_analogies:    0x818cf8,
  open_questions:        0x94a3b8,
  tensions:              0xfb7185,
};

type Rgb = { r: number; g: number; b: number };

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  record: GraphNodeRecord;
  r: number;
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  edgeId: string;
};

type LabelRect = { x: number; y: number; width: number; height: number };
type LabelPlacement = LabelRect & {
  nodeId: string; text: string; textX: number; textY: number;
  fontSize: number; align: CanvasTextAlign; color: string; weight: string;
};
type GraphBounds = { minX: number; maxX: number; minY: number; maxY: number };
type ViewTransform = { x: number; y: number; k: number };

type Props = {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  theme: GraphTheme;
  resetViewVersion: number;
  mode3d: boolean;
  showSatellites: boolean;
  focusedPath: Set<string>;
  nodeNotes: Map<string, string>;
};

function hexToRgb(value: string): Rgb {
  const n = value.replace("#", "");
  const o = n.length === 3 ? 1 : 2;
  const c = (i: number) => n.slice(i * o, i * o + o);
  const e = (p: string) => (p.length === 1 ? p + p : p);
  return { r: parseInt(e(c(0)), 16), g: parseInt(e(c(1)), 16), b: parseInt(e(c(2)), 16) };
}

function mixColor(first: string, second: string, ratio: number) {
  const s = hexToRgb(first); const e = hexToRgb(second);
  const cl = Math.max(0, Math.min(1, ratio));
  const m = (f: number, t: number) => Math.round(f + (t - f) * cl);
  return `rgb(${m(s.r, e.r)}, ${m(s.g, e.g)}, ${m(s.b, e.b)})`;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexNumToRgbStr(hex: number) {
  return `rgb(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255})`;
}

function getNodeRadius(record: GraphNodeRecord) {
  if (record.depth === 0) return 14;
  return Math.max(5, 10 - record.depth * 1.5);
}

function getNodeOpacity(record: GraphNodeRecord) {
  if (record.depth === 0) return 1;
  if (record.depth === 1) return 0.88;
  if (record.depth === 2) return 0.70;
  return 0.50;
}

function getDepthColor(depth: number, theme: GraphTheme) {
  const palette = DEPTH_PALETTES[theme];
  return palette[Math.max(0, Math.min(depth, palette.length - 1))];
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rectContainsPoint(rect: LabelRect, x: number, y: number) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
function rectsOverlap(a: LabelRect, b: LabelRect) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}
function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 0.0001) return 0;
  return v > 0 ? 1 : 2;
}
function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  return px <= Math.max(ax, bx) && px >= Math.min(ax, bx) && py <= Math.max(ay, by) && py >= Math.min(ay, by);
}
function segmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const o1 = orientation(ax, ay, bx, by, cx, cy), o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay), o4 = orientation(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}
function lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rect: LabelRect) {
  if (rectContainsPoint(rect, x1, y1) || rectContainsPoint(rect, x2, y2)) return true;
  const { x, y, width: w, height: h } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, x, y, x + w, y) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segmentsIntersect(x1, y1, x2, y2, x, y + h, x, y)
  );
}
function trimTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text.trim();
  while (t.length > 0 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1).trimEnd();
  return t ? `${t}…` : "…";
}
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) { cur = next; continue; }
    if (!cur) { lines.push(trimTextToWidth(ctx, w, maxWidth)); } else { lines.push(cur); cur = w; }
    if (lines.length === maxLines) return lines;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
function getGraphBounds(simNodes: SimNode[]): GraphBounds | null {
  const pn = simNodes.filter(n => n.x != null && n.y != null);
  if (!pn.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of pn) {
    const p = n.r + 26;
    minX = Math.min(minX, (n.x ?? 0) - p); maxX = Math.max(maxX, (n.x ?? 0) + p);
    minY = Math.min(minY, (n.y ?? 0) - p); maxY = Math.max(maxY, (n.y ?? 0) + p);
  }
  return { minX, maxX, minY, maxY };
}
function getFittedTransform(bounds: GraphBounds, W: number, H: number): ViewTransform {
  const bw = Math.max(bounds.maxX - bounds.minX, 140), bh = Math.max(bounds.maxY - bounds.minY, 140);
  const pad = Math.min(W, H) * 0.16;
  const fitScale = Math.min(Math.max(W - pad * 2, W * 0.52) / bw, Math.max(H - pad * 2, H * 0.52) / bh);
  const k = Math.max(0.36, Math.min(1.85, fitScale * 1.08));
  return { x: W / 2 - ((bounds.minX + bounds.maxX) / 2) * k, y: H / 2 - ((bounds.minY + bounds.maxY) / 2) * k, k };
}

// Detail section keys that become satellite dots
const DETAIL_KEYS: Array<keyof GraphNodeRecord["details"]> = [
  "inspiration", "targetAudience", "technicalConstraints",
  "businessConstraints", "risksFailureModes", "adjacentAnalogies",
  "openQuestions", "tensions",
];
const SATELLITE_COLORS: Record<string, string> = {
  inspiration: "#2dd4bf", targetAudience: "#60a5fa",
  technicalConstraints: "#fb923c", businessConstraints: "#a78bfa",
  risksFailureModes: "#f87171", adjacentAnalogies: "#818cf8",
  openQuestions: "#94a3b8", tensions: "#fb7185",
};

export function ForceGraph({ nodes, edges, selectedNodeId, onNodeClick, theme, resetViewVersion, mode3d, showSatellites, focusedPath, nodeNotes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, k: 1 });
  const hoveredRef = useRef<SimNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const selectedIdRef = useRef(selectedNodeId);
  const initializedRef = useRef(false);
  const hasAutoFittedRef = useRef(false);
  const cameraAnimationRef = useRef<number | null>(null);
  const threeRef = useRef<{
    renderer: import("three").WebGLRenderer;
    scene: import("three").Scene;
    camera: import("three").PerspectiveCamera;
    pivot: import("three").Object3D;
    meshes: import("three").Mesh[];
    lineSeg: import("three").LineSegments;
    linePos: Float32Array;
    nodes: Array<{ id: string; record: GraphNodeRecord; r: number; x: number; y: number; z: number; vx: number; vy: number; vz: number }>;
    links: Array<{ source: number; target: number }>;
    labelSprites: import("three").Sprite[];
    descSprites: Array<import("three").Sprite | null>;
    rotX: number; rotY: number; autoRotY: number;
    isDragging: boolean; lastX: number; lastY: number;
    mouse: import("three").Vector2;
    raycaster: import("three").Raycaster;
    animFrame: number | null;
    resetView: () => void;
    cleanup: () => void;
  } | null>(null);

  useEffect(() => { selectedIdRef.current = selectedNodeId; }, [selectedNodeId]);

  const draw2d = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const { x, y, k } = transformRef.current;
    const simNodes = simNodesRef.current;
    const hovered = hoveredRef.current;
    const selectedId = selectedIdRef.current;
    const themeTint = theme === "dark" ? "#f8fafc" : "#10253d";
    const labelColor = theme === "dark" ? "rgba(224,231,241,0.84)" : "rgba(23,32,51,0.76)";
    const tooltipBg = theme === "dark" ? "rgba(6,12,20,0.95)" : "rgba(17,28,43,0.94)";
    const tooltipBody = theme === "dark" ? "#e2e8f0" : "#f8fafc";
    const tooltipMuted = theme === "dark" ? "#a7b5c8" : "#cbd5e1";
    const tooltipHint = theme === "dark" ? "#778da9" : "#94a3b8";
    const edgeSegs: Array<{x1:number;y1:number;x2:number;y2:number}> = [];

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));
    const resolvedColors = new Map<string, string>();
    const resolveColor = (node: SimNode) => {
      const c = resolvedColors.get(node.id);
      if (c) return c;
      const fc = mixColor(getDepthColor(node.record.depth, theme), themeTint, Math.min(node.record.depth * 0.04, 0.12));
      resolvedColors.set(node.id, fc); return fc;
    };

    edges.forEach(edge => {
      const s = nodeMap.get(edge.source), t = nodeMap.get(edge.target);
      if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return;
      const isNear = hovered && (hovered.id === s.id || hovered.id === t.id);
      const hasFocus = focusedPath.size > 0;
      const inFocus = hasFocus && focusedPath.has(s.id) && focusedPath.has(t.id);
      const dimmed = hasFocus && !inFocus;
      const ec = inFocus ? "#63d1c4" : mixColor(resolveColor(s), resolveColor(t), 0.5);
      const ba = theme === "dark" ? 0.24 : 0.38, aa = theme === "dark" ? 0.68 : 0.82, ha = theme === "dark" ? 0.46 : 0.58;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
      edgeSegs.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y });
      ctx.strokeStyle = dimmed ? "rgba(148,163,184,0.05)" : withAlpha(ec, inFocus ? 0.75 : isNear ? aa : edge.highlighted ? ha : ba);
      ctx.lineWidth = ((inFocus ? 2 : isNear ? 1.5 : 0.9) + (inFocus ? 0 : edge.strength * 0.65)) / k;
      ctx.stroke();
    });

    simNodes.forEach(node => {
      if (node.x == null || node.y == null) return;
      const color = resolveColor(node);
      const isHovered = hovered?.id === node.id, isSelected = node.id === selectedId;
      const hasFocus = focusedPath.size > 0;
      const inFocus = hasFocus && focusedPath.has(node.id);
      const dimmed = hasFocus && !inFocus;
      const r = node.r * (isHovered ? 1.55 : 1);

      if (inFocus) {
        ctx.globalAlpha = 0.12;
        ctx.beginPath(); ctx.arc(node.x, node.y, r + 9 / k, 0, Math.PI * 2);
        ctx.fillStyle = "#63d1c4"; ctx.fill();
      }

      ctx.globalAlpha = dimmed ? 0.1 : getNodeOpacity(node.record);
      ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = inFocus ? "#63d1c4" : color; ctx.fill();
      if (isSelected || isHovered) {
        ctx.globalAlpha = dimmed ? 0.05 : 0.22;
        ctx.beginPath(); ctx.arc(node.x, node.y, r + 5 / k, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Note dot (amber) — only when not dimmed
      if (!dimmed && nodeNotes.get(node.id)) {
        ctx.beginPath(); ctx.arc((node.x ?? 0) + node.r - 1, (node.y ?? 0) - node.r + 1, Math.max(2, 3 / k), 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24"; ctx.fill();
      }

      // Satellite dots for detail sections
      if (showSatellites && (isHovered || isSelected || k > 0.8)) {
        const details = node.record.details;
        const activeSections = DETAIL_KEYS.filter(key => details[key]?.length > 0);
        if (activeSections.length > 0) {
          const orbitR = r + 14 / k;
          const dotR = Math.max(1.5, 2.5 / k);
          activeSections.forEach((key, i) => {
            const angle = (i / activeSections.length) * Math.PI * 2 - Math.PI / 2;
            const sx = (node.x ?? 0) + Math.cos(angle) * orbitR;
            const sy = (node.y ?? 0) + Math.sin(angle) * orbitR;
            const dotColor = SATELLITE_COLORS[key] ?? "#94a3b8";
            ctx.globalAlpha = isHovered || isSelected ? 0.9 : 0.45;
            ctx.beginPath(); ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
            ctx.fillStyle = dotColor; ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      }
    });

    // Labels
    const visNodes = simNodes
      .filter(n => n.x != null && n.y != null)
      .filter(n => k > 1.1 || hovered?.id === n.id || n.id === selectedId || n.record.depth === 0)
      .sort((a, b) => {
        const sc = (n: SimNode) => n.id === selectedId ? 5 : hovered?.id === n.id ? 4 : n.record.depth === 0 ? 3 : Math.max(0, 2 - n.record.depth);
        return sc(b) - sc(a);
      });
    const occupied: LabelRect[] = [];

    for (const node of visNodes) {
      if (node.x == null || node.y == null) continue;
      const label = node.record.label.split(" ").slice(0, 3).join(" ");
      const isHovered = hovered?.id === node.id, isSelected = node.id === selectedId;
      const color = resolveColor(node);
      const baseFontSize = node.record.depth === 0 ? 15 : 12;
      const zb = Math.max(0.94, Math.min(1.55, Math.pow(k, 0.22)));
      const fontSize = (baseFontSize * zb) / k;
      const fw = node.record.depth === 0 || isSelected ? "600" : "500";
      ctx.font = `${fw} ${fontSize}px system-ui, sans-serif`;
      const tw = Math.max(ctx.measureText(label).width, label.length * fontSize * 0.42);
      const th = fontSize * 1.2, tp = Math.max(5 / k, 3.5);
      const off = (node.r + 9 / k) * (node.record.depth === 0 ? 1.15 : 1);
      const candidates: LabelPlacement[] = [
        { nodeId: node.id, text: label, textX: node.x, textY: node.y + off + th * 0.5, x: node.x - tw / 2 - tp, y: node.y + off, width: tw + tp * 2, height: th + tp, fontSize, align: "center", color: isHovered || isSelected ? color : labelColor, weight: fw },
        { nodeId: node.id, text: label, textX: node.x, textY: node.y - off - th * 0.2, x: node.x - tw / 2 - tp, y: node.y - off - th - tp, width: tw + tp * 2, height: th + tp, fontSize, align: "center", color: isHovered || isSelected ? color : labelColor, weight: fw },
        { nodeId: node.id, text: label, textX: node.x + off + tp, textY: node.y + th * 0.15, x: node.x + off, y: node.y - th / 2 - tp * 0.55, width: tw + tp * 2, height: th + tp, fontSize, align: "left", color: isHovered || isSelected ? color : labelColor, weight: fw },
        { nodeId: node.id, text: label, textX: node.x - off - tp, textY: node.y + th * 0.15, x: node.x - off - tw - tp * 2, y: node.y - th / 2 - tp * 0.55, width: tw + tp * 2, height: th + tp, fontSize, align: "right", color: isHovered || isSelected ? color : labelColor, weight: fw },
      ];
      let best: LabelPlacement | null = null, bestScore = Infinity;
      for (const c of candidates) {
        let score = 0;
        for (const r of occupied) if (rectsOverlap(c, r)) score += 1200;
        for (const on of simNodes) {
          if (on.id === node.id || on.x == null || on.y == null) continue;
          const margin = on.r + 6 / k;
          if (on.x >= c.x - margin && on.x <= c.x + c.width + margin && on.y >= c.y - margin && on.y <= c.y + c.height + margin) score += 220;
        }
        for (const seg of edgeSegs) if (lineIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, c)) score += 42;
        score += Math.abs(c.textY - node.y) * 0.08;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (!best) continue;
      if (bestScore > 900 && !isHovered && !isSelected && node.record.depth > 0) continue;
      occupied.push(best);
      ctx.font = `${best.weight} ${best.fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = best.color; ctx.textAlign = best.align; ctx.textBaseline = "middle";
      ctx.fillText(best.text, best.textX, best.textY);
    }
    ctx.textBaseline = "alphabetic";
    ctx.restore();

    // Tooltip
    if (hovered && hovered.x != null && hovered.y != null) {
      const sx = hovered.x * k + x, sy = hovered.y * k + y;
      const color = resolvedColors.get(hovered.id) ?? getDepthColor(hovered.record.depth, theme);
      const hasSummary = Boolean(hovered.record.summary);
      const bw = 220, px = 12, topP = 14, gap = 7, botP = 12;
      const cx2 = Math.max(bw / 2 + 8, Math.min(sx + 14 + bw / 2, W - bw / 2 - 8));
      const maxTW = bw - px * 2;
      ctx.font = "600 12px system-ui, sans-serif";
      const titleLines = wrapCanvasText(ctx, hovered.record.label, maxTW, 2);
      ctx.font = "400 10px system-ui, sans-serif";
      const summaryLines = hasSummary ? wrapCanvasText(ctx, hovered.record.summary, maxTW, 2) : [];
      const bh = topP + 10 + gap + titleLines.length * 15 + (summaryLines.length ? gap + summaryLines.length * 13 : 0) + gap + 9 + botP;
      const bx = cx2 - bw / 2, by = Math.max(sy - bh - 12, 8);
      ctx.fillStyle = tooltipBg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10); else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      let ty = by + topP;
      ctx.font = "600 10px system-ui, sans-serif"; ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.fillText(hovered.record.type.replace(/_/g, " "), cx2, ty); ty += 10 + gap;
      ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = tooltipBody;
      for (const l of titleLines) { ctx.fillText(l, cx2, ty); ty += 15; }
      if (summaryLines.length) {
        ty += gap; ctx.font = "400 10px system-ui, sans-serif"; ctx.fillStyle = tooltipMuted;
        for (const l of summaryLines) { ctx.fillText(l, cx2, ty); ty += 13; }
      }
      ctx.font = "400 9px system-ui, sans-serif"; ctx.fillStyle = tooltipHint;
      ctx.fillText("click to explore →", cx2, by + bh - botP);
      ctx.textAlign = "left";
    }
  }, [edges, theme, showSatellites, focusedPath, nodeNotes]);

  useEffect(() => {
    if (!mode3d) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw2d);
    }
  }, [focusedPath, nodeNotes, mode3d, draw2d]);

  // 3D setup
  const init3d = useCallback(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    import("three").then((THREE) => {
      if (threeRef.current) {
        threeRef.current.cleanup();
        threeRef.current = null;
      }

      const W = container.clientWidth, H = container.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
      renderer.domElement.style.position = "absolute";
      renderer.domElement.style.inset = "0";
      renderer.domElement.style.cursor = "grab";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
      camera.position.set(0, 0, 300);

      const simNodes3d = nodes.map((record, i) => ({
        id: record.id, record, r: getNodeRadius(record),
        x: (Math.random() - 0.5) * 260, y: (Math.random() - 0.5) * 260, z: (Math.random() - 0.5) * 260,
        vx: 0, vy: 0, vz: 0,
      }));

      const idToIdx = new Map(simNodes3d.map((n, i) => [n.id, i]));
      const links3d = edges.map(e => ({ source: idToIdx.get(e.source) ?? 0, target: idToIdx.get(e.target) ?? 0 }));

      const pivot = new THREE.Object3D();
      scene.add(pivot);
      const meshes: import("three").Mesh[] = [];

      simNodes3d.forEach(n => {
        const hexColor = NODE_COLORS_HEX[n.record.type] ?? 0x94a3b8;
        const opacity = getNodeOpacity(n.record);
        const geo = new THREE.SphereGeometry(n.r, n.record.depth === 0 ? 16 : 10, n.record.depth === 0 ? 16 : 10);
        const mat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { idx: meshes.length };
        pivot.add(mesh);
        meshes.push(mesh);
      });

      // Satellite dots in 3D
      if (showSatellites) {
        simNodes3d.forEach((n, ni) => {
          const activeSections = DETAIL_KEYS.filter(key => n.record.details[key]?.length > 0);
          activeSections.forEach((key, i) => {
            const angle = (i / activeSections.length) * Math.PI * 2;
            const orbitR = n.r + 5;
            const hexColor = parseInt((SATELLITE_COLORS[key] ?? "#94a3b8").replace("#", ""), 16);
            const geo = new THREE.SphereGeometry(1.8, 6, 6);
            const mat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 0.6 });
            const sat = new THREE.Mesh(geo, mat);
            sat.userData = { isSatellite: true, parentIdx: ni, angle, orbitR };
            pivot.add(sat);
          });
        });
      }

      const lineCount = links3d.length;
      const linePos = new Float32Array(lineCount * 6);
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
      const lineSeg = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 }));
      pivot.add(lineSeg);

      // Canvas-texture label sprites (always visible) and description sprites (visible when zoomed in)
      const labelSprites: import("three").Sprite[] = [];
      const descSprites: Array<import("three").Sprite | null> = [];
      simNodes3d.forEach(n => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // --- Label sprite: dark pill background, white text ---
        const lfs = (n.record.depth === 0 ? 18 : 13) * dpr;
        const lfw = n.record.depth === 0 ? "700" : "600";
        const hPad = 10 * dpr, vPad = 6 * dpr;
        // Measure text on a scratch canvas
        const msc = document.createElement("canvas");
        const mctx = msc.getContext("2d")!;
        mctx.font = `${lfw} ${lfs}px system-ui, sans-serif`;
        let lbl = n.record.label;
        const maxLblW = 180 * dpr;
        while (mctx.measureText(lbl).width > maxLblW && lbl.length > 1) lbl = lbl.slice(0, -1).trimEnd();
        if (lbl !== n.record.label) lbl += "\u2026";
        const textW = Math.min(mctx.measureText(lbl).width, maxLblW);
        const lcw = Math.ceil(textW + hPad * 2);
        const lch = Math.ceil(lfs + vPad * 2);
        const lc = document.createElement("canvas");
        lc.width = lcw; lc.height = lch;
        const lctx = lc.getContext("2d")!;
        lctx.fillStyle = "rgba(6, 12, 26, 0.84)";
        drawRoundRect(lctx, 0, 0, lcw, lch, lch / 2);
        lctx.fill();
        lctx.font = `${lfw} ${lfs}px system-ui, sans-serif`;
        lctx.fillStyle = "#ffffff";
        lctx.textAlign = "center"; lctx.textBaseline = "middle";
        lctx.fillText(lbl, lcw / 2, lch / 2);
        const lt = new THREE.CanvasTexture(lc); lt.needsUpdate = true;
        const ls = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthTest: false }));
        const lww = n.record.depth === 0 ? 30 : 22;
        ls.scale.set(lww, lww * lch / lcw, 1);
        pivot.add(ls);
        labelSprites.push(ls);

        // --- Description sprite: dark rounded rect, muted text ---
        if (n.record.summary && n.record.depth > 0) {
          const dfs = 12 * dpr;
          const dHPad = 12 * dpr, dVPad = 9 * dpr;
          const lineH = dfs * 1.5;
          const maxDLineW = 220 * dpr;
          const mdc = document.createElement("canvas");
          const mdctx = mdc.getContext("2d")!;
          mdctx.font = `400 ${dfs}px system-ui, sans-serif`;
          const dwords = n.record.summary.split(/\s+/).filter(Boolean);
          const dlines: string[] = [];
          let dcur = "";
          for (const w of dwords) {
            const next = dcur ? `${dcur} ${w}` : w;
            if (mdctx.measureText(next).width <= maxDLineW) { dcur = next; }
            else { if (dcur) dlines.push(dcur); dcur = w; if (dlines.length >= 2) break; }
          }
          if (dcur && dlines.length < 3) dlines.push(dcur);
          const maxLW = Math.max(...dlines.map(l => mdctx.measureText(l).width), 60 * dpr);
          const dcw = Math.ceil(maxLW + dHPad * 2);
          const dch = Math.ceil(dlines.length * lineH + dVPad * 2);
          const dc = document.createElement("canvas");
          dc.width = dcw; dc.height = dch;
          const dctx = dc.getContext("2d")!;
          dctx.fillStyle = "rgba(6, 12, 26, 0.78)";
          drawRoundRect(dctx, 0, 0, dcw, dch, Math.min(dch * 0.38, 10 * dpr));
          dctx.fill();
          dctx.font = `400 ${dfs}px system-ui, sans-serif`;
          dctx.fillStyle = "rgba(203, 213, 225, 0.95)";
          dctx.textAlign = "center"; dctx.textBaseline = "top";
          dlines.forEach((line, li) => dctx.fillText(line, dcw / 2, dVPad + li * lineH));
          const dt = new THREE.CanvasTexture(dc); dt.needsUpdate = true;
          const ds = new THREE.Sprite(new THREE.SpriteMaterial({ map: dt, transparent: true, depthTest: false }));
          const dww = 32;
          ds.scale.set(dww, dww * dch / dcw, 1);
          ds.visible = false;
          pivot.add(ds);
          descSprites.push(ds);
        } else {
          descSprites.push(null);
        }
      });

      let rotX = 0, rotY = 0, autoRotY = 0, isDragging = false, lastX = 0, lastY = 0;
      const mouse = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();
      let animFrame: number | null = null;
      let physicsFrame = 0;

      function tickPhysics() {
        const alpha = 0.018, repulsion = 4200, linkDist = 185, linkStr = 0.26, centerF = 0.0065, damping = 0.82;
        simNodes3d.forEach(n => { n.vx -= n.x * centerF; n.vy -= n.y * centerF; n.vz -= n.z * centerF; });
        for (let i = 0; i < simNodes3d.length; i++) {
          for (let j = i + 1; j < simNodes3d.length; j++) {
            const a = simNodes3d[i], b = simNodes3d[j];
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz + 0.01);
            const force = repulsion / (dist * dist);
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;
            a.vx -= nx * force * alpha; a.vy -= ny * force * alpha; a.vz -= nz * force * alpha;
            b.vx += nx * force * alpha; b.vy += ny * force * alpha; b.vz += nz * force * alpha;
          }
        }
        links3d.forEach(l => {
          const s = simNodes3d[l.source], t = simNodes3d[l.target];
          const dx = t.x - s.x, dy = t.y - s.y, dz = t.z - s.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
          const force = (dist - linkDist) * linkStr * alpha;
          const nx = dx / dist, ny = dy / dist, nz = dz / dist;
          s.vx += nx * force; s.vy += ny * force; s.vz += nz * force;
          t.vx -= nx * force; t.vy -= ny * force; t.vz -= nz * force;
        });
        simNodes3d.forEach((n, i) => {
          n.vx *= damping; n.vy *= damping; n.vz *= damping;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;
          meshes[i].position.set(n.x, n.y, n.z);
        });
        // Update satellites
        pivot.children.forEach(child => {
          if (child.userData.isSatellite) {
            const p = simNodes3d[child.userData.parentIdx];
            const a = child.userData.angle, or = child.userData.orbitR;
            child.position.set(p.x + Math.cos(a) * or, p.y + Math.sin(a) * or, p.z);
          }
        });
        // Update line positions
        links3d.forEach((l, i) => {
          const s = simNodes3d[l.source], t = simNodes3d[l.target];
          linePos[i*6]=s.x; linePos[i*6+1]=s.y; linePos[i*6+2]=s.z;
          linePos[i*6+3]=t.x; linePos[i*6+4]=t.y; linePos[i*6+5]=t.z;
        });
        lineGeo.attributes.position.needsUpdate = true;
      }

      function animate() {
        animFrame = requestAnimationFrame(animate);
        if (physicsFrame < 600) { tickPhysics(); physicsFrame++; }
        else if (Math.random() < 0.02) tickPhysics();

        // Update focus dimming and note dots per frame
        simNodes3d.forEach((n, i) => {
          const mesh = meshes[i];
          if (!mesh) return;
          const hasFocus = focusedPath.size > 0;
          const inFocus = !hasFocus || focusedPath.has(n.id);
          const mat = mesh.material as import("three").MeshBasicMaterial;
          if (hasFocus && focusedPath.has(n.id)) {
            mat.color.setHex(0x63d1c4);
            mat.opacity = 1;
          } else if (hasFocus) {
            mat.color.setHex(NODE_COLORS_HEX[n.record.type] ?? 0x94a3b8);
            mat.opacity = 0.08;
          } else {
            mat.color.setHex(NODE_COLORS_HEX[n.record.type] ?? 0x94a3b8);
            mat.opacity = getNodeOpacity(n.record);
          }
        });

        // Update label and description sprite positions to follow nodes
        simNodes3d.forEach((n, i) => {
          labelSprites[i].position.set(n.x, n.y + n.r + 7, n.z);
          const hasFocus = focusedPath.size > 0;
          const inFocus = hasFocus && focusedPath.has(n.id);
          const isSelected = selectedIdRef.current === n.id;
          const hasNote = Boolean(nodeNotes.get(n.id)?.trim());
          const zoomedIn = camera.position.z < 220;
          const showLabel = inFocus || isSelected || n.record.depth === 0 || zoomedIn;
          const labelMat = labelSprites[i].material as import("three").SpriteMaterial;
          labelSprites[i].visible = showLabel;
          labelMat.opacity = showLabel
            ? (inFocus || isSelected ? 1 : hasNote ? 0.95 : zoomedIn ? 0.72 : 0.56)
            : 0;
        });
        const showDesc = camera.position.z < 230;
        descSprites.forEach((s, i) => {
          if (!s) return;
          const n = simNodes3d[i];
          s.position.set(n.x, n.y - n.r - 10, n.z);
          const hasFocus = focusedPath.size > 0;
          const inFocus = hasFocus && focusedPath.has(n.id);
          const isSelected = selectedIdRef.current === n.id;
          s.visible = showDesc && (!hasFocus || inFocus || isSelected);
          const descMat = s.material as import("three").SpriteMaterial;
          descMat.opacity = isSelected ? 1 : inFocus ? 0.95 : 0.84;
        });
        if (!isDragging) autoRotY += 0.002;
        pivot.rotation.y = rotY + autoRotY;
        pivot.rotation.x = rotX;
        renderer.render(scene, camera);
      }
      animate();

      function resetView3d() { rotX = 0; rotY = 0; autoRotY = 0; camera.position.z = 300; }
      const onMouseDown = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.style.cursor = "grabbing"; };
      const onMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        if (isDragging) { rotY += (e.clientX - lastX) * 0.006; rotX += (e.clientY - lastY) * 0.006; lastX = e.clientX; lastY = e.clientY; }
      };
      const onMouseUp = () => { isDragging = false; renderer.domElement.style.cursor = "grab"; };
      const onWheel = (e: WheelEvent) => { e.preventDefault(); camera.position.z = Math.max(80, Math.min(600, camera.position.z + e.deltaY * 0.4)); };
      const onClick = (e: MouseEvent) => {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes);
        if (hits.length > 0) {
          const idx = hits[0].object.userData.idx;
          if (idx != null) onNodeClick(simNodes3d[idx].id);
        }
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      renderer.domElement.addEventListener("click", onClick);

      threeRef.current = {
        renderer, scene, camera, pivot, meshes, lineSeg, linePos,
        nodes: simNodes3d, links: links3d,
        labelSprites, descSprites,
        rotX, rotY, autoRotY, isDragging, lastX, lastY,
        mouse, raycaster, animFrame,
        resetView: resetView3d,
        cleanup: () => {
          if (animFrame) cancelAnimationFrame(animFrame);
          renderer.domElement.removeEventListener("mousedown", onMouseDown);
          renderer.domElement.removeEventListener("mousemove", onMouseMove);
          renderer.domElement.removeEventListener("mouseup", onMouseUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
          renderer.domElement.removeEventListener("click", onClick);
          labelSprites.forEach(s => { const m = s.material as import("three").SpriteMaterial; m.map?.dispose(); m.dispose(); });
          descSprites.forEach(s => { if (!s) return; const m = s.material as import("three").SpriteMaterial; m.map?.dispose(); m.dispose(); });
          renderer.dispose();
          if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
        },
      };
    });
  }, [nodes, edges, onNodeClick, showSatellites]);

  // Switch between 2D and 3D
  useEffect(() => {
    if (mode3d) {
      if (threeRef.current) return;
      init3d();
    } else {
      if (threeRef.current) {
        threeRef.current.cleanup();
        threeRef.current = null;
      }
    }
    return () => {
      if (mode3d && threeRef.current) {
        threeRef.current.cleanup();
        threeRef.current = null;
      }
    };
  }, [mode3d, init3d]);

  // 3D reset view
  useEffect(() => {
    if (!mode3d || resetViewVersion === 0) return;
    threeRef.current?.resetView();
  }, [mode3d, resetViewVersion]);

  // 2D simulation
  useEffect(() => {
    if (mode3d) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function animateTransformTo(target: ViewTransform, duration = 320) {
      if (cameraAnimationRef.current) cancelAnimationFrame(cameraAnimationRef.current);
      const start = { ...transformRef.current }, startedAt = performance.now();
      const ease = (v: number) => 1 - Math.pow(1 - v, 3);
      const step = (now: number) => {
        const p = Math.min(1, (now - startedAt) / duration), e = ease(p);
        transformRef.current = { x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e, k: start.k + (target.k - start.k) * e };
        draw2d();
        if (p < 1) cameraAnimationRef.current = requestAnimationFrame(step); else cameraAnimationRef.current = null;
      };
      cameraAnimationRef.current = requestAnimationFrame(step);
    }

    function resetView(duration = 320) {
      const c = canvasRef.current, gb = getGraphBounds(simNodesRef.current);
      if (!c || !gb || c.width === 0 || c.height === 0) return;
      animateTransformTo(getFittedTransform(gb, c.width, c.height), duration);
    }

    function initSim(W: number, H: number) {
      const existingPositions = new Map(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));
      const simNodes: SimNode[] = nodes.map(record => {
        const ex = existingPositions.get(record.id);
        return { id: record.id, record, r: getNodeRadius(record), x: ex?.x ?? (Math.random() - 0.5) * 80, y: ex?.y ?? (Math.random() - 0.5) * 80 };
      });
      const simLinks: SimLink[] = edges.map(edge => ({ edgeId: edge.id, source: edge.source, target: edge.target }));
      simNodesRef.current = simNodes;
      hasAutoFittedRef.current = false;
      if (!initializedRef.current) { transformRef.current = { x: W / 2, y: H / 2, k: 1 }; initializedRef.current = true; }
      simRef.current?.stop();
      const sim = d3.forceSimulation<SimNode, SimLink>(simNodes)
        .force("charge", d3.forceManyBody<SimNode>().strength(n => -70 * (1 + (n.record.depth ?? 0) * 0.35)))
        .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id(n => n.id).distance(l => { const s = l.source as SimNode; return 55 + (s.record?.depth ?? 0) * 18; }).strength(0.55))
        .force("center", d3.forceCenter(0, 0).strength(0.035))
        .force("collision", d3.forceCollide<SimNode>().radius(n => n.r + 5))
        .alphaDecay(0.018).velocityDecay(0.38);
      simRef.current = sim;
      sim.on("tick", () => {
        if (!hasAutoFittedRef.current) {
          const gb = getGraphBounds(simNodesRef.current);
          const c = canvasRef.current;
          if (gb && c && c.width > 0 && c.height > 0 && sim.alpha() < 0.24) { transformRef.current = getFittedTransform(gb, c.width, c.height); hasAutoFittedRef.current = true; }
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw2d);
      });
      return sim;
    }

    let sim: d3.Simulation<SimNode, SimLink> | undefined;
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        canvas.width = width; canvas.height = height;
        if (!sim) { sim = initSim(width, height) ?? undefined; } else { resetView(360); draw2d(); }
      }
    });
    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) { canvas.width = rect.width; canvas.height = rect.height; sim = initSim(rect.width, rect.height) ?? undefined; }
    }

    let isPanning = false, panStart = { x: 0, y: 0 }, dragNode: SimNode | null = null, didDrag = false;

    function getNode(mx: number, my: number) {
      const { x, y, k } = transformRef.current, wx = (mx - x) / k, wy = (my - y) / k;
      const sn = simNodesRef.current;
      for (let i = sn.length - 1; i >= 0; i--) {
        const n = sn[i]; if (n.x == null || n.y == null) continue;
        const dx = wx - n.x, dy = wy - n.y;
        if (dx * dx + dy * dy < (n.r + 7) ** 2) return n;
      }
      return null;
    }
    function onPointerDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      didDrag = false;
      const node = getNode(mx, my);
      if (node) { dragNode = node; node.fx = node.x; node.fy = node.y; sim?.alphaTarget(0.25).restart(); canvas!.setPointerCapture(e.pointerId); }
      else { isPanning = true; panStart = { x: mx - transformRef.current.x, y: my - transformRef.current.y }; canvas!.setPointerCapture(e.pointerId); }
    }
    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (dragNode) { didDrag = true; const { x, y, k } = transformRef.current; dragNode.fx = (mx - x) / k; dragNode.fy = (my - y) / k; sim?.alpha(0.25).restart(); }
      else if (isPanning) { didDrag = true; transformRef.current = { ...transformRef.current, x: mx - panStart.x, y: my - panStart.y }; draw2d(); }
      else { const prev = hoveredRef.current; hoveredRef.current = getNode(mx, my); canvas!.style.cursor = hoveredRef.current ? "pointer" : "grab"; if (prev !== hoveredRef.current) draw2d(); }
    }
    function onPointerUp() { if (dragNode) { dragNode.fx = null; dragNode.fy = null; sim?.alphaTarget(0); dragNode = null; } isPanning = false; }
    function onClick(e: MouseEvent) { if (didDrag) return; const rect = canvas!.getBoundingClientRect(); const node = getNode(e.clientX - rect.left, e.clientY - rect.top); if (node) onNodeClick(node.id); }
    function onMouseLeave() { hoveredRef.current = null; canvas!.style.cursor = "grab"; draw2d(); }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { x, y, k } = transformRef.current, factor = e.deltaY < 0 ? 1.12 : 0.9, newK = Math.max(0.05, Math.min(6, k * factor));
      transformRef.current = { x: mx - ((mx - x) * newK) / k, y: my - ((my - y) * newK) / k, k: newK }; draw2d();
    }
    if (resetViewVersion > 0) resetView(360);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.style.cursor = "grab";
    return () => {
      sim?.stop(); resizeObserver.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraAnimationRef.current) cancelAnimationFrame(cameraAnimationRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, edges, draw2d, onNodeClick, resetViewVersion, mode3d]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: mode3d ? "none" : "block" }}
      />
    </div>
  );
}
