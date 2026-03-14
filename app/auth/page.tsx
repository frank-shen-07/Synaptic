import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";

export default async function AuthPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/workspace");
  }

  return <AuthShell />;
}
