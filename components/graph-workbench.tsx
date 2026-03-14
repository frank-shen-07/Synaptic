"use client";

import {
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { jsPDF } from "jspdf";
import { ArrowLeft, ArrowRight, Copy, Download, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ThoughtNode } from "@/components/thought-node";
import { buildFlowGraph } from "@/lib/graph/layout";
import type { GraphNodeRecord, GraphSession } from "@/lib/graph/schema";

const nodeTypes = {
  thoughtNode: ThoughtNode,
} as unknown as NodeTypes;

type GraphWorkbenchProps = {
  initialSession: GraphSession;
};

const detailSections: Array<{
  key: keyof GraphNodeRecord["details"];
  label: string;
}> = [
  { key: "inspiration", label: "Inspiration" },
  { key: "targetAudience", label: "Target audience" },
  { key: "technicalConstraints", label: "Technical constraints" },
  { key: "businessConstraints", label: "Business constraints" },
  { key: "risksFailureModes", label: "Risks / failure modes" },
  { key: "adjacentAnalogies", label: "Adjacent analogies" },
  { key: "openQuestions", label: "Open questions" },
  { key: "tensions", label: "Tensions" },
];

function isGraphSession(payload: unknown): payload is GraphSession {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "graph" in payload &&
      "insights" in payload &&
      "seed" in payload,
  );
}

function GraphWorkbenchInner({ initialSession }: GraphWorkbenchProps) {
  const pathname = usePathname();
  const [session, setSession] = useState(initialSession);
  const [selectedNodeId, setSelectedNodeId] = useState(initialSession.graph.nodes[0]?.id ?? null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialFlowGraph = buildFlowGraph(initialSession.graph.nodes, initialSession.graph.edges);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowGraph.edges);

  const selectedNode =
    session.graph.nodes.find((node) => node.id === selectedNodeId) ??
    session.graph.nodes.find((node) => node.type === "seed") ??
    null;

  useEffect(() => {
    const updated = buildFlowGraph(session.graph.nodes, session.graph.edges);
    setNodes(updated.nodes);
    setEdges(updated.edges);
  }, [session, setEdges, setNodes]);

  async function mutateSession(
    endpoint: string,
    body?: Record<string, string>,
    fallbackMessage?: string,
  ) {
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: body
            ? {
                "content-type": "application/json",
              }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });

        const payload = (await response.json()) as unknown;

        if (!response.ok || !isGraphSession(payload)) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : fallbackMessage ?? "Request failed.";
          throw new Error(message);
        }

        setSession(payload);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : fallbackMessage ?? "Request failed.");
      }
    });
  }

  async function generateBrief() {
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${session.id}/one-pager`, {
          method: "POST",
        });
        const payload = (await response.json()) as unknown;

        if (
          !response.ok ||
          !payload ||
          typeof payload !== "object" ||
          !("session" in payload) ||
          !isGraphSession(payload.session)
        ) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Could not generate one-pager.";
          throw new Error(message);
        }

        setSession(payload.session);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not generate one-pager.");
      }
    });
  }

  async function copyShareLink() {
    const shareUrl = `${window.location.origin}${pathname}`;
    await navigator.clipboard.writeText(shareUrl);
    setNotice("Share link copied.");
  }

  function exportPdf() {
    if (!session.onePager) {
      setNotice("Generate the one-pager first.");
      return;
    }

    const pdf = new jsPDF({
      unit: "pt",
      format: "letter",
    });

    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.text(session.onePager.title, 48, 56);
    pdf.setFont("times", "normal");
    pdf.setFontSize(11);

    const lines = pdf.splitTextToSize(session.onePager.exportText, 510);
    pdf.text(lines, 48, 84);
    pdf.save(`${session.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-one-pager.pdf`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
      <header className="glass-panel rounded-[2rem] p-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/workspace"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </Link>
              <Link href="/" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Synaptic
              </Link>
            </div>
            <h1 className="mt-2 max-w-5xl text-4xl leading-none text-slate-950 md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
              {session.seed}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: "var(--font-body)" }}>
            <button
              type="button"
              onClick={generateBrief}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-slate-500"
            >
              <Sparkles className="h-4 w-4" />
              Generate one-pager
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
            >
              <Copy className="h-4 w-4" />
              Copy share link
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>

      </header>

      {notice ? (
        <div className="glass-panel rounded-[1.4rem] px-5 py-3 text-sm text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
          {notice}
        </div>
      ) : null}

      <section className="glass-panel graph-grid relative overflow-hidden rounded-[2rem]">
        <div className="absolute left-5 top-5 z-10 rounded-full border border-slate-900/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
          Click a node to inspect it
        </div>

        <div className="h-[78vh] w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setIsModalOpen(true);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(15,23,42,0.07)" gap={28} />
            <Controls />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(243,237,227,0.78)"
              style={{
                backgroundColor: "rgba(255,255,255,0.86)",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            />
          </ReactFlow>
        </div>
      </section>

      {isModalOpen && selectedNode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="glass-panel max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] p-6 md:p-7"
            onClick={(event) => event.stopPropagation()}
            style={{ fontFamily: "var(--font-body)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {selectedNode.depth === 0 ? "Seed node" : `Depth ${selectedNode.depth} idea`}
                </p>
                <h2 className="mt-2 text-4xl leading-tight text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedNode.label}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">{selectedNode.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-slate-900/10 bg-white/80 p-3 text-slate-700"
                aria-label="Close node details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              <span className="rounded-full border border-slate-900/10 px-3 py-1">
                {session.graph.nodes.filter((node) => node.parentId === selectedNode.id).length}/5 child ideas
              </span>
              {selectedNode.crosscheckedAt ? (
                <span className="rounded-full border border-amber-700/10 bg-amber-50 px-3 py-1 text-amber-800">
                  Cross-checked {new Date(selectedNode.crosscheckedAt).toLocaleString()}
                </span>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  mutateSession(
                    `/api/sessions/${session.id}/expand`,
                    { nodeId: selectedNode.id, mode: "deeper" },
                    "Could not expand node.",
                  )
                }
                disabled={!selectedNode.expandable || isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Expand node
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  mutateSession(
                    `/api/sessions/${session.id}/crosscheck`,
                    { nodeId: selectedNode.id },
                    "Could not cross-check node.",
                  )
                }
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-wait disabled:text-slate-400"
              >
                <Search className="h-4 w-4" />
                Cross-check for existing similar ideas
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {detailSections.map((section) => {
                const values = selectedNode.details[section.key];

                return (
                  <section key={section.key} className="rounded-[1.5rem] border border-slate-900/10 bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{section.label}</p>
                    {values.length === 0 ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">No content yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {values.map((value) => (
                          <li key={value} className="rounded-[1rem] bg-slate-50/85 px-3 py-2">
                            {value}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>

            <section className="mt-6 rounded-[1.5rem] border border-slate-900/10 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Cross-check results</p>
              {selectedNode.priorArt.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No similarity search has been run for this node yet.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedNode.priorArt.map((hit) => (
                    <a
                      key={hit.id}
                      href={hit.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[1.2rem] border border-amber-700/10 bg-amber-50/75 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-amber-950">{hit.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{hit.snippet}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full border border-amber-700/15 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
                            {hit.source}
                          </span>
                          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {(hit.matchScore * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function GraphWorkbench({ initialSession }: GraphWorkbenchProps) {
  return (
    <ReactFlowProvider>
      <GraphWorkbenchInner initialSession={initialSession} />
    </ReactFlowProvider>
  );
}
