import type { Edge, Node } from "@xyflow/react";

import type { GraphEdgeRecord, GraphNodeRecord } from "@/lib/graph/schema";

export type ThoughtNodeData = {
  record: GraphNodeRecord;
};

type PositionedNode = Node<ThoughtNodeData, "thoughtNode">;
type PositionedEdge = Edge<GraphEdgeRecord>;

const topLevelRadii: Record<number, number> = {
  0: 0,
  1: 320,
  2: 180,
  3: 120,
};

function polarToCartesian(radius: number, angle: number) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function buildFlowGraph(
  nodes: GraphNodeRecord[],
  edges: GraphEdgeRecord[],
): { nodes: PositionedNode[]; edges: PositionedEdge[] } {
  const children = new Map<string, GraphNodeRecord[]>();
  const inbound = new Map<string, GraphEdgeRecord[]>();

  for (const edge of edges) {
    const targetEdges = inbound.get(edge.target) ?? [];
    targetEdges.push(edge);
    inbound.set(edge.target, targetEdges);
  }

  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }

    const siblingList = children.get(node.parentId) ?? [];
    siblingList.push(node);
    children.set(node.parentId, siblingList);
  }

  const positioned = new Map<string, PositionedNode>();
  const seedNode = nodes.find((node) => node.type === "seed");

  if (!seedNode) {
    return { nodes: [], edges: [] };
  }

  positioned.set(seedNode.id, {
    id: seedNode.id,
    type: "thoughtNode",
    data: {
      record: seedNode,
    },
    position: { x: 0, y: 0 },
  });

  const queue: Array<{ node: GraphNodeRecord; parentPosition: { x: number; y: number } }> = [
    { node: seedNode, parentPosition: { x: 0, y: 0 } },
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

    const radius = topLevelRadii[current.node.depth + 1] ?? 90;
    const spread = current.node.depth === 0 ? Math.PI * 2 : Math.PI * 1.4;
    const offset = current.node.depth === 0 ? -Math.PI / 2 : -spread / 2;

    currentChildren.forEach((child, index) => {
      const normalized = currentChildren.length === 1 ? 0.5 : index / (currentChildren.length - 1);
      const angle = offset + normalized * spread + child.depth * 0.18;
      const spiral = polarToCartesian(radius + index * 16, angle);
      const position = {
        x: current.parentPosition.x + spiral.x,
        y: current.parentPosition.y + spiral.y,
      };

      positioned.set(child.id, {
        id: child.id,
        type: "thoughtNode",
        data: {
          record: child,
        },
        position,
      });

      queue.push({ node: child, parentPosition: position });
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
      fill: "#fff9f0",
      fillOpacity: 0.95,
      stroke: edge.highlighted ? "#be123c" : "#d6cabb",
      strokeWidth: 1,
    },
    labelBgPadding: [6, 3],
    style: {
      stroke: edge.highlighted ? "#be123c" : "#6b7280",
      strokeWidth: edge.highlighted ? 2.2 : 1.2,
    },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
