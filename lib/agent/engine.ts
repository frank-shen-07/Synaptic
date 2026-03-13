import { nanoid } from "nanoid";

import type {
  ClusterType,
  GraphEdgeRecord,
  GraphNodeRecord,
  GraphSession,
  OnePager,
  PriorArtHit,
  Tension,
} from "@/lib/graph/schema";
import { crosscheckIdea } from "@/lib/agent/search";
import { clamp, titleCase } from "@/lib/utils";

const clusterLabels: Record<Exclude<ClusterType, "seed">, string> = {
  inspiration: "Inspiration",
  target_audience: "Target Audience",
  technical_constraints: "Technical Constraints",
  business_constraints: "Business Constraints",
  risks_failure_modes: "Devil's Advocate",
  prior_art: "Crosscheck / Prior Art",
  adjacent_analogies: "Adjacent Analogies",
  open_questions: "Open Questions",
  tensions: "Tensions",
};

const clusterPrompts: Record<Exclude<ClusterType, "seed">, Array<(seed: string, domain?: string | null, focus?: string) => string>> = {
  inspiration: [
    (seed) => `What would make "${seed}" feel inevitable rather than incremental?`,
    (seed) => `Which emotional payoff would make people talk about "${seed}" unprompted?`,
    (seed, domain) => `${domain ?? "This"} idea becomes sharper if it borrows a premium ritual from another category.`,
  ],
  target_audience: [
    (seed) => `Early adopters who already hack together a manual version of "${seed}".`,
    (seed) => `Users who feel the pain weekly, not just during rare peak moments, for "${seed}".`,
    (seed) => `Teams willing to pay to save coordination cost around "${seed}".`,
  ],
  technical_constraints: [
    (seed) => `The system only works if "${seed}" can deliver consistent output quality at small scale first.`,
    (seed) => `Latency and trust become part of the product if "${seed}" is AI-mediated.`,
    (seed) => `Integration cost could dominate the value of "${seed}" if setup is not near-instant.`,
  ],
  business_constraints: [
    (seed) => `Distribution for "${seed}" must be repeatable without founder-led sales.`,
    (seed) => `The offer needs a wedge before "${seed}" can become a broader platform.`,
    (seed) => `"${seed}" has to prove ROI fast enough to justify buyer attention.`,
  ],
  risks_failure_modes: [
    (seed) => `Users may say "${seed}" is interesting, then continue with existing workflows.`,
    (seed) => `The strongest objection is that "${seed}" improves ideation without improving execution.`,
    (seed) => `A broad value proposition could make "${seed}" hard to remember or recommend.`,
  ],
  prior_art: [
    (seed) => `Look for companies or repos already framing themselves around "${seed}".`,
    (seed) => `Search adjacent categories that solve the same job-to-be-done as "${seed}".`,
    (seed) => `Prior art matters more at the workflow level than the exact phrasing of "${seed}".`,
  ],
  adjacent_analogies: [
    (seed) => `"${seed}" could borrow operating ideas from concierge medicine or air traffic control.`,
    (seed) => `High-trust industries may show patterns for how "${seed}" should stage decisions.`,
    (seed) => `Analogies help if they transfer a workflow, not just a visual metaphor, into "${seed}".`,
  ],
  open_questions: [
    (seed) => `What is the smallest credible version of "${seed}" that produces a visible win in one session?`,
    (seed) => `Which user action proves "${seed}" is creating a durable habit instead of a novelty spike?`,
    (seed) => `What would make "${seed}" obviously better than a document, spreadsheet, or chat thread?`,
  ],
  tensions: [
    (seed) => `"${seed}" often wants depth, speed, and trust simultaneously, which usually conflict.`,
    (seed) => `Every added node in "${seed}" improves exploration while risking overload.`,
    (seed) => `Crosschecking "${seed}" against live sources improves realism but can reduce originality optics.`,
  ],
};

function sanitizeSeed(seed: string) {
  return seed.replace(/\s+/g, " ").trim();
}

function summarizeSentence(sentence: string) {
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

function createNode(partial: Partial<GraphNodeRecord> & Pick<GraphNodeRecord, "label" | "type" | "summary">): GraphNodeRecord {
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

function collectClusterNodes(session: GraphSession, type: ClusterType) {
  return session.graph.nodes.filter((node) => node.type === type);
}

function buildClusterChildren(
  seed: string,
  type: Exclude<ClusterType, "seed">,
  parentId: string,
  existingLabels: Set<string>,
  detailLevel: number,
  focus?: string,
) {
  return clusterPrompts[type]
    .map((prompt) => prompt(seed, null, focus))
    .filter((label) => !existingLabels.has(label))
    .slice(0, detailLevel > 1 ? 2 : 3)
    .map((label) =>
      createNode({
        label: summarizeSentence(label),
        type,
        summary: label,
        parentId,
        depth: detailLevel + 1,
        detailLevel,
        confidence: clamp(0.6 + detailLevel * 0.05, 0.6, 0.92),
        weight: clamp(1.1 - detailLevel * 0.12, 0.5, 1.2),
      }),
    );
}

function deriveChallenges(seed: string, priorArt: PriorArtHit[]) {
  const directCompetitors = priorArt.slice(0, 2).map((hit) => hit.title);
  const challengeLines = [
    `Why now? If ${seed} feels like a polished brainstorm tool, buyers may not switch workflows.`,
    `Execution risk: the graph must create clarity faster than a whiteboard or doc.`,
    directCompetitors.length > 0
      ? `Prior-art pressure: ${directCompetitors.join(" and ")} already occupy part of this narrative.`
      : `Market pressure: adjacent incumbents may bundle the strongest parts of this idea.`,
  ];

  return challengeLines;
}

function detectTensions(nodes: GraphNodeRecord[]): Tension[] {
  const matches: Tension[] = [];
  const lowerNodes = nodes.map((node) => ({ ...node, search: `${node.label} ${node.summary}`.toLowerCase() }));

  const tensionPairs: Array<{
    terms: [string, string];
    summary: string;
    explanation: string;
    severity: Tension["severity"];
  }> = [
    {
      terms: ["premium", "low-cost"],
      summary: "Premium positioning conflicts with affordability.",
      explanation: "A trust-building premium experience can undermine the budget-friendly wedge needed for adoption.",
      severity: "high",
    },
    {
      terms: ["speed", "depth"],
      summary: "Speed and depth are pulling in opposite directions.",
      explanation: "More structured thinking improves rigor, but it may slow the first-session payoff.",
      severity: "medium",
    },
    {
      terms: ["automation", "trust"],
      summary: "Automation may outrun user trust.",
      explanation: "If the system acts too autonomously, users may question whether the output is grounded.",
      severity: "high",
    },
    {
      terms: ["expand", "overload"],
      summary: "More exploration increases cognitive load.",
      explanation: "Expandable graphs deepen insight while risking a cluttered interface and vague next steps.",
      severity: "medium",
    },
  ];

  for (const pair of tensionPairs) {
    const first = lowerNodes.find((node) => node.search.includes(pair.terms[0]));
    const second = lowerNodes.find((node) => node.search.includes(pair.terms[1]) && node.id !== first?.id);

    if (!first || !second) {
      continue;
    }

    matches.push({
      id: nanoid(),
      nodeIds: [first.id, second.id],
      severity: pair.severity,
      summary: pair.summary,
      explanation: pair.explanation,
    });
  }

  if (matches.length === 0) {
    const seedNode = nodes.find((node) => node.type === "seed");
    const riskNode = nodes.find((node) => node.type === "risks_failure_modes" && node.parentId);

    if (seedNode && riskNode) {
      matches.push({
        id: nanoid(),
        nodeIds: [seedNode.id, riskNode.id],
        severity: "medium",
        summary: "Ambition vs. focus",
        explanation:
          "The concept promises a broad reasoning system, but the MVP needs a narrower session boundary to stay believable.",
      });
    }
  }

  return matches.slice(0, 4);
}

function upsertDerivedChildren(
  session: GraphSession,
  clusterType: ClusterType,
  factory: (cluster: GraphNodeRecord) => GraphNodeRecord[],
) {
  const cluster = session.graph.nodes.find((node) => node.type === clusterType && node.depth === 1);

  if (!cluster) {
    return;
  }

  const derivedIds = new Set(
    session.graph.nodes
      .filter((node) => node.parentId === cluster.id && node.generated)
      .map((node) => node.id),
  );

  session.graph.nodes = session.graph.nodes.filter((node) => !derivedIds.has(node.id));
  session.graph.edges = session.graph.edges.filter((edge) => !derivedIds.has(edge.target));

  const children = factory(cluster);
  session.graph.nodes.push(...children);
  session.graph.edges.push(
    ...children.map((child) =>
      createEdge(cluster.id, child.id, "surfaces", `${cluster.label} surfaces ${child.label.toLowerCase()}.`, child.type === "tensions"),
    ),
  );
}

async function analyzeSession(session: GraphSession) {
  const { hits, originalityScore } = await crosscheckIdea(session.seed);
  const challenges = deriveChallenges(session.seed, hits);
  const tensions = detectTensions(session.graph.nodes);

  session.insights = {
    originalityScore,
    challenges,
    priorArt: hits,
    tensions,
  };

  upsertDerivedChildren(session, "prior_art", (cluster) =>
    hits.map((hit) =>
      createNode({
        label: hit.title,
        type: "prior_art",
        summary: hit.snippet,
        parentId: cluster.id,
        depth: 2,
        detailLevel: 2,
        expandable: false,
        confidence: clamp(hit.matchScore + 0.2, 0.45, 0.94),
        weight: 0.72,
        status: "source",
        sourceUrls: [hit.url],
        generated: true,
      }),
    ),
  );

  upsertDerivedChildren(session, "risks_failure_modes", (cluster) =>
    challenges.map((challenge, index) =>
      createNode({
        label: `Challenge ${index + 1}`,
        type: "risks_failure_modes",
        summary: challenge,
        parentId: cluster.id,
        depth: 2,
        detailLevel: 2,
        confidence: 0.75,
        weight: 0.82,
        status: "challenge",
        severity: index === 0 ? "high" : "medium",
        generated: true,
      }),
    ),
  );

  upsertDerivedChildren(session, "tensions", (cluster) =>
    tensions.map((tension) =>
      createNode({
        label: tension.summary,
        type: "tensions",
        summary: tension.explanation,
        parentId: cluster.id,
        depth: 2,
        detailLevel: 2,
        confidence: 0.8,
        weight: 0.78,
        status: "challenge",
        severity: tension.severity,
        generated: true,
      }),
    ),
  );

  const highlightedEdges = tensions
    .flatMap((tension) => tension.nodeIds)
    .reduce((accumulator, nodeId) => accumulator.add(nodeId), new Set<string>());

  session.graph.edges = session.graph.edges.map((edge) => ({
    ...edge,
    highlighted: highlightedEdges.has(edge.source) || highlightedEdges.has(edge.target),
  }));
}

export async function createSession(seedInput: string, domain?: string | null): Promise<GraphSession> {
  const seed = sanitizeSeed(seedInput);
  const now = new Date().toISOString();
  const seedNode = createNode({
    id: `seed_${nanoid(8)}`,
    label: seed,
    type: "seed",
    summary: `Seed concept: ${seed}`,
    detailLevel: 0,
    depth: 0,
    expandable: true,
    confidence: 0.88,
    weight: 1.6,
    status: "seed",
  });

  const clusterNodes = (Object.entries(clusterLabels) as Array<[Exclude<ClusterType, "seed">, string]>).map(
    ([type, label]) =>
      createNode({
        label,
        type,
        summary: `${label} cluster for ${seed}.`,
        parentId: seedNode.id,
        depth: 1,
        detailLevel: 1,
        confidence: 0.82,
        weight: 1.18,
      }),
  );

  const childNodes = clusterNodes.flatMap((clusterNode) =>
    buildClusterChildren(
      seed,
      clusterNode.type as Exclude<ClusterType, "seed">,
      clusterNode.id,
      new Set<string>(),
      1,
    ),
  );

  const graphNodes = [seedNode, ...clusterNodes, ...childNodes];
  const graphEdges = [
    ...clusterNodes.map((clusterNode) =>
      createEdge(seedNode.id, clusterNode.id, "opens", `${seed} opens a ${clusterNode.label.toLowerCase()} path.`),
    ),
    ...childNodes.map((childNode) =>
      createEdge(
        childNode.parentId ?? seedNode.id,
        childNode.id,
        "contains",
        `${titleCase(childNode.type)} contains ${childNode.label.toLowerCase()}.`,
      ),
    ),
  ];

  const session: GraphSession = {
    id: nanoid(10),
    seed,
    domain: domain?.trim() || null,
    createdAt: now,
    updatedAt: now,
    graph: {
      nodes: graphNodes,
      edges: graphEdges,
    },
    insights: {
      originalityScore: 0.75,
      challenges: [],
      priorArt: [],
      tensions: [],
    },
    onePager: null,
  };

  await analyzeSession(session);

  return session;
}

export async function expandNode(session: GraphSession, nodeId: string, mode: "deeper" | "wider") {
  const targetNode = session.graph.nodes.find((node) => node.id === nodeId);

  if (!targetNode || !targetNode.expandable) {
    return session;
  }

  const nextDetailLevel = mode === "deeper" ? targetNode.detailLevel + 1 : targetNode.detailLevel;
  const existingLabels = new Set(
    session.graph.nodes
      .filter((node) => node.parentId === targetNode.id)
      .map((node) => node.label),
  );

  const childType =
    targetNode.type === "seed" ? "inspiration" : (targetNode.type as Exclude<ClusterType, "seed">);

  const children = buildClusterChildren(
    session.seed,
    childType,
    targetNode.id,
    existingLabels,
    nextDetailLevel,
    targetNode.label,
  );

  if (children.length === 0) {
    return session;
  }

  session.graph.nodes.push(...children);
  session.graph.edges.push(
    ...children.map((child) =>
      createEdge(
        targetNode.id,
        child.id,
        mode === "deeper" ? "deepens" : "branches_to",
        `${targetNode.label} ${mode === "deeper" ? "deepens into" : "branches toward"} ${child.label.toLowerCase()}.`,
      ),
    ),
  );

  targetNode.detailLevel = nextDetailLevel;
  targetNode.confidence = clamp(targetNode.confidence + 0.03, 0.2, 0.97);
  session.updatedAt = new Date().toISOString();

  await analyzeSession(session);

  return session;
}

export function generateOnePager(session: GraphSession): OnePager {
  const audienceNode =
    collectClusterNodes(session, "target_audience").find((node) => node.parentId) ??
    session.graph.nodes.find((node) => node.type === "target_audience");
  const differentiators = collectClusterNodes(session, "inspiration")
    .filter((node) => node.parentId)
    .slice(0, 3)
    .map((node) => node.summary);
  const tensions = session.insights.tensions.map((tension) => tension.summary).slice(0, 3);
  const priorArt = session.insights.priorArt
    .slice(0, 3)
    .map((hit) => `${hit.title} (${hit.source})`);
  const mvpPath = [
    "Capture one seed idea and render a structured graph in a single response.",
    "Let the user expand a node deeper or wider while keeping edge labels visible.",
    "Run critique, crosscheck, and tension detection after every graph mutation.",
    "Export the current session as a one-page product brief.",
  ];

  const onePager: OnePager = {
    title: `Synaptic Brief: ${session.seed}`,
    hook: `An agentic thinking session that turns "${session.seed}" into a navigable graph, pressure-tests it, and leaves the user with a concrete one-pager.`,
    targetUser:
      audienceNode?.summary ??
      "Founders, product leads, and strategy teams exploring a new concept under time pressure.",
    opportunity:
      "Most ideation tools either generate text dumps or require manual whiteboarding. Synaptic compresses exploration, critique, and synthesis into one structured session.",
    differentiators,
    tensions,
    priorArt,
    mvpPath,
    exportText: [
      `# ${session.seed}`,
      "",
      `## Hook`,
      `An agentic thinking session that turns "${session.seed}" into a navigable graph, pressure-tests it, and leaves the user with a concrete one-pager.`,
      "",
      `## Target User`,
      audienceNode?.summary ??
        "Founders, product leads, and strategy teams exploring a new concept under time pressure.",
      "",
      `## Opportunity`,
      "Most ideation tools either generate text dumps or require manual whiteboarding. Synaptic compresses exploration, critique, and synthesis into one structured session.",
      "",
      `## Differentiators`,
      ...differentiators.map((item) => `- ${item}`),
      "",
      `## Major Tensions`,
      ...tensions.map((item) => `- ${item}`),
      "",
      `## Prior Art`,
      ...priorArt.map((item) => `- ${item}`),
      "",
      `## MVP Path`,
      ...mvpPath.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n"),
  };

  session.onePager = onePager;
  session.updatedAt = new Date().toISOString();

  return onePager;
}
