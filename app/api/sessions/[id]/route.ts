import { NextResponse } from "next/server";

import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { loadSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const user = await requireAuthenticatedUser();

    if (!user) {
      return unauthorizedJsonResponse();
    }

    const { id } = await params;
    const session = await loadSession(id, user.id);
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
}
