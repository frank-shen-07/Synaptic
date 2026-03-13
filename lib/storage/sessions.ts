import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { graphSessionSchema, type GraphSession } from "@/lib/graph/schema";

const dataDir = path.join(process.cwd(), ".data", "sessions");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

function sessionPath(id: string) {
  return path.join(dataDir, `${id}.json`);
}

export async function saveSession(session: GraphSession) {
  await ensureDataDir();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
}

export async function loadSession(id: string) {
  await ensureDataDir();
  const raw = await readFile(sessionPath(id), "utf8");
  return graphSessionSchema.parse(JSON.parse(raw));
}

export async function sessionExists(id: string) {
  try {
    await readFile(sessionPath(id), "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function listSessions(): Promise<GraphSession[]> {
  await ensureDataDir();
  const files = await readdir(dataDir);
  const sessions = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const raw = await readFile(path.join(dataDir, file), "utf8");
        return graphSessionSchema.parse(JSON.parse(raw));
      }),
  );

  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
