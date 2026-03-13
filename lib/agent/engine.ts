import { nanoid } from "nanoid";

import { crosscheckIdea } from "@/lib/agent/search";
import type {
  GraphEdgeRecord,
  GraphNodeRecord,
  GraphSession,
  OnePager,
  Tension,
} from "@/lib/graph/schema";
import {
  analyzeSessionWithAI,
  generateIdeaBlueprints,
  generateOnePagerWithAI,
} from "@/lib/integrations/openai";
import { clamp } from "@/lib/utils";

const MAX_CHILD_IDEAS = 5;

function sanitizeSeed(seed: string) {
  return seed.replace(/\s+/g, " ").trim();
}

function createNode(
  partial: Partial<GraphNodeRecord> &
    Pick<GraphNodeRecord, "label" | "type" | "summary" | "details">,
): GraphNodeRecord {
  return {
    id: partial.id ?? nanoid(),
    label: partial.label,
    type: partial.type,
    summary: partial.summary,
    detailLevel: partial.detailLevel ?? 1,
    expandable: partial.expandable ?? true,
    confidence: partial.confidence ?? 0.72,
    depth: partial.depth ?? 0,
    weight: partial.weight ?? 1,
    status: partial.status ?? "normal",
    parentId: partial.parentId ?? null,
    sourceUrls: partial.sourceUrls ?? [],
    severity: partial.severity ?? null,
    generated: partial.generated ?? false,
    details: partial.details,
    crosscheckQuery: partial.crosscheckQuery ?? `${partial.label} ${partial.summary}`,
    priorArt: partial.priorArt ?? [],
    crosscheckedAt: partial.crosscheckedAt ?? null,
  };
}

function createEdge(
  source: string,
  target: string,
  label: string,
  explanation: string,
  highlighted = false,
): GraphEdgeRecord {
  return {
    id: nanoid(),
    source,
    target,
    label,
    explanation,
    strength: highlighted ? 0.88 : 0.66,
    highlighted,
  };
}

function summarizeNode(node: GraphNodeRecord) {
  return [
    node.label,
    node.summary,
    ...node.details.inspiration,
    ...node.details.targetAudience,
    ...node.details.technicalConstraints,
    ...node.details.businessConstraints,
    ...node.details.risksFailureModes,
    ...node.details.adjacentAnalogies,
    ...node.details.openQuestions,
    ...node.details.tensions,
  ]
    .filter(Boolean)
    .join(" ");
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mapTensionsToNodes(nodes: GraphNodeRecord[], aiTensions: Tension[]) {
  return aiTensions.map((tension) => {
    const words = tension.summary.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const matchingNodes = nodes
      .filter((node) => words.some((word) => summarizeNode(node).toLowerCase().includes(word)))
      .slice(0, 3)
      .map((node) => node.id);

    return {
      ...tension,
      nodeIds:
        matchingNodes.length >= 2
          ? matchingNodes
          : nodes.slice(0, Math.min(nodes.length, 2)).map((node) => node.id),
    };
  });
}

async function refreshSessionInsights(session: GraphSession) {
  const allPriorArt = session.graph.nodes.flatMap((node) => node.priorArt);
  const uniquePriorArt = [...new Map(allPriorArt.map((hit) => [hit.url, hit])).values()].slice(0, 10);
  const originalityScore = uniquePriorArt.length
    ? clamp(1 - average(uniquePriorArt.map((hit) => hit.matchScore)) * 0.85, 0.08, 0.95)
    : 0.72;

  const aiAnalysis = await analyzeSessionWithAI({
    ...session,
    insights: {
      ...session.insights,
      priorArt: uniquePriorArt,
    },
  });
  const tensions = mapTensionsToNodes(session.graph.nodes, aiAnalysis.tensions);
  const highlightedNodeIds = new Set(tensions.flatMap((tension) => tension.nodeIds));

  session.insights = {
    originalityScore,
    priorArt: uniquePriorArt,
    challenges: aiAnalysis.challenges,
    tensions,
  };

  session.graph.edges = session.graph.edges.map((edge) => ({
    ...edge,
    highlighted: highlightedNodeIds.has(edge.source) || highlightedNodeIds.has(edge.target),
  }));
}

function buildSeedNode(seed: string): GraphNodeRecord {
  return createNode({
    id: `seed_${nanoid(8)}`,
    label: seed,
    type: "seed",
    summary: `Seed idea: ${seed}`,
    detailLevel: 0,
    depth: 0,
    weight: 1.55,
    confidence: 0.9,
    expandable: false,
    status: "seed",
    details: {
      inspiration: ["Primary seed concept entered by the user."],
      targetAudience: ["Session owner exploring the idea."],
      technicalConstraints: ["The first graph should reveal strong directions quickly."],
      businessConstraints: ["The session needs to lead toward a concrete business direction."],
      risksFailureModes: ["The seed may be too broad until it is reframed."],
      adjacentAnalogies: ["Strategy note", "Opportunity map"],
      openQuestions: ["Which directions are worth exploring first?"],
      tensions: ["breadth vs specificity"],
    },
    crosscheckQuery: seed,
  });
}

async function buildChildIdeas({
  seed,
  parent,
  siblingLabels,
}: {
  seed: string;
  parent: GraphNodeRecord;
  siblingLabels?: string[];
}) {
  const generated = await generateIdeaBlueprints({
    seed,
    focus: parent.type === "seed" ? undefined : parent,
    siblingLabels,
  });

  return generated.ideas.slice(0, MAX_CHILD_IDEAS).map((idea, index) => {
    const child = createNode({
      label: idea.label,
      type: idea.type,
      summary: idea.summary,
      details: idea.details,
      parentId: parent.id,
      depth: parent.depth + 1,
      detailLevel: parent.detailLevel + 1,
      confidence: clamp(0.84 - index * 0.05 - parent.depth * 0.04, 0.45, 0.9),
      weight: clamp(1.12 - parent.depth * 0.14, 0.48, 1.2),
      expandable: parent.depth + 1 < 3,
      crosscheckQuery: `${idea.label}. ${idea.summary}`,
    });

    return {
      node: child,
      edge: createEdge(parent.id, child.id, idea.edgeLabel, idea.edgeExplanation),
    };
  });
}

export async function createSession(seedInput: string, domain?: string | null): Promise<GraphSession> {
  const seed = sanitizeSeed(seedInput);
  const now = new Date().toISOString();
  const seedNode = buildSeedNode(seed);
  const initialIdeas = await buildChildIdeas({ seed, parent: seedNode });

  const session: GraphSession = {
    id: nanoid(10),
    seed,
    domain: domain?.trim() || null,
    createdAt: now,
    updatedAt: now,
    graph: {
      nodes: [seedNode, ...initialIdeas.map((item) => item.node)],
      edges: initialIdeas.map((item) => item.edge),
    },
    insights: {
      originalityScore: 0.72,
      challenges: [],
      priorArt: [],
      tensions: [],
    },
    onePager: null,
  };

  await refreshSessionInsights(session);

  return session;
}

export async function expandNode(session: GraphSession, nodeId: string, _mode: "deeper" | "wider") {
  const targetNode = session.graph.nodes.find((node) => node.id === nodeId);

  if (!targetNode || !targetNode.expandable) {
    return session;
  }

  const existingChildren = session.graph.nodes.filter((node) => node.parentId === targetNode.id);

  if (existingChildren.length >= MAX_CHILD_IDEAS) {
    return session;
  }

  const nextIdeas = await buildChildIdeas({
    seed: session.seed,
    parent: targetNode,
    siblingLabels: existingChildren.map((node) => node.label),
  });

  const available = nextIdeas.slice(0, MAX_CHILD_IDEAS - existingChildren.length);
  session.graph.nodes.push(...available.map((item) => item.node));
  session.graph.edges.push(...available.map((item) => item.edge));

  targetNode.detailLevel += 1;
  targetNode.expandable =
    session.graph.nodes.filter((node) => node.parentId === targetNode.id).length < MAX_CHILD_IDEAS;
  targetNode.confidence = clamp(targetNode.confidence + 0.02, 0.2, 0.95);
  session.updatedAt = new Date().toISOString();

  await refreshSessionInsights(session);

  return session;
}

export async function crosscheckNode(session: GraphSession, nodeId: string) {
  const targetNode = session.graph.nodes.find((node) => node.id === nodeId);

  if (!targetNode) {
    return session;
  }

  const query = targetNode.crosscheckQuery ?? `${targetNode.label} ${targetNode.summary}`;
  const { hits } = await crosscheckIdea(query, session.id);

  targetNode.priorArt = hits.slice(0, 5);
  targetNode.sourceUrls = targetNode.priorArt
    .filter((hit) => hit.url !== "#")
    .map((hit) => hit.url);
  targetNode.crosscheckedAt = new Date().toISOString();
  targetNode.confidence = clamp(targetNode.confidence - 0.03, 0.25, 0.95);

  session.updatedAt = new Date().toISOString();
  await refreshSessionInsights(session);

  return session;
}

export async function generateOnePager(session: GraphSession): Promise<OnePager> {
  const onePager = await generateOnePagerWithAI(session);
  session.onePager = onePager;
  session.updatedAt = new Date().toISOString();

  return onePager;
}
