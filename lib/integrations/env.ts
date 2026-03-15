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
  exa: {
    apiKey: () => requireEnv("EXA_API_KEY"),
  },
  serper: {
    apiKey: () => requireEnv("SERPER_API_KEY"),
  },
  jina: {
    apiKey: () => requireEnv("JINA_API_KEY"),
  },
  elasticsearch: {
    url: () => process.env.ELASTICSEARCH_URL,
    index: () => process.env.ELASTICSEARCH_INDEX,
    apiKey: () => process.env.ELASTICSEARCH_API_KEY,
    username: () => process.env.ELASTICSEARCH_USERNAME,
    password: () => process.env.ELASTICSEARCH_PASSWORD,
  },
  github: {
    token: () => process.env.GITHUB_TOKEN,
  },
  supabase: {
    url: () => supabaseUrl || requireEnv("SUPABASE_URL"),
    publicUrl: () => requireClientEnv(nextPublicSupabaseUrl || supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireClientEnv(nextPublicSupabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
};
