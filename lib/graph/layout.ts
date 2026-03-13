import type { Edge, Node } from "@xyflow/react";

import type { GraphEdgeRecord, GraphNodeRecord } from "@/lib/graph/schema";

export type ThoughtNodeData = {
  record: GraphNodeRecord;
};

type PositionedNode = Node<ThoughtNodeData, "thoughtNode">;
type PositionedEdge = Edge<GraphEdgeRecord>;

type Sector = {
  start: number;
  end: number;
};

function polarToCartesian(radius: number, angle: number) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function getRadiusForDepth(depth: number) {
  if (depth === 0) {
    return 0;
  }

  return 260 + (depth - 1) * 210;
}

function getNodeSize(node: GraphNodeRecord) {
  if (node.depth === 0) {
    return 190;
  }

  return Math.max(116, Math.round(136 - node.depth * 10 + node.weight * 14));
}

function midpoint(sector: Sector) {
  return (sector.start + sector.end) / 2;
}

function sectorForChildren(parentSector: Sector, total: number, index: number, depth: number): Sector {
  const span = parentSector.end - parentSector.start;
  const shrink = depth === 0 ? 1 : 0.62;
  const usableSpan = span * shrink;
  const center = midpoint(parentSector);
  const start = center - usableSpan / 2;
  const step = usableSpan / Math.max(total, 1);

  return {
    start: start + index * step,
    end: start + (index + 1) * step,
  };
}

export function buildFlowGraph(
  nodes: GraphNodeRecord[],
  edges: GraphEdgeRecord[],
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  const children = new Map<string, GraphNodeRecord[]>();

  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }

    const current = children.get(node.parentId) ?? [];
    current.push(node);
    children.set(node.parentId, current);
  }

  const seedNode = nodes.find((node) => node.type === "seed");

  if (!seedNode) {
    return { nodes: [], edges: [] };
  }

  const positioned = new Map<string, PositionedNode>();
  const rootSize = getNodeSize(seedNode);
  positioned.set(seedNode.id, {
    id: seedNode.id,
    type: "thoughtNode",
    data: { record: seedNode },
    position: { x: -rootSize / 2, y: -rootSize / 2 },
    style: {
      width: rootSize,
      height: rootSize,
    },
  });

  const queue: Array<{ node: GraphNodeRecord; sector: Sector }> = [
    {
      node: seedNode,
      sector: { start: -Math.PI, end: Math.PI },
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const currentChildren = (children.get(current.node.id) ?? []).sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    if (currentChildren.length === 0) {
      continue;
    }

    currentChildren.forEach((child, index) => {
      const childSector = sectorForChildren(current.sector, currentChildren.length, index, current.node.depth);
      const angle = midpoint(childSector);
      const radius = getRadiusForDepth(child.depth);
      const point = polarToCartesian(radius, angle);
      const size = getNodeSize(child);

      positioned.set(child.id, {
        id: child.id,
        type: "thoughtNode",
        data: { record: child },
        position: {
          x: point.x - size / 2,
          y: point.y - size / 2,
        },
        style: {
          width: size,
          height: size,
        },
      });

      queue.push({
        node: child,
        sector: childSector,
      });
    });
  }

  const flowNodes = nodes
    .map((node) => positioned.get(node.id))
    .filter((node): node is PositionedNode => Boolean(node));

  const flowEdges: PositionedEdge[] = edges.map((edge) => ({
    ...edge,
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: edge.highlighted,
    label: edge.label,
    data: edge,
    labelStyle: {
      fill: "#0f172a",
      fontSize: 11,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: "#fffdf9",
      fillOpacity: 0.96,
      stroke: edge.highlighted ? "#be123c" : "#d4cdc3",
      strokeWidth: 1,
    },
    labelBgPadding: [6, 3],
    style: {
      stroke: edge.highlighted ? "#be123c" : "#7b8794",
      strokeWidth: edge.highlighted ? 2.1 : 1.3,
    },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
