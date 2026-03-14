function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

function requireClientEnv(value: string | undefined, name: string) {
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
    url: () => supabaseUrl || requireEnv("SUPABASE_URL"),
    publicUrl: () => requireClientEnv(nextPublicSupabaseUrl || supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireClientEnv(nextPublicSupabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
};
