import { NextResponse } from "next/server";

import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { generateOnePager } from "@/lib/agent/engine";
import { loadSession, saveSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const user = await requireAuthenticatedUser();

    if (!user) {
      return unauthorizedJsonResponse();
    }

    const { id } = await params;
    const session = await loadSession(id, user.id);
    const onePager = await generateOnePager(session);
    await saveSession(session, user.id);
    return NextResponse.json({
      session,
      onePager,
    });
  } catch {
    return NextResponse.json({ error: "Could not generate one-pager." }, { status: 400 });
  }
}
