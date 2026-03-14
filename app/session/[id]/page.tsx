import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { GraphWorkbench } from "@/components/graph-workbench";
import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";
import { loadSession } from "@/lib/storage/sessions";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/auth");
  }

  const { id } = await params;
  const session = await loadSession(id, user.id).catch(() => null);

  if (!session) {
    notFound();
  }

  return <GraphWorkbench initialSession={session} />;
}
