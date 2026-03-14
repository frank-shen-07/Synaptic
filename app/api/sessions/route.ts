import { NextResponse } from "next/server";

import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { createSession } from "@/lib/agent/engine";
import { createSessionInputSchema } from "@/lib/graph/schema";
import { listSessions, saveSession } from "@/lib/storage/sessions";

export async function GET() {
  const user = await requireAuthenticatedUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const sessions = await listSessions(user.id);
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();

    if (!user) {
      return unauthorizedJsonResponse();
    }

    const payload = createSessionInputSchema.parse(await request.json());
    const session = await createSession(payload.seed, payload.domain);
    await saveSession(session, user.id);
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
