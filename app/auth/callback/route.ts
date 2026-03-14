import { NextResponse } from "next/server";

import { getSupabaseServer } from "@/lib/integrations/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/workspace";
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/auth?error=Missing%20auth%20code", origin));
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}`, origin));
  }

  const successPath = next.startsWith("/") ? next : "/workspace";
  const message =
    successPath === "/auth/reset-password" ? "" : `?message=${encodeURIComponent("Authentication complete.")}`;

  return NextResponse.redirect(new URL(`${successPath}${message}`, origin));
}
