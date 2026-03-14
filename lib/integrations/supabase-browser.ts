"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/integrations/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  client ??= createBrowserClient(env.supabase.publicUrl(), env.supabase.anonKey());
  return client;
}
