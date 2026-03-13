import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/integrations/env";

let client: ReturnType<typeof createClient<any>> | null = null;

export function getSupabaseAdmin() {
  client ??= createClient<any>(env.supabase.url(), env.supabase.serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
