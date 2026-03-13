import { NextResponse } from "next/server";

import { generateOnePager } from "@/lib/agent/engine";
import { loadSession, saveSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const session = await loadSession(id);
    const onePager = generateOnePager(session);
    await saveSession(session);
    return NextResponse.json({
      session,
      onePager,
    });
  } catch {
    return NextResponse.json({ error: "Could not generate one-pager." }, { status: 400 });
  }
}
