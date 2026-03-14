import { nanoid } from "nanoid";
import Exa from "exa-js";

import { env } from "@/lib/integrations/env";
import type { PriorArtHit } from "@/lib/graph/schema";
import { clamp } from "@/lib/utils";

let exaClient: Exa | null = null;

function getExaClient() {
  exaClient ??= new Exa(env.exa.apiKey());
  return exaClient;
}

function collapseWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function similarity(query: string, text: string) {
  const queryTerms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const textTerms = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

  const overlap = [...queryTerms].filter((term) => textTerms.has(term)).length;
  return clamp(overlap / Math.max(queryTerms.size, 1), 0, 1);
}

function buildSnippet(parts: Array<string | null | undefined>, fallback: string) {
  const snippet = collapseWhitespace(parts.filter(Boolean).join(" "));
  return snippet || fallback;
}

function normalizeUrlKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

async function searchExa(query: string): Promise<PriorArtHit[]> {
  const response = await getExaClient().searchAndContents(query, {
    type: "auto",
    numResults: 5,
    highlights: {
      query,
      maxCharacters: 320,
    },
  });

  return response.results.map((result) => {
    const title = collapseWhitespace(result.title ?? "") || new URL(result.url).hostname;
    const snippet = buildSnippet(result.highlights, "Related result from Exa search.");
    const score = clamp(result.highlightScores?.[0] ?? result.score ?? similarity(query, `${title} ${snippet}`), 0, 1);

    return {
      id: result.id || nanoid(),
      title,
      url: result.url,
      snippet,
      source: "Exa",
      matchScore: score,
    };
  });
}

async function searchPatents(query: string): Promise<PriorArtHit[]> {
  const response = await fetch("https://google.serper.dev/patents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": env.serper.apiKey(),
    },
    body: JSON.stringify({ q: query }),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    organic?: Array<{
      title?: string;
      link?: string;
      url?: string;
      snippet?: string;
      publicationNumber?: string;
      patentNumber?: string;
    }>;
    patents?: Array<{
      title?: string;
      link?: string;
      url?: string;
      snippet?: string;
      publicationNumber?: string;
      patentNumber?: string;
    }>;
  };

  const results = payload.organic ?? payload.patents ?? [];

  return results
    .filter(
      (
        item,
      ): item is {
        title?: string;
        link?: string;
        url?: string;
        snippet?: string;
        publicationNumber?: string;
        patentNumber?: string;
      } => Boolean(item?.link || item?.url),
    )
    .slice(0, 5)
    .map((item) => {
      const publicationNumber = item.publicationNumber ?? item.patentNumber;
      const title = collapseWhitespace(item.title ?? "") || "Related patent result";
      const snippet = buildSnippet(
        [item.snippet, publicationNumber ? `Publication ${publicationNumber}` : null],
        "Patent result with related positioning.",
      );

      return {
        id: publicationNumber ?? nanoid(),
        title,
        url: item.link ?? item.url ?? "#",
        snippet,
        source: "Patent",
        matchScore: similarity(query, `${title} ${snippet}`),
      };
    });
}

async function searchGithub(query: string): Promise<PriorArtHit[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=3`;
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    items?: Array<{
      html_url: string;
      full_name: string;
      description: string | null;
    }>;
  };

  return (payload.items ?? []).map((item) => ({
    id: nanoid(),
    title: item.full_name,
    url: item.html_url,
    snippet: item.description ?? "GitHub repository with related positioning.",
    source: "GitHub",
    matchScore: similarity(query, `${item.full_name} ${item.description ?? ""}`),
  }));
}

function deduplicateHits(hits: PriorArtHit[]) {
  const seen = new Set<string>();

  return hits.filter((hit) => {
    const urlKey = normalizeUrlKey(hit.url);

    if (seen.has(urlKey)) {
      return false;
    }

    seen.add(urlKey);
    return true;
  });
}

async function rerankWithJina(query: string, hits: PriorArtHit[]): Promise<PriorArtHit[]> {
  if (hits.length <= 1) {
    return hits;
  }

  try {
    const response = await fetch("https://api.jina.ai/v1/rerank", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.jina.apiKey()}`,
      },
      body: JSON.stringify({
        model: "jina-reranker-v3",
        query,
        top_n: hits.length,
        documents: hits.map((hit) => `${hit.title}\n${hit.snippet}`),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return [...hits].sort((left, right) => right.matchScore - left.matchScore);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        index: number;
        relevance_score: number;
      }>;
    };

    const reranked = hits.map((hit) => ({ ...hit }));

    for (const item of payload.results ?? []) {
      const target = reranked[item.index];

      if (!target) {
        continue;
      }

      target.matchScore = clamp(item.relevance_score, 0, 1);
    }

    return reranked.sort((left, right) => right.matchScore - left.matchScore);
  } catch {
    return [...hits].sort((left, right) => right.matchScore - left.matchScore);
  }
}

export async function crosscheckIdea(query: string, _excludeSessionId?: string) {
  const [exaHits, patentHits, githubHits] = await Promise.allSettled([
    searchExa(query),
    searchPatents(query),
    searchGithub(query),
  ]);

  const deduplicatedHits = deduplicateHits([
    ...(exaHits.status === "fulfilled" ? exaHits.value : []),
    ...(patentHits.status === "fulfilled" ? patentHits.value : []),
    ...(githubHits.status === "fulfilled" ? githubHits.value : []),
  ]);

  const hits = (await rerankWithJina(query, deduplicatedHits)).slice(0, 5);
  const topScore = hits[0]?.matchScore ?? 0;
  const originalityScore = clamp(1 - topScore * 0.78, 0.12, 0.95);

  return {
    originalityScore,
    hits,
  };
}
