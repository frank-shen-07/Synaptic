import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";

export async function requireAuthenticatedUser() {
  return getAuthenticatedUser();
}

export function unauthorizedJsonResponse() {
  return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
}
