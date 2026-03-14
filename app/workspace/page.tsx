import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";
import { listSessions } from "@/lib/storage/sessions";

export default async function WorkspacePage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/auth?next=/workspace");
  }

  const sessions = await listSessions(user.id);

  return <WorkspaceShell email={user.email ?? "Signed in"} sessions={sessions} />;
}
