import { notFound } from "next/navigation";

import { GraphWorkbench } from "@/components/graph-workbench";
import { loadSession } from "@/lib/storage/sessions";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const session = await loadSession(id).catch(() => null);

  if (!session) {
    notFound();
  }

  return <GraphWorkbench initialSession={session} />;
}
