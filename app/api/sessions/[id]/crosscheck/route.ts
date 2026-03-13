import { NextResponse } from "next/server";

import { crosscheckNode } from "@/lib/agent/engine";
import { crosscheckNodeInputSchema } from "@/lib/graph/schema";
import { loadSession, saveSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = crosscheckNodeInputSchema.parse(await request.json());
    const session = await loadSession(id);
    const updated = await crosscheckNode(session, payload.nodeId);
    await saveSession(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not cross-check node.",
      },
      { status: 400 },
    );
  }
}
