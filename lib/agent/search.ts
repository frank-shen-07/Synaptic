import { nanoid } from "nanoid";

import { clamp } from "@/lib/utils";
import type { PriorArtHit } from "@/lib/graph/schema";

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

async function searchDuckDuckGo(query: string): Promise<PriorArtHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Synaptic/1.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const matches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g)];

  return matches.slice(0, 5).map((match) => {
    const [, urlMatch, titleMatch, snippetMatch] = match;
    const title = stripHtml(titleMatch);
    const snippet = stripHtml(snippetMatch);
    const score = similarity(query, `${title} ${snippet}`);
    const resolvedUrl = urlMatch.startsWith("//duckduckgo.com/l/?")
      ? new URL(`https:${urlMatch}`).searchParams.get("uddg") ?? `https:${urlMatch}`
      : urlMatch;

    return {
      id: nanoid(),
      title,
      url: decodeURIComponent(resolvedUrl),
      snippet,
      source: "DuckDuckGo",
      matchScore: score,
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

export async function crosscheckIdea(query: string) {
  const [webHits, githubHits] = await Promise.allSettled([
    searchDuckDuckGo(query),
    searchGithub(query),
  ]);

  const combined = [
    ...(webHits.status === "fulfilled" ? webHits.value : []),
    ...(githubHits.status === "fulfilled" ? githubHits.value : []),
  ]
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 6);

  const topScore = combined[0]?.matchScore ?? 0;
  const originalityScore = clamp(1 - topScore * 0.78, 0.12, 0.95);

  return {
    originalityScore,
    hits: combined,
  };
}
