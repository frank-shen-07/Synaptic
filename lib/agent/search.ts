import { nanoid } from "nanoid";
import Exa from "exa-js";

import { env } from "@/lib/integrations/env";
import { generatePriorArtSearchPlan } from "@/lib/integrations/openai";
import type { PriorArtHit } from "@/lib/graph/schema";
import { clamp } from "@/lib/utils";

let exaClient: Exa | null = null;

const EXA_RESULT_COUNT = 8;
const PATENT_RESULT_COUNT = 8;
const GITHUB_RESULT_COUNT = 6;
const ELASTICSEARCH_RESULT_COUNT = 8;
const MAX_RERANK_CANDIDATES = 18;
const FINAL_HIT_COUNT = 5;
const MIN_PER_RETRIEVAL_PASS = 2;

type RetrievalPass =
  | "exa_primary"
  | "exa_category"
  | "exa_incumbent"
  | "patent"
  | "github"
  | "elasticsearch";

type SearchHit = PriorArtHit & {
  retrievalPass: RetrievalPass;
  queryUsed: string;
};

type ElasticsearchConfig =
  | {
      enabled: true;
      index: string;
      url: string;
      authorization: string;
    }
  | {
      enabled: false;
      reason: string;
    };

const retrievalPassOrder: RetrievalPass[] = [
  "exa_primary",
  "exa_incumbent",
  "exa_category",
  "patent",
  "github",
  "elasticsearch",
];

const retrievalPassLimits: Record<RetrievalPass, number> = {
  exa_primary: 6,
  exa_category: 4,
  exa_incumbent: 4,
  patent: 3,
  github: 3,
  elasticsearch: 3,
};

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

function truncateText(input: string, maxCharacters: number) {
  const normalized = collapseWhitespace(input);

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxCharacters - 3, 0)).trimEnd()}...`;
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

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return collapseWhitespace(value);
    }

    if (Array.isArray(value)) {
      const candidate = value.find((item): item is string => typeof item === "string" && item.trim().length > 0);

      if (candidate) {
        return collapseWhitespace(candidate);
      }
    }
  }

  return "";
}

function normalizeSearchScore(rawScore: number | null | undefined, fallback: number) {
  if (typeof rawScore !== "number" || Number.isNaN(rawScore)) {
    return clamp(fallback, 0, 1);
  }

  return clamp(1 - Math.exp(-rawScore / 5), 0, 1);
}

function getElasticsearchConfig(): ElasticsearchConfig {
  const url = env.elasticsearch.url();
  const index = env.elasticsearch.index();
  const apiKey = env.elasticsearch.apiKey();
  const username = env.elasticsearch.username();
  const password = env.elasticsearch.password();

  if (!url && !index && !apiKey && !username && !password) {
    return {
      enabled: false,
      reason: "not_configured",
    };
  }

  if (!url) {
    return {
      enabled: false,
      reason: "missing_url",
    };
  }

  if (!index) {
    return {
      enabled: false,
      reason: "missing_index",
    };
  }

  if (apiKey) {
    return {
      enabled: true,
      url,
      index,
      authorization: `ApiKey ${apiKey}`,
    };
  }

  if (username && password) {
    return {
      enabled: true,
      url,
      index,
      authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    };
  }

  return {
    enabled: false,
    reason: "missing_auth",
  };
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

async function searchExa(query: string, retrievalPass: RetrievalPass = "exa_primary"): Promise<SearchHit[]> {
  logCrosscheck("exa.request", { query, retrievalPass });
  const response = await getExaClient().searchAndContents(query, {
    type: "auto",
    numResults: EXA_RESULT_COUNT,
    highlights: {
      query,
      maxCharacters: 320,
    },
  });

  const mapped: SearchHit[] = response.results.map((result) => {
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
      retrievalPass,
      queryUsed: query,
    };
  });

  logCrosscheck("exa.response", {
    query,
    retrievalPass,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
}

async function searchPatents(query: string): Promise<SearchHit[]> {
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

  const mapped: SearchHit[] = results
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
        retrievalPass: "patent",
        queryUsed: query,
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

async function searchGithub(query: string): Promise<SearchHit[]> {
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

  const mapped: SearchHit[] = (payload.items ?? []).map((item) => ({
    id: nanoid(),
    title: item.full_name,
    url: item.html_url,
    snippet: item.description ?? "GitHub repository with related positioning.",
    source: "GitHub",
    matchScore: similarity(query, `${item.full_name} ${item.description ?? ""}`),
    retrievalPass: "github",
    queryUsed: query,
  }));

  logCrosscheck("github.response", {
    query,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
}

async function searchElasticsearch(query: string): Promise<SearchHit[]> {
  const config = getElasticsearchConfig();

  if (!config.enabled) {
    logCrosscheck("elasticsearch.skip", { query, reason: config.reason });
    return [];
  }

  const endpoint = `${config.url.replace(/\/+$/, "")}/${encodeURIComponent(config.index)}/_search`;
  logCrosscheck("elasticsearch.request", { query, index: config.index, url: endpoint });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: config.authorization,
    },
    body: JSON.stringify({
      size: ELASTICSEARCH_RESULT_COUNT,
      track_total_hits: false,
      _source: [
        "title",
        "name",
        "headline",
        "url",
        "link",
        "source_url",
        "permalink",
        "snippet",
        "description",
        "summary",
        "content",
        "body",
        "text",
      ],
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query,
                type: "best_fields",
                fields: [
                  "title^5",
                  "name^4",
                  "headline^4",
                  "snippet^3",
                  "description^3",
                  "summary^2",
                  "content",
                  "body",
                  "text",
                ],
                fuzziness: "AUTO",
              },
            },
            { match_phrase: { title: { query, boost: 8 } } },
            { match_phrase: { name: { query, boost: 6 } } },
            { match_phrase: { headline: { query, boost: 6 } } },
          ],
          minimum_should_match: 1,
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    logCrosscheck("elasticsearch.response_error", {
      query,
      status: response.status,
      statusText: response.statusText,
      index: config.index,
    });
    return [];
  }

  const payload = (await response.json()) as {
    hits?: {
      hits?: Array<{
        _id?: string;
        _score?: number;
        _source?: Record<string, unknown>;
      }>;
    };
  };

  const mapped: SearchHit[] = (payload.hits?.hits ?? []).flatMap((hit) => {
    const source = hit._source ?? {};
    const title =
      pickFirstString(source.title, source.name, source.headline) || "Related Elasticsearch result";
    const url = pickFirstString(source.url, source.link, source.source_url, source.permalink);

    if (!url) {
      return [];
    }

    const snippetText =
      pickFirstString(
        source.snippet,
        source.description,
        source.summary,
        source.content,
        source.body,
        source.text,
      ) || "Related result from Elasticsearch search.";
    const snippet = truncateText(snippetText, 320);
    const fallbackScore = similarity(query, `${title} ${snippet}`);

    return [
      {
        id: hit._id || nanoid(),
        title,
        url,
        snippet,
        source: "Elasticsearch",
        matchScore: normalizeSearchScore(hit._score, fallbackScore),
        retrievalPass: "elasticsearch",
        queryUsed: query,
      },
    ];
  });

  logCrosscheck("elasticsearch.response", {
    query,
    count: mapped.length,
    items: mapped.map((item) => ({ title: item.title, source: item.source, matchScore: item.matchScore, url: item.url })),
  });

  return mapped;
}

function deduplicateHits(hits: SearchHit[]) {
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

function getCandidateScore(hit: SearchHit) {
  if (hit.retrievalPass === "exa_incumbent") {
    return hit.matchScore + 0.08;
  }

  if (hit.retrievalPass === "exa_category") {
    return hit.matchScore + 0.04;
  }

  return hit.matchScore;
}

function selectRerankCandidates(hits: SearchHit[]) {
  const byPass = new Map<RetrievalPass, SearchHit[]>();

  for (const hit of hits) {
    const passHits = byPass.get(hit.retrievalPass) ?? [];
    passHits.push(hit);
    byPass.set(hit.retrievalPass, passHits);
  }

  for (const [pass, passHits] of byPass.entries()) {
    byPass.set(
      pass,
      [...passHits].sort((left, right) => getCandidateScore(right) - getCandidateScore(left)),
    );
  }

  const selected: SearchHit[] = [];
  const selectedUrls = new Set<string>();
  const passCounts = new Map<RetrievalPass, number>();

  for (const pass of retrievalPassOrder) {
    const passHits = byPass.get(pass) ?? [];

    for (const hit of passHits) {
      if (selected.length >= MAX_RERANK_CANDIDATES) {
        break;
      }

      const urlKey = normalizeUrlKey(hit.url);
      const currentCount = passCounts.get(pass) ?? 0;

      if (selectedUrls.has(urlKey) || currentCount >= MIN_PER_RETRIEVAL_PASS) {
        continue;
      }

      selected.push(hit);
      selectedUrls.add(urlKey);
      passCounts.set(pass, currentCount + 1);
    }
  }

  const remaining = [...hits].sort((left, right) => getCandidateScore(right) - getCandidateScore(left));

  for (const hit of remaining) {
    if (selected.length >= MAX_RERANK_CANDIDATES) {
      break;
    }

    const urlKey = normalizeUrlKey(hit.url);
    const currentCount = passCounts.get(hit.retrievalPass) ?? 0;

    if (selectedUrls.has(urlKey) || currentCount >= retrievalPassLimits[hit.retrievalPass]) {
      continue;
    }

    selected.push(hit);
    selectedUrls.add(urlKey);
    passCounts.set(hit.retrievalPass, currentCount + 1);
  }

  return selected;
}

async function rerankWithJina(query: string, hits: SearchHit[]): Promise<SearchHit[]> {
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

function replaceLastNonProtectedHit(
  topHits: SearchHit[],
  replacement: SearchHit,
  isProtected: (hit: SearchHit) => boolean,
) {
  if (topHits.some((hit) => normalizeUrlKey(hit.url) === normalizeUrlKey(replacement.url))) {
    return topHits;
  }

  const reversedIndex = [...topHits].reverse().findIndex((hit) => !isProtected(hit));

  if (reversedIndex === -1) {
    return topHits;
  }

  const next = [...topHits];
  next[topHits.length - 1 - reversedIndex] = replacement;
  return next;
}

function finalizeHitsWithCoverage(hits: SearchHit[], maxHits: number) {
  const topHits = hits.slice(0, maxHits);

  if (!topHits.some((hit) => hit.source === "Patent")) {
    const bestPatent = hits.find((hit) => hit.source === "Patent");

    if (bestPatent) {
      const withPatent = replaceLastNonProtectedHit(topHits, bestPatent, () => false);
      topHits.splice(0, topHits.length, ...withPatent);
    }
  }

  const hasBroadAnalog = topHits.some(
    (hit) => hit.retrievalPass === "exa_incumbent" || hit.retrievalPass === "exa_category",
  );

  if (!hasBroadAnalog) {
    const bestBroadAnalog = hits.find(
      (hit) => hit.retrievalPass === "exa_incumbent" || hit.retrievalPass === "exa_category",
    );

    if (bestBroadAnalog) {
      const withBroadAnalog = replaceLastNonProtectedHit(topHits, bestBroadAnalog, (hit) => hit.source === "Patent");
      topHits.splice(0, topHits.length, ...withBroadAnalog);
    }
  }

  return topHits;
}

export async function crosscheckIdea(query: string, _excludeSessionId?: string) {
  const searchPlan = await generatePriorArtSearchPlan(query);
  const categoryQuery =
    searchPlan.categoryQuery === searchPlan.directQuery ? null : searchPlan.categoryQuery;
  const incumbentQuery =
    searchPlan.incumbentQuery === searchPlan.directQuery || searchPlan.incumbentQuery === categoryQuery
      ? null
      : searchPlan.incumbentQuery;
  logCrosscheck("query.plan", {
    query,
    searchPlan,
    deduplicatedPlan: {
      directQuery: searchPlan.directQuery,
      categoryQuery,
      incumbentQuery,
    },
  });

  const [exaPrimaryHits, exaCategoryHits, exaIncumbentHits, patentHits, githubHits, elasticsearchHits] =
    await Promise.allSettled([
      searchExa(searchPlan.directQuery, "exa_primary"),
      categoryQuery ? searchExa(categoryQuery, "exa_category") : Promise.resolve([]),
      incumbentQuery ? searchExa(incumbentQuery, "exa_incumbent") : Promise.resolve([]),
      searchPatents(query),
      searchGithub(query),
      searchElasticsearch(query),
    ]);

  const deduplicatedHits = deduplicateHits([
    ...(exaPrimaryHits.status === "fulfilled" ? exaPrimaryHits.value : []),
    ...(exaCategoryHits.status === "fulfilled" ? exaCategoryHits.value : []),
    ...(exaIncumbentHits.status === "fulfilled" ? exaIncumbentHits.value : []),
    ...(patentHits.status === "fulfilled" ? patentHits.value : []),
    ...(githubHits.status === "fulfilled" ? githubHits.value : []),
    ...(elasticsearchHits.status === "fulfilled" ? elasticsearchHits.value : []),
  ]);

  logCrosscheck("providers.summary", {
    query,
    exaPrimary:
      exaPrimaryHits.status === "fulfilled" ? exaPrimaryHits.value.length : `error: ${String(exaPrimaryHits.reason)}`,
    exaCategory:
      exaCategoryHits.status === "fulfilled" ? exaCategoryHits.value.length : `error: ${String(exaCategoryHits.reason)}`,
    exaIncumbent:
      exaIncumbentHits.status === "fulfilled"
        ? exaIncumbentHits.value.length
        : `error: ${String(exaIncumbentHits.reason)}`,
    patent: patentHits.status === "fulfilled" ? patentHits.value.length : `error: ${String(patentHits.reason)}`,
    github: githubHits.status === "fulfilled" ? githubHits.value.length : `error: ${String(githubHits.reason)}`,
    elasticsearch:
      elasticsearchHits.status === "fulfilled" ? elasticsearchHits.value.length : `error: ${String(elasticsearchHits.reason)}`,
    deduplicated: deduplicatedHits.length,
  });

  const rerankCandidates = selectRerankCandidates(deduplicatedHits);
  logCrosscheck("rerank.candidates", {
    query,
    candidateCount: rerankCandidates.length,
    maxCandidates: MAX_RERANK_CANDIDATES,
    candidates: rerankCandidates.map((hit) => ({
      source: hit.source,
      retrievalPass: hit.retrievalPass,
      title: hit.title,
      matchScore: hit.matchScore,
      url: hit.url,
    })),
  });

  const rerankedHits = await rerankWithJina(query, rerankCandidates);
  const hits = finalizeHitsWithCoverage(rerankedHits, FINAL_HIT_COUNT);
  const topScore = hits[0]?.matchScore ?? 0;
  const originalityScore = clamp(1 - topScore * 0.78, 0.12, 0.95);

  logCrosscheck("crosscheck.final", {
    query,
    originalityScore,
    patentIncluded: hits.some((hit) => hit.source === "Patent"),
    broadAnalogIncluded: hits.some(
      (hit) => hit.retrievalPass === "exa_incumbent" || hit.retrievalPass === "exa_category",
    ),
    hits: hits.map((hit) => ({
      source: hit.source,
      retrievalPass: hit.retrievalPass,
      title: hit.title,
      matchScore: hit.matchScore,
      url: hit.url,
    })),
  });

  return {
    originalityScore,
    hits: hits.map(({ retrievalPass: _retrievalPass, queryUsed: _queryUsed, ...hit }) => hit),
  };
}
