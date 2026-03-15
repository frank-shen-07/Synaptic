import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { env } from "@/lib/integrations/env";
import type { GraphNodeRecord, GraphSession, NodeDetails, OnePager, Tension } from "@/lib/graph/schema";

let client: OpenAI | null = null;

function getClient() {
  client ??= new OpenAI({
    apiKey: env.openai.apiKey(),
  });

  return client;
}

const nodeDetailsSchema = z.object({
  inspiration: z.array(z.string()).min(1).max(4),
  targetAudience: z.array(z.string()).min(1).max(3),
  technicalConstraints: z.array(z.string()).min(1).max(3),
  businessConstraints: z.array(z.string()).min(1).max(3),
  risksFailureModes: z.array(z.string()).min(1).max(3),
  adjacentAnalogies: z.array(z.string()).min(1).max(3),
  openQuestions: z.array(z.string()).min(1).max(3),
  tensions: z.array(z.string()).min(1).max(3),
});

const ideaTypeSchema = z.enum([
  "inspiration",
  "target_audience",
  "technical_constraints",
  "business_constraints",
  "prior_art",
  "open_questions",
]);

const ideaTeaserSchema = z.object({
  label: z.string().min(6).max(64),
  summary: z.string().min(20).max(240),
  edgeLabel: z.string().min(3).max(24),
  edgeExplanation: z.string().min(12).max(180),
  type: ideaTypeSchema,
});

const ideaTeaserResponseSchema = z.object({
  ideas: z.array(ideaTeaserSchema).min(3).max(5),
});

const ideaTeaserWireSchema = z.object({
  label: z.string().min(6).max(96),
  summary: z.string().min(20),
  edgeLabel: z.string().min(3).max(40),
  edgeExplanation: z.string().min(12),
  type: ideaTypeSchema,
});

const ideaTeaserWireResponseSchema = z.object({
  ideas: z.array(ideaTeaserWireSchema).min(3).max(5),
});

const ideaNodeHydrationSchema = z.object({
  details: nodeDetailsSchema,
  crosscheckQuery: z.string().min(12).max(280),
});

const ideaNodeHydrationWireSchema = z.object({
  details: nodeDetailsSchema,
  crosscheckQuery: z.string().min(12),
});

const priorArtSearchPlanSchema = z.object({
  directQuery: z.string().min(12).max(180),
  categoryQuery: z.string().min(12).max(180),
  incumbentQuery: z.string().min(12).max(180),
});

const priorArtSearchPlanWireSchema = z.object({
  directQuery: z.string().min(6),
  categoryQuery: z.string().min(6),
  incumbentQuery: z.string().min(6),
});

const analysisSchema = z.object({
  challenges: z.array(z.string()).min(2).max(4),
  tensions: z
    .array(
      z.object({
        summary: z.string().min(6).max(120),
        explanation: z.string().min(20).max(220),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .min(1)
    .max(5),
});

const onePagerSchema = z.object({
  title: z.string().min(6).max(120),
  hook: z.string().min(20).max(220),
  targetUser: z.string().min(10).max(220),
  opportunity: z.string().min(20).max(280),
  differentiators: z.array(z.string()).min(3).max(4),
  tensions: z.array(z.string()).min(2).max(4),
  priorArt: z.array(z.string()).max(4),
  mvpPath: z.array(z.string()).min(4).max(6),
});

const danglingEndingPattern =
  /(?:\b(?:and|or|with|for|to|of|in|on|at|by|from|via|through|around|after|before|without|including|especially)\b|[,:;])$/i;

const weakLabelWords = new Set([
  "assistant",
  "bridge",
  "cloud",
  "console",
  "copilot",
  "engine",
  "exchange",
  "fabric",
  "hub",
  "layer",
  "mesh",
  "network",
  "orchestrator",
  "os",
  "platform",
  "portal",
  "protocol",
  "radar",
  "scout",
  "stack",
  "studio",
  "system",
  "workspace",
]);

const jargonPhrases = [
  "agentic",
  "autonomous agents",
  "backplane",
  "composable",
  "cross-modal",
  "cutting-edge",
  "ecosystem",
  "embeddings",
  "end-to-end",
  "full-stack",
  "interoperability",
  "knowledge graph",
  "latent",
  "leverage",
  "llm",
  "middleware",
  "multi-agent",
  "ontology",
  "orchestration",
  "paradigm",
  "pipeline",
  "rag",
  "schema",
  "semantic",
  "seamless",
  "solutioning",
  "synergy",
  "taxonomy",
  "tokenized",
  "vectorized",
  "workflow orchestration",
];

const genericSummaryPhrases = [
  "next-generation",
  "single pane of glass",
  "thought partner",
  "unlock value",
  "streamline operations",
  "transform workflows",
];

const allowedAcronyms = new Set([
  "AI",
  "API",
  "B2B",
  "B2C",
  "CRM",
  "EHR",
  "EMR",
  "ERP",
  "GPS",
  "HR",
  "IoT",
  "KPI",
  "OCR",
  "POS",
  "ROI",
  "SaaS",
  "SDK",
  "SMB",
  "SQL",
  "UI",
  "UX",
]);

const searchQueryStopwords = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "handled",
  "in",
  "into",
  "need",
  "of",
  "on",
  "one",
  "or",
  "residents",
  "that",
  "the",
  "their",
  "this",
  "through",
  "to",
  "using",
  "who",
  "with",
]);

type IdeaTeaser = z.infer<typeof ideaTeaserResponseSchema>["ideas"][number];

type IdeaTeaserReview = {
  accepted: boolean;
  feedback: string[];
  reviewedIdeas: Array<{
    idea: IdeaTeaser;
    issues: string[];
    score: number;
  }>;
  score: number;
};

function stringifyDetails(details: NodeDetails) {
  return [
    `Inspiration: ${details.inspiration.join("; ")}`,
    `Target audience: ${details.targetAudience.join("; ")}`,
    `Technical constraints: ${details.technicalConstraints.join("; ")}`,
    `Business constraints: ${details.businessConstraints.join("; ")}`,
    `Risks: ${details.risksFailureModes.join("; ")}`,
    `Adjacent analogies: ${details.adjacentAnalogies.join("; ")}`,
    `Open questions: ${details.openQuestions.join("; ")}`,
    `Tensions: ${details.tensions.join("; ")}`,
  ].join("\n");
}

function extractJsonCandidate(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function sanitizeJsonCandidate(candidate: string) {
  return candidate
    .replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u")
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function cleanSentence(value: string) {
  let cleaned = value.replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

  if (!cleaned) {
    return cleaned;
  }

  if (!/[.!?]$/.test(cleaned)) {
    while (danglingEndingPattern.test(cleaned)) {
      const lastComma = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf(";"), cleaned.lastIndexOf(":"));

      if (lastComma === -1) {
        cleaned = cleaned.replace(danglingEndingPattern, "").trim();
        break;
      }

      cleaned = cleaned.slice(0, lastComma).trim();
    }

    cleaned = cleaned.replace(/[,:;-\s]+$/, "").trim();
    cleaned = `${cleaned}.`;
  }

  return cleaned;
}

function cleanPhrase(value: string) {
  return value.replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
}

function tokenizeWords(value: string) {
  return cleanPhrase(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function countPhraseHits(value: string, phrases: string[]) {
  const normalized = cleanPhrase(value).toLowerCase();

  return phrases.reduce((count, phrase) => count + (normalized.includes(phrase) ? 1 : 0), 0);
}

function countUncommonAcronyms(value: string) {
  const acronyms = cleanPhrase(value).match(/\b[A-Z]{2,}\b/g) ?? [];
  return acronyms.filter((token) => !allowedAcronyms.has(token)).length;
}

function normalizeSearchQuery(value: string, maxWords = 14) {
  const tokens = cleanPhrase(value)
    .replace(/[.,:;!?()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const preferredWords = new Set(["alternatives", "apps", "companies", "competitors", "leaders", "market", "services"]);
  const condensed = tokens.filter((token, index) => {
    const normalized = token.toLowerCase();

    if (preferredWords.has(normalized)) {
      return true;
    }

    if (index === 0) {
      return true;
    }

    return !searchQueryStopwords.has(normalized);
  });

  const shortened = condensed.slice(0, maxWords).join(" ");
  return fitWithinLimit(shortened || cleanPhrase(value), 180);
}

function fitWithinLimit(value: string, maxLength: number, sentence = false) {
  const normalized = sentence ? cleanSentence(value) : cleanPhrase(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const candidate = normalized.slice(0, maxLength + 1);
  const breakpoints = [candidate.lastIndexOf(". "), candidate.lastIndexOf("; "), candidate.lastIndexOf(", "), candidate.lastIndexOf(" ")];
  const cutoff = breakpoints.find((index) => index >= Math.floor(maxLength * 0.6));
  const shortened = (cutoff ?? maxLength) > 0 ? candidate.slice(0, cutoff ?? maxLength).trim() : candidate.slice(0, maxLength).trim();
  const stripped = shortened.replace(/[,:;-\s]+$/, "").trim();

  if (!sentence) {
    return stripped.slice(0, maxLength);
  }

  if (!stripped) {
    return normalized.slice(0, maxLength).trim();
  }

  const withPunctuation = /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
  return withPunctuation.length <= maxLength ? withPunctuation : `${withPunctuation.slice(0, maxLength - 1).trimEnd()}.`;
}

function normalizeIdeaTeaserPayload(payload: z.infer<typeof ideaTeaserWireResponseSchema>) {
  return {
    ideas: payload.ideas.map((idea) => ({
      ...idea,
      label: fitWithinLimit(idea.label, 64),
      summary: fitWithinLimit(idea.summary, 240, true),
      edgeLabel: fitWithinLimit(idea.edgeLabel, 24),
      edgeExplanation: fitWithinLimit(idea.edgeExplanation, 180, true),
    })),
  };
}

function reviewIdeaTeaser(idea: IdeaTeaser) {
  const labelWords = tokenizeWords(idea.label);
  const summaryWords = tokenizeWords(idea.summary);
  const labelWeakWordCount = labelWords.filter((word) => weakLabelWords.has(word)).length;
  const jargonHits = countPhraseHits(`${idea.label} ${idea.summary}`, jargonPhrases);
  const genericHits = countPhraseHits(idea.summary, genericSummaryPhrases);
  const uncommonAcronyms = countUncommonAcronyms(`${idea.label} ${idea.summary}`);
  const hasPlainLanguageStructure =
    /\b(for|helps?|lets|allows?|gives|used by|so that|instead of|reduces?|cuts?|speeds?\s+up)\b/i.test(idea.summary);
  const mentionsConcreteOutcome =
    /\b(avoid|book|buy|catch|coach|compare|cut|deliver|detect|draft|find|guide|hire|improve|match|monitor|pay|plan|predict|prevent|price|prioritize|rank|reduce|save|schedule|screen|sell|send|ship|spot|suggest|track|train|verify|warn)\b/i.test(
      idea.summary,
    );

  const issues: string[] = [];

  if (labelWords.length <= 4 && labelWeakWordCount >= Math.max(2, labelWords.length - 1)) {
    issues.push("label feels abstract instead of naming a concrete product or service");
  }

  if (jargonHits >= 3 || uncommonAcronyms >= 2) {
    issues.push("too much jargon or too many unexplained acronyms");
  }

  if (!hasPlainLanguageStructure) {
    issues.push("summary does not clearly say who it helps or what it does");
  }

  if (!mentionsConcreteOutcome) {
    issues.push("summary does not clearly state a practical user outcome");
  }

  if (summaryWords.length < 9) {
    issues.push("summary is too compressed to explain the idea clearly");
  }

  if (genericHits >= 1) {
    issues.push("summary relies on generic startup language");
  }

  const score = 10 - issues.length * 2 - jargonHits - uncommonAcronyms;

  return {
    idea,
    issues,
    score,
  };
}

function reviewIdeaTeaserSet(payload: z.infer<typeof ideaTeaserResponseSchema>): IdeaTeaserReview {
  const reviewedIdeas = payload.ideas.map(reviewIdeaTeaser);
  const highQualityCount = reviewedIdeas.filter((item) => item.issues.length === 0).length;
  const usableCount = reviewedIdeas.filter((item) => item.issues.length <= 1).length;
  const totalIssues = reviewedIdeas.reduce((sum, item) => sum + item.issues.length, 0);
  const score = reviewedIdeas.reduce((sum, item) => sum + item.score, 0) + highQualityCount * 3 + usableCount;

  const feedback = reviewedIdeas.flatMap((item, index) =>
    item.issues.map((issue) => `Idea ${index + 1} (${item.idea.label}): ${issue}.`),
  );

  return {
    accepted: usableCount >= 3 && highQualityCount >= 2 && totalIssues <= payload.ideas.length + 1,
    feedback,
    reviewedIdeas,
    score,
  };
}

function selectBestIdeaTeaserPayload(payload: z.infer<typeof ideaTeaserResponseSchema>) {
  const reviewed = payload.ideas.map((idea, index) => ({
    idea,
    index,
    issues: reviewIdeaTeaser(idea).issues.length,
  }));
  const usableCount = reviewed.filter((item) => item.issues <= 1).length;
  const desiredCount = Math.min(payload.ideas.length, Math.max(3, usableCount));

  const selectedIndexes = reviewed
    .sort((left, right) => left.issues - right.issues || left.idea.label.length - right.idea.label.length)
    .slice(0, desiredCount)
    .map((item) => item.index)
    .sort((left, right) => left - right);

  return {
    ideas: selectedIndexes.map((index) => payload.ideas[index]),
  };
}

function normalizeNodeHydrationPayload(payload: z.infer<typeof ideaNodeHydrationWireSchema>) {
  return {
    details: {
      inspiration: payload.details.inspiration.map(cleanSentence),
      targetAudience: payload.details.targetAudience.map(cleanSentence),
      technicalConstraints: payload.details.technicalConstraints.map(cleanSentence),
      businessConstraints: payload.details.businessConstraints.map(cleanSentence),
      risksFailureModes: payload.details.risksFailureModes.map(cleanSentence),
      adjacentAnalogies: payload.details.adjacentAnalogies.map(cleanPhrase),
      openQuestions: payload.details.openQuestions.map(cleanSentence),
      tensions: payload.details.tensions.map(cleanPhrase),
    },
    crosscheckQuery: fitWithinLimit(payload.crosscheckQuery, 280),
  };
}

function normalizePriorArtSearchPlanPayload(payload: z.infer<typeof priorArtSearchPlanWireSchema>) {
  return {
    directQuery: normalizeSearchQuery(payload.directQuery),
    categoryQuery: normalizeSearchQuery(payload.categoryQuery),
    incumbentQuery: normalizeSearchQuery(payload.incumbentQuery),
  };
}

function buildPriorArtSearchPlanFallback(query: string) {
  const normalized = normalizeSearchQuery(query);

  return {
    directQuery: normalized,
    categoryQuery: normalizeSearchQuery(`${normalized} market category alternatives competitors`, 16),
    incumbentQuery: normalizeSearchQuery(`leading companies apps services similar to ${normalized}`, 16),
  };
}

function buildNodeDetailsPrompt({
  seed,
  node,
  parent,
}: {
  seed: string;
  node: GraphNodeRecord;
  parent?: GraphNodeRecord | null;
}) {
  const parentNotes = parent && hasDetails(parent.details) ? `Parent notes:\n${stringifyDetails(parent.details)}` : "";

  return [
    `Seed: ${seed}`,
    `Selected idea: ${node.label}`,
    `Idea summary: ${node.summary}`,
    parent ? `Parent idea: ${parent.label}` : "",
    parent ? `Parent summary: ${parent.summary}` : "",
    parentNotes,
    "Generate the full dossier for this single idea.",
    "Return concrete product, customer, market, and execution notes.",
    "Keep every item understandable to a smart non-specialist after one read.",
    "Also return a strong cross-check query that would work well for similarity search.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getNodeDetailsInstructions() {
  return [
    "You are a product strategist fleshing out one startup idea into a concise dossier.",
    "Be concrete, commercially literate, and easy for a smart non-specialist to understand.",
    "Use plain English. If a technical concept matters, explain it in everyday language.",
    "Each sentence-style item must be complete and must not end mid-phrase.",
    "Make the crosscheckQuery specific enough for prior-art and adjacent-solution lookup.",
    "Do not repeat the same point across sections unless it is essential.",
    "Prefer user problems, workflows, and practical execution details over architecture jargon.",
  ].join(" ");
}

function parseNodeHydrationWirePayload(payload: unknown) {
  return ideaNodeHydrationWireSchema.parse(payload);
}

export function parseNodeDetailsPayload(payload: unknown) {
  return ideaNodeHydrationSchema.parse(normalizeNodeHydrationPayload(parseNodeHydrationWirePayload(payload)));
}

export function parsePriorArtSearchPlanPayload(payload: unknown) {
  return priorArtSearchPlanSchema.parse(
    normalizePriorArtSearchPlanPayload(priorArtSearchPlanWireSchema.parse(payload)),
  );
}

function hasDetails(details: NodeDetails) {
  return Object.values(details).some((items) => items.length > 0);
}

function formatNodeForPrompt(node: GraphNodeRecord) {
  return hasDetails(node.details)
    ? `${node.label}: ${node.summary}\n${stringifyDetails(node.details)}`
    : `${node.label}: ${node.summary}\nDetails: pending hydration.`;
}

async function generateStructured<T>({
  name,
  schema,
  instructions,
  input,
  maxOutputTokens = 4000,
}: {
  name: string;
  schema: z.ZodType<T>;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await getClient().responses.create({
      model: env.openai.model(),
      instructions,
      input,
      text: {
        format: zodTextFormat(schema, name),
        verbosity: attempt === 0 ? "medium" : "low",
      },
      max_output_tokens: maxOutputTokens + attempt * 2000,
      truncation: "disabled",
    });

    const raw = response.output_text?.trim() ?? "";

    if (raw) {
      try {
        const candidate = extractJsonCandidate(raw);
        return schema.parse(JSON.parse(candidate));
      } catch (error) {
        try {
          const repairedCandidate = sanitizeJsonCandidate(extractJsonCandidate(raw));
          return schema.parse(JSON.parse(repairedCandidate));
        } catch (repairError) {
          const reason =
            response.status === "incomplete"
              ? `Response incomplete (${response.incomplete_details?.reason ?? "unknown reason"})`
              : "Response completed with invalid JSON";
          lastError =
            repairError instanceof Error
              ? new Error(`${reason} for ${name}: ${repairError.message}`)
              : new Error(`${reason} for ${name}.`);
        }
      }
    } else {
      let maybeRefusal: { refusal?: string } | null = null;

      for (const item of response.output) {
        if (!("content" in item) || !Array.isArray(item.content)) {
          continue;
        }

        for (const content of item.content) {
          if (content.type === "refusal") {
            maybeRefusal = content;
            break;
          }
        }

        if (maybeRefusal) {
          break;
        }
      }

      if (maybeRefusal && "refusal" in maybeRefusal) {
        throw new Error(`OpenAI refused structured output for ${name}: ${String(maybeRefusal.refusal)}`);
      }

      lastError =
        response.status === "incomplete"
          ? new Error(
              `OpenAI response was incomplete for ${name}: ${response.incomplete_details?.reason ?? "unknown reason"}`,
            )
          : new Error(`OpenAI returned no recoverable text payload for ${name}.`);
    }
  }

  throw lastError ?? new Error(`OpenAI returned no parsed output for ${name} and no recoverable text payload.`);
}

export async function generatePriorArtSearchPlan(query: string) {
  const fallback = buildPriorArtSearchPlanFallback(query);

  try {
    const parsed = await generateStructured({
      name: "prior_art_search_plan",
      schema: priorArtSearchPlanWireSchema,
      instructions: [
        "You rewrite startup ideas into better retrieval queries for prior-art and competitor search.",
        "Return three plain-language search queries.",
        "Each query must be a short noun phrase, not a full sentence.",
        "Each query should usually be 5 to 12 words.",
        "directQuery should stay close to the original idea in everyday language.",
        "categoryQuery should broaden to the mainstream market/category terms a non-expert would search.",
        "incumbentQuery should look for category leaders, major alternatives, and adjacent incumbents.",
        "If an obvious mainstream incumbent or category label exists, it is acceptable to include it.",
        "Strip unnecessary audience qualifiers and extra operating detail unless they define the market.",
        "Avoid jargon, invented terms, and niche insider wording.",
        "Each query should be short, web-search friendly, and understandable after one read.",
      ].join(" "),
      input: `Idea to cross-check: ${query}`,
      maxOutputTokens: 800,
    });

    return parsePriorArtSearchPlanPayload(parsed);
  } catch {
    return fallback;
  }
}

export async function generateIdeaTeasers({
  seed,
  focus,
  siblingLabels,
}: {
  seed: string;
  focus?: GraphNodeRecord;
  siblingLabels?: string[];
}) {
  const prompt = focus
    ? [
        `Seed: ${seed}`,
        `Selected idea to expand: ${focus.label}`,
        `Selected idea summary: ${focus.summary}`,
        hasDetails(focus.details) ? stringifyDetails(focus.details) : "",
        siblingLabels?.length ? `Existing child labels: ${siblingLabels.join("; ")}` : "",
        "Generate up to 5 genuinely distinct follow-on business ideas.",
        "Do not produce UI concepts, graph concepts, or meta-tooling descriptions.",
        "Each label must read like a real venture direction or product concept.",
        "Each summary must be understandable after one read by a smart non-specialist.",
      ]
        .filter(Boolean)
      .join("\n\n")
    : [
        `Seed: ${seed}`,
        "Generate up to 5 distinct venture directions that could realistically be built from this seed.",
        "Do not describe the graph, the app, or the ideation process itself.",
        "Prefer concrete business ideas, differentiated offers, or go-to-market angles.",
        "Each idea should be understandable after one read by a smart non-specialist.",
      ].join("\n\n");

  const baseInstructions = [
    "You are a startup strategist generating concrete business directions from a seed concept.",
    "Return thoughtful, non-generic ideas that are understandable to ordinary people, not only experts.",
    "Return teaser-level ideas only: label, short summary, relationship label, relationship explanation, and type.",
    "Do not generate detailed dossiers or category bullet lists in this step.",
    "The headings content should read like investment memo notes for that specific idea, not filler or UI commentary.",
    "Avoid repeating the seed verbatim in every label unless necessary.",
    "Avoid abstract labels like workspace, radar, bridge, scout, studio unless the concept truly requires them.",
    "Prefer ideas with a clear user, clear pain point, and clear first product wedge.",
    "Label the actual product or service, not the architecture behind it.",
    "Use plain English. Avoid dense jargon, consultant language, and unexplained acronyms.",
    "If a technical term is necessary, the summary must explain it in simple words.",
    "Every summary should make clear who it helps, what it does, and what practical benefit it creates.",
    "Every summary and explanation must be complete and must not end mid-phrase.",
    "Respect these hard limits: label <= 64 characters, summary <= 240 characters, edgeLabel <= 24 characters, edgeExplanation <= 180 characters.",
  ];

  let bestPayload: z.infer<typeof ideaTeaserResponseSchema> | null = null;
  let bestReview: IdeaTeaserReview | null = null;
  let repairFeedback = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const instructions = [...baseInstructions, repairFeedback].filter(Boolean).join(" ");
    const parsed = await generateStructured({
      name: "idea_teasers",
      schema: ideaTeaserWireResponseSchema,
      instructions,
      input: prompt,
      maxOutputTokens: 2600,
    });

    const normalized = ideaTeaserResponseSchema.parse(normalizeIdeaTeaserPayload(parsed));
    const review = reviewIdeaTeaserSet(normalized);

    if (!bestReview || review.score > bestReview.score) {
      bestPayload = normalized;
      bestReview = review;
    }

    if (review.accepted) {
      return normalized;
    }

    repairFeedback = [
      "Revise the ideas to fix these problems from the previous attempt.",
      ...review.feedback.slice(0, 8),
      "Return clearer ideas with simpler labels, clearer user benefit, and less jargon.",
    ].join(" ");
  }

  if (!bestPayload) {
    throw new Error("OpenAI did not return any usable idea teasers.");
  }

  return selectBestIdeaTeaserPayload(bestPayload);
}

export async function generateNodeDetails({
  seed,
  node,
  parent,
}: {
  seed: string;
  node: GraphNodeRecord;
  parent?: GraphNodeRecord | null;
}) {
  const parsed = await generateStructured({
    name: "idea_node_hydration",
    schema: ideaNodeHydrationWireSchema,
    instructions: getNodeDetailsInstructions(),
    input: buildNodeDetailsPrompt({ seed, node, parent }),
    maxOutputTokens: 5200,
  });

  return parseNodeDetailsPayload(parsed);
}

export function streamNodeDetails({
  seed,
  node,
  parent,
}: {
  seed: string;
  node: GraphNodeRecord;
  parent?: GraphNodeRecord | null;
}) {
  return getClient().responses.stream({
    model: env.openai.model(),
    instructions: getNodeDetailsInstructions(),
    input: buildNodeDetailsPrompt({ seed, node, parent }),
    text: {
      format: zodTextFormat(ideaNodeHydrationWireSchema, "idea_node_hydration"),
      verbosity: "medium",
    },
    max_output_tokens: 5200,
    truncation: "disabled",
  });
}

export async function analyzeSessionWithAI(session: GraphSession) {
  const ideas = session.graph.nodes
    .filter((node) => node.type !== "seed")
    .map((node) => formatNodeForPrompt(node))
    .join("\n\n");

  const prompt = [
    `Seed: ${session.seed}`,
    "Current ideas and notes:",
    ideas,
    session.insights.priorArt.length > 0
      ? `Known prior-art hits: ${session.insights.priorArt.map((hit) => `${hit.title} - ${hit.snippet}`).join(" | ")}`
      : "Known prior-art hits: none yet",
    "Return the strongest challenges and tensions for the current session.",
  ].join("\n\n");

  const parsed = await generateStructured({
    name: "session_analysis",
    schema: analysisSchema,
    instructions:
      "You are a skeptical product strategist. Return sharp but practical critiques grounded in the actual ideas, not generic warnings.",
    input: prompt,
  });

  const tensions: Tension[] = parsed.tensions.map((tension, index) => ({
    id: `tension_ai_${index}`,
    nodeIds: session.graph.nodes.slice(0, 2).map((node) => node.id),
    summary: tension.summary,
    explanation: tension.explanation,
    severity: tension.severity,
  }));

  return {
    challenges: parsed.challenges,
    tensions,
  };
}

export async function generateOnePagerWithAI(session: GraphSession): Promise<OnePager> {
  const prompt = [
    `Seed: ${session.seed}`,
    "Ideas:",
    session.graph.nodes
      .filter((node) => node.type !== "seed")
      .map((node) => `${node.label}: ${node.summary}`)
      .join("\n"),
    `Challenges: ${session.insights.challenges.join(" | ")}`,
    `Tensions: ${session.insights.tensions.map((item) => item.summary).join(" | ")}`,
    `Prior art: ${session.insights.priorArt.map((hit) => `${hit.title} (${hit.source})`).join(" | ")}`,
  ].join("\n\n");

  const parsed = await generateStructured({
    name: "one_pager",
    schema: onePagerSchema,
    instructions:
      "You are writing a crisp one-page startup brief. Be concrete, commercially literate, and concise.",
    input: prompt,
  });

  return {
    ...parsed,
    exportText: [
      `# ${parsed.title}`,
      "",
      "## Hook",
      parsed.hook,
      "",
      "## Target User",
      parsed.targetUser,
      "",
      "## Opportunity",
      parsed.opportunity,
      "",
      "## Differentiators",
      ...parsed.differentiators.map((item) => `- ${item}`),
      "",
      "## Major Tensions",
      ...parsed.tensions.map((item) => `- ${item}`),
      "",
      "## Prior Art",
      ...(parsed.priorArt.length > 0 ? parsed.priorArt.map((item) => `- ${item}`) : ["- None yet"]),
      "",
      "## MVP Path",
      ...parsed.mvpPath.map((item, index) => `${index + 1}. ${item}`),
    ].join("\n"),
  };
}

export async function embedText(value: string) {
  const response = await getClient().embeddings.create({
    model: env.openai.embeddingModel(),
    input: value,
  });

  return response.data[0]?.embedding ?? [];
}
