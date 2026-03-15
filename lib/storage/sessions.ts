import { graphSessionSchema, type GraphSession } from "@/lib/graph/schema";
import { getSupabaseAdmin } from "@/lib/integrations/supabase";

type SessionRow = {
  id: string;
  user_id: string | null;
  seed: string;
  domain: string | null;
  graph: unknown;
  insights: unknown;
  one_pager: unknown;
  created_at: string;
  updated_at: string;
};

function isValidUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function sanitizePriorArtHits(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((hit) => {
    if (!hit || typeof hit !== "object") {
      return [];
    }

    const record = hit as Record<string, unknown>;

    if (!isValidUrl(record.url)) {
      return [];
    }

    return [record];
  });
}

function toSession(row: SessionRow): GraphSession {
  const graph = row.graph && typeof row.graph === "object" ? structuredClone(row.graph) : row.graph;
  const insights = row.insights && typeof row.insights === "object" ? structuredClone(row.insights) : row.insights;

  if (graph && typeof graph === "object" && "nodes" in graph && Array.isArray((graph as { nodes?: unknown[] }).nodes)) {
    for (const node of (graph as { nodes: Array<Record<string, unknown>> }).nodes) {
      node.priorArt = sanitizePriorArtHits(node.priorArt);
    }
  }

  if (
    insights &&
    typeof insights === "object" &&
    "priorArt" in insights &&
    Array.isArray((insights as { priorArt?: unknown[] }).priorArt)
  ) {
    (insights as { priorArt: unknown[] }).priorArt = sanitizePriorArtHits(
      (insights as { priorArt?: unknown[] }).priorArt,
    );
  }

  return graphSessionSchema.parse({
    id: row.id,
    seed: row.seed,
    domain: row.domain,
    graph,
    insights,
    onePager: row.one_pager,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function saveSession(session: GraphSession, userId: string) {
  const supabase = getSupabaseAdmin();

  const { error: sessionError } = await supabase.from("sessions").upsert(
    {
      id: session.id,
      user_id: userId,
      seed: session.seed,
      domain: session.domain,
      graph: session.graph,
      insights: session.insights,
      one_pager: session.onePager,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    },
    {
      onConflict: "id",
    },
  );

  if (sessionError) {
    throw new Error(`Could not save session: ${sessionError.message}`);
  }

  const { error: ideasDeleteError } = await supabase.from("ideas").delete().eq("session_id", session.id);

  if (ideasDeleteError) {
    throw new Error(`Could not clear old ideas: ${ideasDeleteError.message}`);
  }

  const { error: edgesDeleteError } = await supabase.from("idea_edges").delete().eq("session_id", session.id);

  if (edgesDeleteError) {
    throw new Error(`Could not clear old edges: ${edgesDeleteError.message}`);
  }

  const ideaRows = session.graph.nodes.map((node) => ({
    id: node.id,
    session_id: session.id,
    user_id: userId,
    parent_id: node.parentId,
    label: node.label,
    node_type: node.type,
    depth: node.depth,
    detail_level: node.detailLevel,
    summary: node.summary,
    confidence: node.confidence,
    weight: node.weight,
    expandable: node.expandable,
    status: node.status,
    severity: node.severity,
    source_urls: node.sourceUrls,
    details: node.details,
    content_status: node.contentState,
    content_error: node.contentError,
    hydrated_at: node.hydratedAt,
    prior_art: node.priorArt,
    crosscheck_query: node.crosscheckQuery,
    crosschecked_at: node.crosscheckedAt,
    updated_at: session.updatedAt,
  }));

  if (ideaRows.length > 0) {
    const { error: ideasInsertError } = await supabase.from("ideas").insert(ideaRows);

    if (ideasInsertError) {
      throw new Error(`Could not save ideas: ${ideasInsertError.message}`);
    }
  }

  const edgeRows = session.graph.edges.map((edge) => ({
    id: edge.id,
    session_id: session.id,
    user_id: userId,
    source_id: edge.source,
    target_id: edge.target,
    label: edge.label,
    explanation: edge.explanation,
    strength: edge.strength,
    highlighted: edge.highlighted,
  }));

  if (edgeRows.length > 0) {
    const { error: edgesInsertError } = await supabase.from("idea_edges").insert(edgeRows);

    if (edgesInsertError) {
      throw new Error(`Could not save edges: ${edgesInsertError.message}`);
    }
  }
}

export async function loadSession(id: string, userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).eq("user_id", userId).single();

  if (error || !data) {
    throw new Error(`Could not load session ${id}: ${error?.message ?? "missing row"}`);
  }

  return toSession(data as SessionRow);
}

export async function sessionExists(id: string, userId: string) {
  let supabase;

  try {
    supabase = getSupabaseAdmin();
  } catch {
    return false;
  }

  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

export async function listSessions(userId: string): Promise<GraphSession[]> {
  let supabase;

  try {
    supabase = getSupabaseAdmin();
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list sessions: ${error.message}`);
  }

  return (data ?? []).map((row) => toSession(row as SessionRow));
}
