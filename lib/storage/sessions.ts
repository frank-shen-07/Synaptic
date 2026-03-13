import { graphSessionSchema, type GraphSession } from "@/lib/graph/schema";
import { indexSessionInElastic } from "@/lib/integrations/elasticsearch";
import { getSupabaseAdmin } from "@/lib/integrations/supabase";

type SessionRow = {
  id: string;
  seed: string;
  domain: string | null;
  graph: unknown;
  insights: unknown;
  one_pager: unknown;
  created_at: string;
  updated_at: string;
};

function toSession(row: SessionRow): GraphSession {
  return graphSessionSchema.parse({
    id: row.id,
    seed: row.seed,
    domain: row.domain,
    graph: row.graph,
    insights: row.insights,
    onePager: row.one_pager,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function saveSession(session: GraphSession) {
  const supabase = getSupabaseAdmin();

  const { error: sessionError } = await supabase.from("sessions").upsert(
    {
      id: session.id,
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

  await indexSessionInElastic(session);
}

export async function loadSession(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).single();

  if (error || !data) {
    throw new Error(`Could not load session ${id}: ${error?.message ?? "missing row"}`);
  }

  return toSession(data as SessionRow);
}

export async function sessionExists(id: string) {
  let supabase;

  try {
    supabase = getSupabaseAdmin();
  } catch {
    return false;
  }

  const { count, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("id", id);

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

export async function listSessions(): Promise<GraphSession[]> {
  let supabase;

  try {
    supabase = getSupabaseAdmin();
  } catch {
    return [];
  }

  const { data, error } = await supabase.from("sessions").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Could not list sessions: ${error.message}`);
  }

  return (data ?? []).map((row) => toSession(row as SessionRow));
}
