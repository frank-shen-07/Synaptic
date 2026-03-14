import { Client } from "@elastic/elasticsearch";

import { env } from "@/lib/integrations/env";
import { embedText } from "@/lib/integrations/openai";
import type { GraphNodeRecord, GraphSession, PriorArtHit } from "@/lib/graph/schema";
import { clamp } from "@/lib/utils";

let client: Client | null = null;
let ensurePromise: Promise<void> | null = null;

function getClient() {
  client ??= new Client({
    node: env.elastic.url(),
    auth: {
      apiKey: env.elastic.apiKey(),
    },
  });

  return client;
}

async function ensureIndex(index: string, mappings: Record<string, unknown>) {
  const exists = await getClient().indices.exists({ index });

  if (exists) {
    return;
  }

  await getClient().indices.create({
    index,
    mappings,
  });
}

async function ensureIndices() {
  if (!ensurePromise) {
    ensurePromise = Promise.all([
      ensureIndex(env.elastic.sessionIndex(), {
        properties: {
          session_id: { type: "keyword" },
          seed: { type: "text" },
          summary: { type: "text" },
          embedding: {
            type: "dense_vector",
            dims: 1536,
            index: true,
            similarity: "cosine",
          },
          updated_at: { type: "date" },
        },
      }),
      ensureIndex(env.elastic.ideaIndex(), {
        properties: {
          idea_id: { type: "keyword" },
          session_id: { type: "keyword" },
          parent_id: { type: "keyword" },
          label: { type: "text" },
          summary: { type: "text" },
          details_text: { type: "text" },
          node_type: { type: "keyword" },
          depth: { type: "integer" },
          embedding: {
            type: "dense_vector",
            dims: 1536,
            index: true,
            similarity: "cosine",
          },
          updated_at: { type: "date" },
        },
      }),
    ]).then(() => undefined);
  }

  return ensurePromise;
}

function ideaText(node: GraphNodeRecord) {
  return [
    node.label,
    node.summary,
    node.details.inspiration.join(" "),
    node.details.targetAudience.join(" "),
    node.details.technicalConstraints.join(" "),
    node.details.businessConstraints.join(" "),
    node.details.risksFailureModes.join(" "),
    node.details.adjacentAnalogies.join(" "),
    node.details.openQuestions.join(" "),
    node.details.tensions.join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function indexSessionInElastic(session: GraphSession) {
  await ensureIndices();
  const sessionSummary = session.graph.nodes
    .filter((node) => node.type !== "seed")
    .slice(0, 5)
    .map((node) => `${node.label}: ${node.summary}`)
    .join(" ");
  const sessionEmbedding = await embedText(`${session.seed}\n${sessionSummary}`);

  await getClient().index({
    index: env.elastic.sessionIndex(),
    id: session.id,
    document: {
      session_id: session.id,
      seed: session.seed,
      summary: sessionSummary,
      embedding: sessionEmbedding,
      updated_at: session.updatedAt,
    },
    refresh: true,
  });

  const ideaNodes = session.graph.nodes.filter((node) => node.type !== "seed");

  for (const node of ideaNodes) {
    const embedding = await embedText(ideaText(node));

    await getClient().index({
      index: env.elastic.ideaIndex(),
      id: node.id,
      document: {
        idea_id: node.id,
        session_id: session.id,
        parent_id: node.parentId,
        label: node.label,
        summary: node.summary,
        details_text: ideaText(node),
        node_type: node.type,
        depth: node.depth,
        embedding,
        updated_at: session.updatedAt,
      },
      refresh: true,
    });
  }
}

export async function searchElasticSimilarIdeas(query: string, excludeSessionId?: string): Promise<PriorArtHit[]> {
  await ensureIndices();
  const embedding = await embedText(query);

  const response = await getClient().search<{
    idea_id: string;
    session_id: string;
    label: string;
    summary: string;
  }>({
    index: env.elastic.ideaIndex(),
    size: 5,
    knn: {
      field: "embedding",
      query_vector: embedding,
      k: 5,
      num_candidates: 20,
      filter: excludeSessionId
        ? {
            bool: {
              must_not: [{ term: { session_id: excludeSessionId } }],
            },
          }
        : undefined,
    },
  });

  return (response.hits.hits ?? []).map((hit, index) => {
    const source = hit._source;
    const score = clamp((hit._score ?? 0) / 2, 0, 1);
    const sessionId = source?.session_id ?? "unknown";
    const ideaId = source?.idea_id ?? `elastic_${index}`;

    return {
      id: ideaId,
      title: source?.label ?? "Similar indexed idea",
      url: `https://synaptic.local/session/${sessionId}?idea=${ideaId}`,
      snippet: source?.summary ?? "Indexed idea from Elasticsearch.",
      source: "Elasticsearch",
      matchScore: score,
    };
  });
}
