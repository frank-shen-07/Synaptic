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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Copy, Download, Sparkles, Telescope } from "lucide-react";

import { ThoughtNode } from "@/components/thought-node";
import { buildFlowGraph } from "@/lib/graph/layout";
import type { GraphNodeRecord, GraphSession } from "@/lib/graph/schema";
import { titleCase } from "@/lib/utils";

const nodeTypes = {
  thoughtNode: ThoughtNode,
} as unknown as NodeTypes;

type GraphWorkbenchProps = {
  initialSession: GraphSession;
};

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

  async function runExpand(mode: "deeper" | "wider") {
    if (!selectedNode) {
      return;
    }

    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${session.id}/expand`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            nodeId: selectedNode.id,
            mode,
          }),
        });

        const payload = (await response.json()) as unknown;

        if (!response.ok || !isGraphSession(payload)) {
          const message =
            payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Could not expand node.";
          throw new Error(message);
        }

        setSession(payload);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not expand node.");
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
      <header className="glass-panel flex flex-col gap-4 rounded-[2rem] p-5 md:flex-row md:items-center md:justify-between md:px-7">
        <div>
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Synaptic
          </Link>
          <h1 className="mt-2 text-4xl leading-none text-slate-950 md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            {session.seed}
          </h1>
          <p className="mt-2 text-sm text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
            Originality {(session.insights.originalityScore * 100).toFixed(0)}% based on live crosscheck signals.
          </p>
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
      </header>

      {notice ? (
        <div className="glass-panel rounded-[1.4rem] px-5 py-3 text-sm text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
          {notice}
        </div>
      ) : null}

      <section className="grid min-h-[76vh] gap-5 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="glass-panel graph-grid relative overflow-hidden rounded-[2rem]">
          <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2" style={{ fontFamily: "var(--font-body)" }}>
            {[
              "inspiration",
              "target_audience",
              "technical_constraints",
              "business_constraints",
              "risks_failure_modes",
              "prior_art",
              "adjacent_analogies",
              "open_questions",
              "tensions",
            ].map((type) => (
              <span key={type} className="cluster-chip rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {titleCase(type)}
              </span>
            ))}
          </div>

          <div className="h-[76vh] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(15,23,42,0.08)" gap={28} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                maskColor="rgba(243,237,227,0.75)"
                style={{
                  backgroundColor: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(15,23,42,0.08)",
                }}
              />
            </ReactFlow>
          </div>
        </div>

        <aside className="grid gap-5">
          <section className="glass-panel rounded-[2rem] p-5" style={{ fontFamily: "var(--font-body)" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Selected Node</p>
            {selectedNode ? (
              <>
                <h2 className="mt-3 text-3xl leading-tight text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedNode.label}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-700">{selectedNode.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span className="rounded-full border border-slate-900/10 px-3 py-1">
                    {titleCase(selectedNode.type)}
                  </span>
                  <span className="rounded-full border border-slate-900/10 px-3 py-1">
                    Confidence {(selectedNode.confidence * 100).toFixed(0)}%
                  </span>
                  {selectedNode.severity ? (
                    <span className="rounded-full border border-rose-500/15 bg-rose-50 px-3 py-1 text-rose-700">
                      {selectedNode.severity} severity
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!selectedNode.expandable || isPending}
                    onClick={() => runExpand("deeper")}
                    className="rounded-[1rem] bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Expand deeper
                  </button>
                  <button
                    type="button"
                    disabled={!selectedNode.expandable || isPending}
                    onClick={() => runExpand("wider")}
                    className="rounded-[1rem] border border-slate-900/10 bg-white/75 px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Expand wider
                  </button>
                </div>

                {selectedNode.sourceUrls.length > 0 ? (
                  <div className="mt-5 space-y-2 rounded-[1.2rem] border border-amber-700/10 bg-amber-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Sources</p>
                    {selectedNode.sourceUrls.map((sourceUrl) => (
                      <a
                        key={sourceUrl}
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all text-sm leading-6 text-amber-900 underline decoration-amber-300 underline-offset-2"
                      >
                        {sourceUrl}
                      </a>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Select a node to inspect it.</p>
            )}
          </section>

          <section className="glass-panel rounded-[2rem] p-5" style={{ fontFamily: "var(--font-body)" }}>
            <div className="flex items-center gap-2 text-slate-900">
              <Telescope className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Critique + Crosscheck</p>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Devil&apos;s advocate</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                  {session.insights.challenges.map((challenge) => (
                    <li key={challenge} className="rounded-[1rem] border border-red-700/10 bg-red-50/70 px-4 py-3">
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prior art</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                  {session.insights.priorArt.map((hit) => (
                    <li key={hit.id} className="rounded-[1rem] border border-amber-700/10 bg-amber-50/70 px-4 py-3">
                      <a href={hit.url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-amber-300 underline-offset-2">
                        {hit.title}
                      </a>
                      <p className="mt-1 text-sm text-slate-700">{hit.snippet}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {hit.source} match {(hit.matchScore * 100).toFixed(0)}%
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] p-5" style={{ fontFamily: "var(--font-body)" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Tensions + Export</p>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                {session.insights.tensions.map((tension) => (
                  <div key={tension.id} className="rounded-[1rem] border border-rose-700/10 bg-rose-50/75 px-4 py-3">
                    <p className="text-sm font-semibold text-rose-950">{tension.summary}</p>
                    <p className="mt-1 text-sm leading-6 text-rose-900/80">{tension.explanation}</p>
                  </div>
                ))}
              </div>

              {session.onePager ? (
                <div className="rounded-[1.2rem] border border-slate-900/10 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">One-pager preview</p>
                  <h3 className="mt-3 text-xl text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
                    {session.onePager.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{session.onePager.hook}</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target user</p>
                      <p>{session.onePager.targetUser}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">MVP path</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-4">
                        {session.onePager.mvpPath.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-slate-900/12 bg-white/55 px-4 py-5 text-sm leading-6 text-slate-600">
                  Generate the one-pager to package the current graph into a shareable brief and export it as PDF.
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
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
