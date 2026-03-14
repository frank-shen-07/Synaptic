import { nanoid } from "nanoid";
import Exa from "exa-js";

import { env } from "@/lib/integrations/env";
import type { PriorArtHit } from "@/lib/graph/schema";
import { clamp } from "@/lib/utils";

let exaClient: Exa | null = null;

const EXA_RESULT_COUNT = 8;
const PATENT_RESULT_COUNT = 8;
const GITHUB_RESULT_COUNT = 6;
const MAX_RERANK_CANDIDATES = 18;
const FINAL_HIT_COUNT = 5;

function logCrosscheck(step: string, detail: Record<string, unknown>) {
  console.log(`[crosscheck] ${step}`, detail);
}

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
  logCrosscheck("exa.request", { query });
  const response = await getExaClient().searchAndContents(query, {
    type: "auto",
    numResults: EXA_RESULT_COUNT,
    highlights: {
      query,
      maxCharacters: 320,
    },
  });

  const mapped = response.results.map((result) => {
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

  logCrosscheck("exa.response", {
    query,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
}

async function searchPatents(query: string): Promise<PriorArtHit[]> {
  logCrosscheck("patent.request", { query });
  const response = await fetch("https://google.serper.dev/patents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": env.serper.apiKey(),
    },
    body: JSON.stringify({ q: query, num: PATENT_RESULT_COUNT }),
    cache: "no-store",
  });

  if (!response.ok) {
    logCrosscheck("patent.response_error", {
      query,
      status: response.status,
      statusText: response.statusText,
    });
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

  const mapped = results
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
    .slice(0, PATENT_RESULT_COUNT)
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

  logCrosscheck("patent.response", {
    query,
    rawCount: results.length,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
}

async function searchGithub(query: string): Promise<PriorArtHit[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${GITHUB_RESULT_COUNT}`;
  const githubToken = env.github.token();
  logCrosscheck("github.request", { query, url, authenticated: Boolean(githubToken) });
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    logCrosscheck("github.response_error", {
      query,
      status: response.status,
      statusText: response.statusText,
    });
    return [];
  }

  const payload = (await response.json()) as {
    items?: Array<{
      html_url: string;
      full_name: string;
      description: string | null;
    }>;
  };

  const mapped = (payload.items ?? []).map((item) => ({
    id: nanoid(),
    title: item.full_name,
    url: item.html_url,
    snippet: item.description ?? "GitHub repository with related positioning.",
    source: "GitHub",
    matchScore: similarity(query, `${item.full_name} ${item.description ?? ""}`),
  }));

  logCrosscheck("github.response", {
    query,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
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

function selectRerankCandidates(hits: PriorArtHit[]) {
  return [...hits]
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, MAX_RERANK_CANDIDATES);
}

async function rerankWithJina(query: string, hits: PriorArtHit[]): Promise<PriorArtHit[]> {
  if (hits.length <= 1) {
    logCrosscheck("jina.skip", { query, reason: "not_enough_hits", hitCount: hits.length });
    return hits;
  }

  try {
    logCrosscheck("jina.request", {
      query,
      hitCount: hits.length,
      documents: hits.map((hit, index) => ({ index, source: hit.source, title: hit.title, url: hit.url })),
    });

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
      logCrosscheck("jina.response_error", {
        query,
        status: response.status,
        statusText: response.statusText,
      });
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

    const sorted = reranked.sort((left, right) => right.matchScore - left.matchScore);
    logCrosscheck("jina.response", {
      query,
      count: sorted.length,
      results: sorted.map((hit) => ({ source: hit.source, title: hit.title, matchScore: hit.matchScore, url: hit.url })),
    });
    return sorted;
  } catch (error) {
    logCrosscheck("jina.exception", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return [...hits].sort((left, right) => right.matchScore - left.matchScore);
  }
}

function finalizeHitsWithPatentCoverage(hits: PriorArtHit[], maxHits: number) {
  const topHits = hits.slice(0, maxHits);

  if (topHits.some((hit) => hit.source === "Patent")) {
    return topHits;
  }

  const bestPatent = hits.find((hit) => hit.source === "Patent");

  if (!bestPatent) {
    return topHits;
  }

  if (topHits.length === 0) {
    return [bestPatent];
  }

  // Keep ranking mostly intact: replace only the last slot with the best patent when absent.
  const next = [...topHits];
  next[next.length - 1] = bestPatent;
  return next;
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

  logCrosscheck("providers.summary", {
    query,
    exa: exaHits.status === "fulfilled" ? exaHits.value.length : `error: ${String(exaHits.reason)}`,
    patent: patentHits.status === "fulfilled" ? patentHits.value.length : `error: ${String(patentHits.reason)}`,
    github: githubHits.status === "fulfilled" ? githubHits.value.length : `error: ${String(githubHits.reason)}`,
    deduplicated: deduplicatedHits.length,
  });

  const rerankCandidates = selectRerankCandidates(deduplicatedHits);
  logCrosscheck("rerank.candidates", {
    query,
    candidateCount: rerankCandidates.length,
    maxCandidates: MAX_RERANK_CANDIDATES,
    candidates: rerankCandidates.map((hit) => ({ source: hit.source, title: hit.title, matchScore: hit.matchScore, url: hit.url })),
  });

  const rerankedHits = await rerankWithJina(query, rerankCandidates);
  const hits = finalizeHitsWithPatentCoverage(rerankedHits, FINAL_HIT_COUNT);
  const topScore = hits[0]?.matchScore ?? 0;
  const originalityScore = clamp(1 - topScore * 0.78, 0.12, 0.95);

  logCrosscheck("crosscheck.final", {
    query,
    originalityScore,
    patentIncluded: hits.some((hit) => hit.source === "Patent"),
    hits: hits.map((hit) => ({ source: hit.source, title: hit.title, matchScore: hit.matchScore, url: hit.url })),
  });

  return {
    originalityScore,
    hits,
  };
}
