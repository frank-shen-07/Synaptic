import type { NextRequest } from "next/server";

import { updateAuthSession } from "@/lib/integrations/supabase-middleware";

export async function proxy(request: NextRequest) {
  return updateAuthSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
