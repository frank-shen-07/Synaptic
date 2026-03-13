function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  openai: {
    apiKey: () => requireEnv("OPENAI_API_KEY"),
    model: () => process.env.OPENAI_MODEL || "gpt-5-mini",
    embeddingModel: () => process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  },
  elastic: {
    url: () => requireEnv("ELASTICSEARCH_URL"),
    apiKey: () => requireEnv("ELASTICSEARCH_API_KEY"),
    sessionIndex: () => process.env.ELASTICSEARCH_SESSION_INDEX || "synaptic-sessions",
    ideaIndex: () => process.env.ELASTICSEARCH_IDEA_INDEX || "synaptic-ideas",
  },
  supabase: {
    url: () => requireEnv("SUPABASE_URL"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
};
