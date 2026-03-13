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

const ideaBlueprintSchema = z.object({
  label: z.string().min(6).max(64),
  summary: z.string().min(20).max(240),
  edgeLabel: z.string().min(3).max(24),
  edgeExplanation: z.string().min(12).max(180),
  type: z.enum([
    "inspiration",
    "target_audience",
    "technical_constraints",
    "business_constraints",
    "prior_art",
    "open_questions",
  ]),
  details: nodeDetailsSchema,
});

const ideaBlueprintResponseSchema = z.object({
  ideas: z.array(ideaBlueprintSchema).min(3).max(5),
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

function normalizeIdeaBlueprintPayload(payload: z.infer<typeof ideaBlueprintResponseSchema>) {
  return {
    ideas: payload.ideas.map((idea) => ({
      ...idea,
      label: cleanPhrase(idea.label),
      summary: cleanSentence(idea.summary),
      edgeLabel: cleanPhrase(idea.edgeLabel),
      edgeExplanation: cleanSentence(idea.edgeExplanation),
      details: {
        inspiration: idea.details.inspiration.map(cleanSentence),
        targetAudience: idea.details.targetAudience.map(cleanSentence),
        technicalConstraints: idea.details.technicalConstraints.map(cleanSentence),
        businessConstraints: idea.details.businessConstraints.map(cleanSentence),
        risksFailureModes: idea.details.risksFailureModes.map(cleanSentence),
        adjacentAnalogies: idea.details.adjacentAnalogies.map(cleanPhrase),
        openQuestions: idea.details.openQuestions.map(cleanSentence),
        tensions: idea.details.tensions.map(cleanPhrase),
      },
    })),
  };
}

async function generateStructured<T>({
  name,
  schema,
  instructions,
  input,
}: {
  name: string;
  schema: z.ZodType<T>;
  instructions: string;
  input: string;
}) {
  const response = await getClient().responses.parse({
    model: env.openai.model(),
    instructions,
    input,
    text: {
      format: zodTextFormat(schema, name),
      verbosity: "medium",
    },
    max_output_tokens: 4000,
    truncation: "disabled",
  });

  if (response.output_parsed) {
    return schema.parse(response.output_parsed);
  }

  const raw = response.output_text?.trim() ?? "";
  if (raw) {
    try {
      const candidate = extractJsonCandidate(raw);
      return schema.parse(JSON.parse(candidate));
    } catch {
      try {
        const repairedCandidate = sanitizeJsonCandidate(extractJsonCandidate(raw));
        return schema.parse(JSON.parse(repairedCandidate));
      } catch {
        throw new Error(
          `OpenAI returned unparseable structured output for ${name}. First 300 chars: ${raw.slice(0, 300)}`,
        );
      }
    }
  }

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

  throw new Error(`OpenAI returned no parsed output for ${name} and no recoverable text payload.`);
}

export async function generateIdeaBlueprints({
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
        stringifyDetails(focus.details),
        siblingLabels?.length ? `Existing child labels: ${siblingLabels.join("; ")}` : "",
        "Generate up to 5 genuinely distinct follow-on business ideas.",
        "Do not produce UI concepts, graph concepts, or meta-tooling descriptions.",
        "Each label must read like a real venture direction or product concept.",
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
        `Seed: ${seed}`,
        "Generate up to 5 distinct venture directions that could realistically be built from this seed.",
        "Do not describe the graph, the app, or the ideation process itself.",
        "Prefer concrete business ideas, differentiated offers, or go-to-market angles.",
      ].join("\n\n");

  const instructions = [
    "You are a startup strategist generating concrete business directions from a seed concept.",
    "Return thoughtful, non-generic ideas.",
    "The headings content should read like investment memo notes for that specific idea, not filler or UI commentary.",
    "Avoid repeating the seed verbatim in every label unless necessary.",
    "Avoid abstract labels like workspace, radar, bridge, scout, studio unless the concept truly requires them.",
    "Every summary, explanation, and sentence-style detail item must be complete and must not end mid-phrase.",
  ].join(" ");

  const parsed = await generateStructured({
    name: "idea_blueprints",
    schema: ideaBlueprintResponseSchema,
    instructions,
    input: prompt,
  });

  return ideaBlueprintResponseSchema.parse(normalizeIdeaBlueprintPayload(parsed));
}

export async function analyzeSessionWithAI(session: GraphSession) {
  const ideas = session.graph.nodes
    .filter((node) => node.type !== "seed")
    .map((node) => `${node.label}: ${node.summary}\n${stringifyDetails(node.details)}`)
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
