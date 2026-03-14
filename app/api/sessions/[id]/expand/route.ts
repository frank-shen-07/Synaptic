import { NextResponse } from "next/server";

import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { expandNode } from "@/lib/agent/engine";
import { expandNodeInputSchema } from "@/lib/graph/schema";
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
    const payload = expandNodeInputSchema.parse(await request.json());
    const session = await loadSession(id, user.id);
    const updated = await expandNode(session, payload.nodeId, payload.mode);
    await saveSession(updated, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not expand node.",
      },
      { status: 400 },
    );
  }
}
