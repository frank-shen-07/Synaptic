import { requireAuthenticatedUser, unauthorizedJsonResponse } from "@/lib/auth/user";
import { applyHydratedNodeDetails } from "@/lib/agent/engine";
import { hydrateNodeInputSchema } from "@/lib/graph/schema";
import { parseNodeDetailsPayload, streamNodeDetails } from "@/lib/integrations/openai";
import { loadSession, saveSession } from "@/lib/storage/sessions";

type RouteProps = {
  params: Promise<{ id: string }>;
};

type HydrationStreamEvent =
  | {
      type: "delta";
      snapshot: string;
    }
  | {
      type: "complete";
      session: Awaited<ReturnType<typeof loadSession>>;
    }
  | {
      type: "error";
      message: string;
    };

function toNdjsonLine(payload: HydrationStreamEvent) {
  return `${JSON.stringify(payload)}\n`;
}

export async function POST(request: Request, { params }: RouteProps) {
  const user = await requireAuthenticatedUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  try {
    const { id } = await params;
    const payload = hydrateNodeInputSchema.parse(await request.json());
    const session = await loadSession(id, user.id);
    const targetNode = session.graph.nodes.find((node) => node.id === payload.nodeId);

    if (!targetNode || targetNode.status === "seed") {
      return Response.json({ error: "Could not generate node details." }, { status: 400 });
    }

    if (targetNode.contentState === "ready" && Object.values(targetNode.details).some((items) => items.length > 0)) {
      return new Response(toNdjsonLine({ type: "complete", session }), {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const parentNode = targetNode.parentId
      ? session.graph.nodes.find((node) => node.id === targetNode.parentId) ?? null
      : null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const writeEvent = (event: HydrationStreamEvent) => {
          controller.enqueue(encoder.encode(toNdjsonLine(event)));
        };

        try {
          const responseStream = streamNodeDetails({
            seed: session.seed,
            node: targetNode,
            parent: parentNode,
          });

          responseStream.on("response.output_text.delta", (event) => {
            writeEvent({
              type: "delta",
              snapshot: event.snapshot,
            });
          });

          const finalResponse = await responseStream.finalResponse();
          const hydrated = parseNodeDetailsPayload(finalResponse.output_parsed);
          const updated = await applyHydratedNodeDetails(session, payload.nodeId, hydrated);
          await saveSession(updated, user.id);

          writeEvent({
            type: "complete",
            session: updated,
          });
          controller.close();
        } catch (error) {
          writeEvent({
            type: "error",
            message: error instanceof Error ? error.message : "Could not generate node details.",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not generate node details.",
      },
      { status: 400 },
    );
  }
}
