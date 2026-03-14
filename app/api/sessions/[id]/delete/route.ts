import { NextResponse } from "next/server";

import { deleteNode } from "@/lib/agent/engine";
import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { deleteNodeInputSchema } from "@/lib/graph/schema";
import { loadSession, saveSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireAuthenticatedUser();

    if (!user) {
      return unauthorizedJsonResponse();
    }

    const { id } = await params;
    const payload = deleteNodeInputSchema.parse(await request.json());
    const session = await loadSession(id, user.id);
    const updated = await deleteNode(session, payload.nodeId);
    await saveSession(updated, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not delete node.",
      },
      { status: 400 },
    );
  }
}
