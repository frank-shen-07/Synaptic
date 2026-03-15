import { z } from "zod";

export const clusterTypes = [
  "seed",
  "inspiration",
  "target_audience",
  "technical_constraints",
  "business_constraints",
  "risks_failure_modes",
  "prior_art",
  "adjacent_analogies",
  "open_questions",
  "tensions",
] as const;

export const nodeDetailsSchema = z.object({
  inspiration: z.array(z.string()).max(5),
  targetAudience: z.array(z.string()).max(5),
  technicalConstraints: z.array(z.string()).max(5),
  businessConstraints: z.array(z.string()).max(5),
  risksFailureModes: z.array(z.string()).max(5),
  adjacentAnalogies: z.array(z.string()).max(5),
  openQuestions: z.array(z.string()).max(5),
  tensions: z.array(z.string()).max(5),
});

export const emptyNodeDetails = {
  inspiration: [],
  targetAudience: [],
  technicalConstraints: [],
  businessConstraints: [],
  risksFailureModes: [],
  adjacentAnalogies: [],
  openQuestions: [],
  tensions: [],
} satisfies z.input<typeof nodeDetailsSchema>;

export const nodeContentStateSchema = z.enum(["stub", "loading", "ready", "error"]);

export const priorArtHitSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  source: z.enum(["Exa", "Patent", "GitHub"]),
  matchScore: z.number().min(0).max(1),
});

export const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(clusterTypes),
  summary: z.string(),
  detailLevel: z.number().int().min(0),
  expandable: z.boolean(),
  confidence: z.number().min(0).max(1),
  depth: z.number().int().min(0),
  weight: z.number().min(0.2).max(2),
  status: z.enum(["seed", "normal", "challenge", "source"]).default("normal"),
  parentId: z.string().nullable().default(null),
  sourceUrls: z.array(z.string().url()).default([]),
  severity: z.enum(["low", "medium", "high"]).nullable().default(null),
  generated: z.boolean().default(false),
  details: nodeDetailsSchema.default(emptyNodeDetails),
  contentState: nodeContentStateSchema.default("ready"),
  contentError: z.string().nullable().default(null),
  hydratedAt: z.string().nullable().default(null),
  crosscheckQuery: z.string().nullable().default(null),
  priorArt: z.array(priorArtHitSchema).default([]),
  crosscheckedAt: z.string().nullable().default(null),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  explanation: z.string(),
  strength: z.number().min(0).max(1),
  highlighted: z.boolean().default(false),
});

export const tensionSchema = z.object({
  id: z.string(),
  nodeIds: z.array(z.string()).min(2),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  explanation: z.string(),
});

export const onePagerSchema = z.object({
  title: z.string(),
  hook: z.string(),
  targetUser: z.string(),
  opportunity: z.string(),
  differentiators: z.array(z.string()),
  tensions: z.array(z.string()),
  priorArt: z.array(z.string()),
  mvpPath: z.array(z.string()),
  exportText: z.string(),
});

export const graphSessionSchema = z.object({
  id: z.string(),
  seed: z.string(),
  domain: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  graph: z.object({
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
  }),
  insights: z.object({
    originalityScore: z.number().min(0).max(1),
    challenges: z.array(z.string()),
    priorArt: z.array(priorArtHitSchema),
    tensions: z.array(tensionSchema),
  }),
  onePager: onePagerSchema.nullable(),
});

export const createSessionInputSchema = z.object({
  seed: z.string().trim().min(6),
  domain: z.string().trim().optional(),
});

export const expandNodeInputSchema = z.object({
  nodeId: z.string(),
  mode: z.enum(["deeper", "wider"]).default("deeper"),
});

export const crosscheckNodeInputSchema = z.object({
  nodeId: z.string(),
});

export const hydrateNodeInputSchema = z.object({
  nodeId: z.string(),
});

export const deleteNodeInputSchema = z.object({
  nodeId: z.string(),
});

export type ClusterType = (typeof clusterTypes)[number];
export type NodeDetails = z.infer<typeof nodeDetailsSchema>;
export type GraphNodeRecord = z.infer<typeof graphNodeSchema>;
export type GraphEdgeRecord = z.infer<typeof graphEdgeSchema>;
export type PriorArtHit = z.infer<typeof priorArtHitSchema>;
export type Tension = z.infer<typeof tensionSchema>;
export type OnePager = z.infer<typeof onePagerSchema>;
export type GraphSession = z.infer<typeof graphSessionSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type ExpandNodeInput = z.infer<typeof expandNodeInputSchema>;
export type CrosscheckNodeInput = z.infer<typeof crosscheckNodeInputSchema>;
export type HydrateNodeInput = z.infer<typeof hydrateNodeInputSchema>;
export type DeleteNodeInput = z.infer<typeof deleteNodeInputSchema>;
