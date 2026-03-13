import { NextResponse } from "next/server";

import { loadSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const session = await loadSession(id);
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
}
