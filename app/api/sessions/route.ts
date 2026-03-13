import { NextResponse } from "next/server";

import { createSession } from "@/lib/agent/engine";
import { createSessionInputSchema } from "@/lib/graph/schema";
import { listSessions, saveSession } from "@/lib/storage/sessions";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  try {
    const payload = createSessionInputSchema.parse(await request.json());
    const session = await createSession(payload.seed, payload.domain);
    await saveSession(session);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not create session.",
      },
      { status: 400 },
    );
  }
}
