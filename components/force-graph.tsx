"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

import type { GraphNodeRecord, GraphEdgeRecord } from "@/lib/graph/schema";

type GraphTheme = "light" | "dark";

const DEPTH_PALETTES: Record<GraphTheme, string[]> = {
  light: ["#0f766e", "#2563eb", "#d97706", "#be185d"],
  dark: ["#63d1c4", "#86c7ff", "#ffb85c", "#ff9cbc"],
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type SimNode = d3.SimulationNodeDatum & {
  id: string;
  record: GraphNodeRecord;
  r: number;
};

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  edgeId: string;
};

type LabelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LabelPlacement = LabelRect & {
  nodeId: string;
  text: string;
  textX: number;
  textY: number;
  fontSize: number;
  align: CanvasTextAlign;
  color: string;
  weight: string;
};

type GraphBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type ViewTransform = {
  x: number;
  y: number;
  k: number;
};

type Props = {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  theme: GraphTheme;
  resetViewVersion: number;
};

function hexToRgb(value: string): Rgb {
  const normalized = value.replace("#", "");
  const offset = normalized.length === 3 ? 1 : 2;
  const chunk = (index: number) => normalized.slice(index * offset, index * offset + offset);
  const expand = (piece: string) => (piece.length === 1 ? `${piece}${piece}` : piece);

  return {
    r: Number.parseInt(expand(chunk(0)), 16),
    g: Number.parseInt(expand(chunk(1)), 16),
    b: Number.parseInt(expand(chunk(2)), 16),
  };
}

function mixColor(first: string, second: string, ratio: number) {
  const start = hexToRgb(first);
  const end = hexToRgb(second);
  const clamped = Math.max(0, Math.min(1, ratio));
  const mixChannel = (from: number, to: number) => Math.round(from + (to - from) * clamped);

  return `rgb(${mixChannel(start.r, end.r)}, ${mixChannel(start.g, end.g)}, ${mixChannel(start.b, end.b)})`;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const index = Math.max(0, Math.min(depth, palette.length - 1));
  return palette[index];
}

function rectContainsPoint(rect: LabelRect, x: number, y: number) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function rectsOverlap(first: LabelRect, second: LabelRect) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 0.0001) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  return (
    px <= Math.max(ax, bx) &&
    px >= Math.min(ax, bx) &&
    py <= Math.max(ay, by) &&
    py >= Math.min(ay, by)
  );
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const first = orientation(ax, ay, bx, by, cx, cy);
  const second = orientation(ax, ay, bx, by, dx, dy);
  const third = orientation(cx, cy, dx, dy, ax, ay);
  const fourth = orientation(cx, cy, dx, dy, bx, by);

  if (first !== second && third !== fourth) return true;
  if (first === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (second === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (third === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (fourth === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

function lineIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: LabelRect,
) {
  if (rectContainsPoint(rect, x1, y1) || rectContainsPoint(rect, x2, y2)) {
    return true;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  return (
    segmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
    segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
  );
}

function trimTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let trimmed = text.trim();

  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }

  return trimmed ? `${trimmed}…` : "…";
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      continue;
    }

    if (!currentLine) {
      lines.push(trimTextToWidth(ctx, word, maxWidth));
    } else {
      lines.push(currentLine);
      currentLine = word;
    }

    if (lines.length === maxLines) {
      return lines;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (currentLine && lines.length === maxLines && ctx.measureText(currentLine).width > maxWidth) {
    lines[maxLines - 1] = trimTextToWidth(ctx, currentLine, maxWidth);
  }

  if (words.length > 0 && lines.length === maxLines) {
    const rendered = lines.join(" ").replace(/…$/, "").trim();
    const original = words.join(" ").trim();

    if (rendered.length < original.length) {
      lines[maxLines - 1] = trimTextToWidth(ctx, lines[maxLines - 1], maxWidth);
    }
  }

  return lines;
}

function getGraphBounds(simNodes: SimNode[]): GraphBounds | null {
  const positionedNodes = simNodes.filter((node) => node.x != null && node.y != null);

  if (positionedNodes.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of positionedNodes) {
    const nodeX = node.x ?? 0;
    const nodeY = node.y ?? 0;
    const padding = node.r + 26;

    minX = Math.min(minX, nodeX - padding);
    maxX = Math.max(maxX, nodeX + padding);
    minY = Math.min(minY, nodeY - padding);
    maxY = Math.max(maxY, nodeY + padding);
  }

  return { minX, maxX, minY, maxY };
}

function getFittedTransform(bounds: GraphBounds, width: number, height: number): ViewTransform {
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 140);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 140);
  const padding = Math.min(width, height) * 0.16;
  const usableWidth = Math.max(width - padding * 2, width * 0.52);
  const usableHeight = Math.max(height - padding * 2, height * 0.52);
  const fitScale = Math.min(usableWidth / boundsWidth, usableHeight / boundsHeight);
  const k = Math.max(0.36, Math.min(1.85, fitScale * 1.08));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: width / 2 - centerX * k,
    y: height / 2 - centerY * k,
    k,
  };
}

export function ForceGraph({ nodes, edges, selectedNodeId, onNodeClick, theme, resetViewVersion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const hoveredRef = useRef<SimNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const selectedIdRef = useRef(selectedNodeId);
  const initializedRef = useRef(false);
  const hasAutoFittedRef = useRef(false);
  const cameraAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { x, y, k } = transformRef.current;
    const simNodes = simNodesRef.current;
    const hovered = hoveredRef.current;
    const selectedId = selectedIdRef.current;
    const themeTint = theme === "dark" ? "#f8fafc" : "#10253d";
    const labelColor = theme === "dark" ? "rgba(224, 231, 241, 0.84)" : "rgba(23, 32, 51, 0.76)";
    const tooltipBackground = theme === "dark" ? "rgba(6, 12, 20, 0.95)" : "rgba(17, 28, 43, 0.94)";
    const tooltipBody = theme === "dark" ? "#e2e8f0" : "#f8fafc";
    const tooltipMuted = theme === "dark" ? "#a7b5c8" : "#cbd5e1";
    const tooltipHint = theme === "dark" ? "#778da9" : "#94a3b8";
    const edgeSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const resolvedColors = new Map<string, string>();

    const resolveNodeColor = (node: SimNode): string => {
      const cached = resolvedColors.get(node.id);
      if (cached) return cached;

      const finalColor = mixColor(getDepthColor(node.record.depth, theme), themeTint, Math.min(node.record.depth * 0.04, 0.12));
      resolvedColors.set(node.id, finalColor);
      return finalColor;
    };

    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target || source.x == null || source.y == null || target.x == null || target.y == null) return;

      const isNear = hovered && (hovered.id === source.id || hovered.id === target.id);
      const edgeColor = mixColor(resolveNodeColor(source), resolveNodeColor(target), 0.5);
      const baseAlpha = theme === "dark" ? 0.24 : 0.38;
      const activeAlpha = theme === "dark" ? 0.68 : 0.82;
      const highlightedAlpha = theme === "dark" ? 0.46 : 0.58;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      edgeSegments.push({ x1: source.x, y1: source.y, x2: target.x, y2: target.y });
      ctx.strokeStyle = withAlpha(
        edgeColor,
        isNear ? activeAlpha : edge.highlighted ? highlightedAlpha : baseAlpha,
      );
      ctx.lineWidth = ((isNear ? 1.5 : 0.9) + edge.strength * 0.65) / k;
      ctx.stroke();
    });

    simNodes.forEach((node) => {
      if (node.x == null || node.y == null) return;

      const color = resolveNodeColor(node);
      const isHovered = hovered?.id === node.id;
      const isSelected = node.id === selectedId;
      const r = node.r * (isHovered ? 1.55 : 1);

      ctx.globalAlpha = getNodeOpacity(node.record);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5 / k, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    });

    const visibleLabelNodes = simNodes
      .filter((node) => node.x != null && node.y != null)
      .filter((node) => k > 1.1 || hovered?.id === node.id || node.id === selectedId || node.record.depth === 0)
      .sort((first, second) => {
        const score = (node: SimNode) => {
          if (node.id === selectedId) return 5;
          if (hovered?.id === node.id) return 4;
          if (node.record.depth === 0) return 3;
          return Math.max(0, 2 - node.record.depth);
        };

        return score(second) - score(first);
      });
    const occupiedRects: LabelRect[] = [];

    for (const node of visibleLabelNodes) {
      if (node.x == null || node.y == null) continue;

      const label = node.record.label.split(" ").slice(0, 3).join(" ");
      const isHovered = hovered?.id === node.id;
      const isSelected = node.id === selectedId;
      const color = resolveNodeColor(node);
      const baseScreenFontSize = node.record.depth === 0 ? 15 : 12;
      const zoomBoost = Math.max(0.94, Math.min(1.55, Math.pow(k, 0.22)));
      const fontSize = (baseScreenFontSize * zoomBoost) / k;
      const fontWeight = node.record.depth === 0 || isSelected ? "600" : "500";
      ctx.font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
      const measuredWidth = ctx.measureText(label).width;
      const textWidth = Math.max(measuredWidth, label.length * fontSize * 0.42);
      const textHeight = fontSize * 1.2;
      const textPadding = Math.max(5 / k, 3.5);
      const offset = (node.r + 9 / k) * (node.record.depth === 0 ? 1.15 : 1);

      const candidates: LabelPlacement[] = [
        {
          nodeId: node.id,
          text: label,
          textX: node.x,
          textY: node.y + offset + textHeight * 0.5,
          x: node.x - textWidth / 2 - textPadding,
          y: node.y + offset,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding,
          fontSize,
          align: "center",
          color: isHovered || isSelected ? color : labelColor,
          weight: fontWeight,
        },
        {
          nodeId: node.id,
          text: label,
          textX: node.x,
          textY: node.y - offset - textHeight * 0.2,
          x: node.x - textWidth / 2 - textPadding,
          y: node.y - offset - textHeight - textPadding,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding,
          fontSize,
          align: "center",
          color: isHovered || isSelected ? color : labelColor,
          weight: fontWeight,
        },
        {
          nodeId: node.id,
          text: label,
          textX: node.x + offset + textPadding,
          textY: node.y + textHeight * 0.15,
          x: node.x + offset,
          y: node.y - textHeight / 2 - textPadding * 0.55,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding,
          fontSize,
          align: "left",
          color: isHovered || isSelected ? color : labelColor,
          weight: fontWeight,
        },
        {
          nodeId: node.id,
          text: label,
          textX: node.x - offset - textPadding,
          textY: node.y + textHeight * 0.15,
          x: node.x - offset - textWidth - textPadding * 2,
          y: node.y - textHeight / 2 - textPadding * 0.55,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding,
          fontSize,
          align: "right",
          color: isHovered || isSelected ? color : labelColor,
          weight: fontWeight,
        },
      ];

      let bestPlacement: LabelPlacement | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        let score = 0;

        for (const rect of occupiedRects) {
          if (rectsOverlap(candidate, rect)) {
            score += 1200;
          }
        }

        for (const otherNode of simNodes) {
          if (otherNode.id === node.id || otherNode.x == null || otherNode.y == null) continue;

          const margin = otherNode.r + 6 / k;
          if (
            otherNode.x >= candidate.x - margin &&
            otherNode.x <= candidate.x + candidate.width + margin &&
            otherNode.y >= candidate.y - margin &&
            otherNode.y <= candidate.y + candidate.height + margin
          ) {
            score += 220;
          }
        }

        for (const segment of edgeSegments) {
          if (lineIntersectsRect(segment.x1, segment.y1, segment.x2, segment.y2, candidate)) {
            score += 42;
          }
        }

        score += Math.abs(candidate.textY - node.y) * 0.08;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = candidate;
        }
      }

      if (!bestPlacement) continue;
      if (bestScore > 900 && !isHovered && !isSelected && node.record.depth > 0) continue;

      occupiedRects.push(bestPlacement);
      ctx.font = `${bestPlacement.weight} ${bestPlacement.fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = bestPlacement.color;
      ctx.textAlign = bestPlacement.align;
      ctx.textBaseline = "middle";
      ctx.fillText(bestPlacement.text, bestPlacement.textX, bestPlacement.textY);
    }

    ctx.textBaseline = "alphabetic";

    ctx.restore();

    if (hovered && hovered.x != null && hovered.y != null) {
      const sx = hovered.x * k + x;
      const sy = hovered.y * k + y;
      const color = resolvedColors.get(hovered.id) ?? getDepthColor(hovered.record.depth, theme);
      const hasSummary = Boolean(hovered.record.summary);
      const bw = 220;
      const paddingX = 12;
      const topPadding = 14;
      const blockGap = 7;
      const bottomPadding = 12;
      const centerX = Math.max(bw / 2 + 8, Math.min(sx + 14 + bw / 2, W - bw / 2 - 8));
      const maxTextWidth = bw - paddingX * 2;

      ctx.textAlign = "center";
      ctx.fillStyle = tooltipBackground;

      ctx.font = "600 10px system-ui, sans-serif";
      const typeLine = hovered.record.type.replace(/_/g, " ");

      ctx.font = "600 12px system-ui, sans-serif";
      const titleLines = wrapCanvasText(ctx, hovered.record.label, maxTextWidth, 2);
      const titleLineHeight = 15;

      ctx.font = "400 10px system-ui, sans-serif";
      const summaryLines = hasSummary
        ? wrapCanvasText(ctx, hovered.record.summary, maxTextWidth, 2)
        : [];
      const summaryLineHeight = 13;

      ctx.font = "400 9px system-ui, sans-serif";
      const hintLine = "click to explore →";

      const typeHeight = 10;
      const titleHeight = titleLines.length * titleLineHeight;
      const summaryHeight = summaryLines.length * summaryLineHeight;
      const hintHeight = 9;
      const bh =
        topPadding +
        typeHeight +
        blockGap +
        titleHeight +
        (summaryLines.length > 0 ? blockGap + summaryHeight : 0) +
        blockGap +
        hintHeight +
        bottomPadding;
      const bx = centerX - bw / 2;
      const by = Math.max(sy - bh - 12, 8);

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, bh, 10);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.fill();

      ctx.font = "600 10px system-ui, sans-serif";
      ctx.fillStyle = color;
      let textY = by + topPadding;
      ctx.fillText(typeLine, centerX, textY);

      ctx.font = "600 12px system-ui, sans-serif";
      ctx.fillStyle = tooltipBody;
      textY += typeHeight + blockGap;
      for (const line of titleLines) {
        ctx.fillText(line, centerX, textY);
        textY += titleLineHeight;
      }

      if (summaryLines.length > 0) {
        ctx.font = "400 10px system-ui, sans-serif";
        ctx.fillStyle = tooltipMuted;
        textY += blockGap;
        for (const line of summaryLines) {
          ctx.fillText(line, centerX, textY);
          textY += summaryLineHeight;
        }
      }

      ctx.font = "400 9px system-ui, sans-serif";
      ctx.fillStyle = tooltipHint;
      ctx.fillText(hintLine, centerX, by + bh - bottomPadding);
      ctx.textAlign = "left";
    }
  }, [edges, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function animateTransformTo(target: ViewTransform, duration = 320) {
      if (cameraAnimationRef.current) {
        cancelAnimationFrame(cameraAnimationRef.current);
      }

      const start = { ...transformRef.current };
      const startedAt = performance.now();
      const ease = (value: number) => 1 - Math.pow(1 - value, 3);

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = ease(progress);

        transformRef.current = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          k: start.k + (target.k - start.k) * eased,
        };
        draw();

        if (progress < 1) {
          cameraAnimationRef.current = requestAnimationFrame(step);
        } else {
          cameraAnimationRef.current = null;
        }
      };

      cameraAnimationRef.current = requestAnimationFrame(step);
    }

    function resetView(duration = 320) {
      const currentCanvas = canvasRef.current;
      const graphBounds = getGraphBounds(simNodesRef.current);

      if (!currentCanvas || !graphBounds || currentCanvas.width === 0 || currentCanvas.height === 0) {
        return;
      }

      const idealTransform = getFittedTransform(graphBounds, currentCanvas.width, currentCanvas.height);
      animateTransformTo(idealTransform, duration);
    }

    function initSim(W: number, H: number) {
      if (!canvas) return;

      const existingPositions = new Map(
        simNodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]),
      );

      const simNodes: SimNode[] = nodes.map((record) => {
        const existing = existingPositions.get(record.id);
        return {
          id: record.id,
          record,
          r: getNodeRadius(record),
          x: existing?.x ?? (Math.random() - 0.5) * 80,
          y: existing?.y ?? (Math.random() - 0.5) * 80,
        };
      });

      const simLinks: SimLink[] = edges.map((edge) => ({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      }));

      simNodesRef.current = simNodes;
      hasAutoFittedRef.current = false;

      if (!initializedRef.current) {
        transformRef.current = { x: W / 2, y: H / 2, k: 1 };
        initializedRef.current = true;
      }

      simRef.current?.stop();

      const sim = d3.forceSimulation<SimNode, SimLink>(simNodes)
        .force(
          "charge",
          d3.forceManyBody<SimNode>().strength((n) => -70 * (1 + (n.record.depth ?? 0) * 0.35)),
        )
        .force(
          "link",
          d3.forceLink<SimNode, SimLink>(simLinks)
            .id((n) => n.id)
            .distance((l) => {
              const s = l.source as SimNode;
              return 55 + (s.record?.depth ?? 0) * 18;
            })
            .strength(0.55),
        )
        .force("center", d3.forceCenter(0, 0).strength(0.035))
        .force(
          "collision",
          d3.forceCollide<SimNode>().radius((n) => n.r + 5),
        )
        .alphaDecay(0.018)
        .velocityDecay(0.38);

      simRef.current = sim;

      sim.on("tick", () => {
        if (!hasAutoFittedRef.current) {
          const graphBounds = getGraphBounds(simNodesRef.current);

          if (graphBounds && canvas.width > 0 && canvas.height > 0 && sim.alpha() < 0.24) {
            transformRef.current = getFittedTransform(graphBounds, canvas.width, canvas.height);
            hasAutoFittedRef.current = true;
          }
        }

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      });

      return sim;
    }

    let sim: d3.Simulation<SimNode, SimLink> | undefined;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        canvas.width = width;
        canvas.height = height;
        if (!sim) {
          sim = initSim(width, height) ?? undefined;
        } else {
          resetView(360);
          draw();
        }
      }
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
      const rect = parent.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        sim = initSim(rect.width, rect.height) ?? undefined;
      }
    }

    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let dragNode: SimNode | null = null;
    let didDrag = false;

    function getNode(mx: number, my: number) {
      const { x, y, k } = transformRef.current;
      const wx = (mx - x) / k;
      const wy = (my - y) / k;
      const simNodes = simNodesRef.current;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (n.x == null || n.y == null) continue;
        const dx = wx - n.x;
        const dy = wy - n.y;
        if (dx * dx + dy * dy < (n.r + 7) ** 2) return n;
      }
      return null;
    }

    function onPointerDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      didDrag = false;
      const node = getNode(mx, my);
      if (node) {
        dragNode = node;
        node.fx = node.x;
        node.fy = node.y;
        sim?.alphaTarget(0.25).restart();
        canvas!.setPointerCapture(e.pointerId);
      } else {
        isPanning = true;
        panStart = { x: mx - transformRef.current.x, y: my - transformRef.current.y };
        canvas!.setPointerCapture(e.pointerId);
      }
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragNode) {
        didDrag = true;
        const { x, y, k } = transformRef.current;
        dragNode.fx = (mx - x) / k;
        dragNode.fy = (my - y) / k;
        sim?.alpha(0.25).restart();
      } else if (isPanning) {
        didDrag = true;
        transformRef.current = {
          ...transformRef.current,
          x: mx - panStart.x,
          y: my - panStart.y,
        };
        draw();
      } else {
        const prev = hoveredRef.current;
        hoveredRef.current = getNode(mx, my);
        canvas!.style.cursor = hoveredRef.current ? "pointer" : "grab";
        if (prev !== hoveredRef.current) draw();
      }
    }

    function onPointerUp() {
      if (dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        sim?.alphaTarget(0);
        dragNode = null;
      }

      isPanning = false;
    }

    function onClick(e: MouseEvent) {
      if (didDrag) return;
      const rect = canvas!.getBoundingClientRect();
      const node = getNode(e.clientX - rect.left, e.clientY - rect.top);
      if (node) onNodeClick(node.id);
    }

    function onMouseLeave() {
      hoveredRef.current = null;
      canvas!.style.cursor = "grab";
      draw();
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x, y, k } = transformRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      const newK = Math.max(0.05, Math.min(6, k * factor));
      transformRef.current = {
        x: mx - ((mx - x) * newK) / k,
        y: my - ((my - y) * newK) / k,
        k: newK,
      };
      draw();
    }

    if (resetViewVersion > 0) {
      resetView(360);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.style.cursor = "grab";

    return () => {
      sim?.stop();
      resizeObserver.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraAnimationRef.current) cancelAnimationFrame(cameraAnimationRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, edges, draw, onNodeClick, resetViewVersion]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
