"use client";

import { jsPDF } from "jspdf";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Copy,
  Download,
  LocateFixed,
  MoonStar,
  Search,
  Sparkles,
  SunMedium,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

import { DismissibleNotice } from "./dismissible-notice";
import { ForceGraph } from "./force-graph";
import { SYNAPTIC_THEME_STORAGE_KEY, usePersistedTheme } from "./use-persisted-theme";
import type { GraphNodeRecord, GraphSession } from "@/lib/graph/schema";
import { formatUtcTimestamp } from "@/lib/utils";

type GraphWorkbenchProps = {
  initialSession: GraphSession;
};

type WorkbenchTheme = "light" | "dark";

type ProcessingKind = "expand" | "crosscheck" | "onepager" | "delete";

type ProcessingState = {
  kind: ProcessingKind;
  nodeLabel?: string;
};

type HydrationStreamLine =
  | {
      type: "delta";
      snapshot: string;
    }
  | {
      type: "complete";
      session: GraphSession;
    }
  | {
      type: "error";
      message: string;
    };

type StreamingSectionState = {
  started: boolean;
  items: string[];
  partial: string | null;
};

type StreamingHydrationDraft = {
  details: Record<keyof GraphNodeRecord["details"], StreamingSectionState>;
  crosscheckQuery: {
    started: boolean;
    value: string;
    partial: string | null;
  };
};

const NODE_ACCENTS: Record<WorkbenchTheme, Record<GraphNodeRecord["type"], string>> = {
  light: {
    seed: "#0f766e",
    inspiration: "#1f8a70",
    target_audience: "#2563eb",
    technical_constraints: "#d97706",
    business_constraints: "#7c3aed",
    risks_failure_modes: "#dc2626",
    prior_art: "#a16207",
    adjacent_analogies: "#4f46e5",
    open_questions: "#64748b",
    tensions: "#be185d",
  },
  dark: {
    seed: "#63d1c4",
    inspiration: "#7ce0c8",
    target_audience: "#86c7ff",
    technical_constraints: "#ffb85c",
    business_constraints: "#d6a8ff",
    risks_failure_modes: "#ff9287",
    prior_art: "#fbd44b",
    adjacent_analogies: "#a8b8ff",
    open_questions: "#b3c0d1",
    tensions: "#ff9cbc",
  },
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

function decodeEscapedCharacter(character: string) {
  if (character === "n") return "\n";
  if (character === "r") return "\r";
  if (character === "t") return "\t";
  if (character === "b") return "\b";
  if (character === "f") return "\f";
  return character;
}

function findJsonKeyValueStart(snapshot: string, key: string) {
  const keyIndex = snapshot.indexOf(`"${key}"`);

  if (keyIndex === -1) {
    return -1;
  }

  const colonIndex = snapshot.indexOf(":", keyIndex);

  return colonIndex === -1 ? -1 : colonIndex + 1;
}

function readJsonStringArray(snapshot: string, key: string): StreamingSectionState {
  const startIndex = findJsonKeyValueStart(snapshot, key);

  if (startIndex === -1) {
    return {
      started: false,
      items: [],
      partial: null,
    };
  }

  const bracketIndex = snapshot.indexOf("[", startIndex);

  if (bracketIndex === -1) {
    return {
      started: true,
      items: [],
      partial: null,
    };
  }

  const items: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;

  for (let index = bracketIndex + 1; index < snapshot.length; index += 1) {
    const character = snapshot[index];

    if (inString) {
      if (escaped) {
        current += decodeEscapedCharacter(character);
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        items.push(current);
        current = "";
        inString = false;
        continue;
      }

      current += character;
      continue;
    }

    if (character === '"') {
      current = "";
      inString = true;
      continue;
    }

    if (character === "]") {
      return {
        started: true,
        items,
        partial: null,
      };
    }
  }

  return {
    started: true,
    items,
    partial: inString ? current : null,
  };
}

function readJsonStringValue(snapshot: string, key: string) {
  const startIndex = findJsonKeyValueStart(snapshot, key);

  if (startIndex === -1) {
    return {
      started: false,
      value: "",
      partial: null,
    };
  }

  const quoteIndex = snapshot.indexOf('"', startIndex);

  if (quoteIndex === -1) {
    return {
      started: true,
      value: "",
      partial: null,
    };
  }

  let value = "";
  let escaped = false;

  for (let index = quoteIndex + 1; index < snapshot.length; index += 1) {
    const character = snapshot[index];

    if (escaped) {
      value += decodeEscapedCharacter(character);
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      return {
        started: true,
        value,
        partial: null,
      };
    }

    value += character;
  }

  return {
    started: true,
    value: "",
    partial: value,
  };
}

function parseHydrationSnapshot(snapshot: string): StreamingHydrationDraft {
  const details = detailSections.reduce<Record<keyof GraphNodeRecord["details"], StreamingSectionState>>(
    (draft, section) => {
      draft[section.key] = readJsonStringArray(snapshot, section.key);
      return draft;
    },
    {
      inspiration: { started: false, items: [], partial: null },
      targetAudience: { started: false, items: [], partial: null },
      technicalConstraints: { started: false, items: [], partial: null },
      businessConstraints: { started: false, items: [], partial: null },
      risksFailureModes: { started: false, items: [], partial: null },
      adjacentAnalogies: { started: false, items: [], partial: null },
      openQuestions: { started: false, items: [], partial: null },
      tensions: { started: false, items: [], partial: null },
    },
  );

  const crosscheckQuery = readJsonStringValue(snapshot, "crosscheckQuery");

  return {
    details,
    crosscheckQuery,
  };
}

function isGraphSession(payload: unknown): payload is GraphSession {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "graph" in payload &&
      "insights" in payload &&
      "seed" in payload,
  );
}

function getProcessingCopy(state: ProcessingState | null) {
  if (!state) return null;

  if (state.kind === "expand") {
    return {
      title: "Expanding branch",
      detail: state.nodeLabel
        ? `We are branching out from ${state.nodeLabel}.`
        : "We are branching out from the selected idea.",
      animationText: "Generating related branches",
    };
  }

  if (state.kind === "crosscheck") {
    return {
      title: "Cross-checking prior art",
      detail: state.nodeLabel
        ? `We are looking for adjacent ideas around ${state.nodeLabel}.`
        : "We are looking for adjacent ideas around this node.",
      animationText: "Scanning similar ideas",
    };
  }

  if (state.kind === "delete") {
    return {
      title: "Deleting branch",
      detail: state.nodeLabel
        ? `We are removing ${state.nodeLabel} and any dependent child ideas.`
        : "We are removing the selected branch.",
      animationText: "Pruning graph branch",
    };
  }

  return {
    title: "Building one-pager",
    detail: "We are shaping the current graph into a concise exportable brief.",
    animationText: "Drafting one-pager narrative",
  };
}

function updateNode(
  session: GraphSession,
  nodeId: string,
  updater: (node: GraphNodeRecord) => GraphNodeRecord,
): GraphSession {
  return {
    ...session,
    graph: {
      ...session.graph,
      nodes: session.graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    },
  };
}

function TypingStatus({ text }: { text: string }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [typingWidth, setTypingWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!measureRef.current) {
      return;
    }

    setTypingWidth(measureRef.current.getBoundingClientRect().width);
  }, [text]);

  return (
    <span
      className="typing-status"
      style={
        {
          "--characters": text.length,
          "--typing-duration": `${Math.max(3.4, text.length * 0.12)}s`,
          "--typing-width": typingWidth ? `${typingWidth}px` : undefined,
        } as React.CSSProperties
      }
    >
      <span ref={measureRef} className="typing-status__measure" aria-hidden="true">
        {text}
      </span>
      <span className="typing-status__text">{text}</span>
    </span>
  );
}

export function GraphWorkbench({ initialSession }: GraphWorkbenchProps) {
  const pathname = usePathname();
  const [session, setSession] = useState(initialSession);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialSession.graph.nodes[0]?.id ?? null,
  );
  const { theme, setTheme } = usePersistedTheme(SYNAPTIC_THEME_STORAGE_KEY);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [hydrationSnapshot, setHydrationSnapshot] = useState<{ nodeId: string; snapshot: string } | null>(null);
  const [resetViewVersion, setResetViewVersion] = useState(0);
  const [mode3d, setMode3d] = useState(false);
  const [focusedPath, setFocusedPath] = useState<Set<string>>(new Set());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [isPending, startTransition] = useTransition();
  const activeHydrationsRef = useRef(new Set<string>());

  const selectedNode =
    session.graph.nodes.find((node) => node.id === selectedNodeId) ??
    session.graph.nodes.find((node) => node.type === "seed") ??
    null;

  function getNodePath(nodeId: string): Set<string> {
    const path = new Set<string>([nodeId]);
    let cur = nodeId;
    while (true) {
      const parentEdge = session.graph.edges.find((e) => e.target === cur);
      if (!parentEdge) break;
      path.add(parentEdge.source);
      cur = parentEdge.source;
    }
    const queue = [nodeId];
    while (queue.length > 0) {
      const c = queue.shift()!;
      session.graph.edges.forEach((e) => {
        if (e.source === c && !path.has(e.target)) {
          path.add(e.target);
          queue.push(e.target);
        }
      });
    }
    return path;
  }

  const handleNodeClick = useCallback((nodeId: string) => {
    setHydrationSnapshot(null);
    setSelectedNodeId(nodeId);
    setIsModalOpen(true);
  }, []);

  const getFallbackNodeId = useCallback(
    (nextSession: GraphSession, removedNode: GraphNodeRecord | null) => {
      if (!removedNode) {
        return nextSession.graph.nodes.find((node) => node.type === "seed")?.id ?? null;
      }

      if (removedNode.parentId) {
        const parent = nextSession.graph.nodes.find((node) => node.id === removedNode.parentId);

        if (parent) {
          return parent.id;
        }
      }

      return nextSession.graph.nodes.find((node) => node.type === "seed")?.id ?? null;
    },
    [],
  );

  async function mutateSession(
    endpoint: string,
    body?: Record<string, string>,
    fallbackMessage?: string,
    processingKind: ProcessingKind = "expand",
    onSuccess?: (payload: GraphSession) => void,
  ) {
    setNotice(null);
    setProcessingState({ kind: processingKind, nodeLabel: selectedNode?.label });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
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

      startTransition(() => {
        setSession(payload);
      });
      onSuccess?.(payload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : fallbackMessage ?? "Request failed.");
    } finally {
      setProcessingState(null);
    }
  }

  const hydrateNodeDetails = useCallback(
    async (node: GraphNodeRecord) => {
      if (node.contentState === "ready" || node.status === "seed" || activeHydrationsRef.current.has(node.id)) {
        return;
      }

      setNotice(null);
      activeHydrationsRef.current.add(node.id);
      setSession((current) =>
        updateNode(current, node.id, (currentNode) => ({
          ...currentNode,
          contentState: "loading",
          contentError: null,
        })),
      );
      setHydrationSnapshot({ nodeId: node.id, snapshot: "" });

      try {
        const response = await fetch(`/api/sessions/${session.id}/hydrate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nodeId: node.id }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as unknown;
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : "Could not generate node details.";
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error("Node detail stream was unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completed = false;

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf("\n");

          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line) {
              const event = JSON.parse(line) as HydrationStreamLine;

              if (event.type === "delta") {
                setHydrationSnapshot({ nodeId: node.id, snapshot: event.snapshot });
              } else if (event.type === "complete") {
                completed = true;
                setHydrationSnapshot(null);
                setSession(event.session);
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            }

            newlineIndex = buffer.indexOf("\n");
          }
        }

        if (!completed) {
          throw new Error("Node detail stream ended before completion.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not generate node details.";
        setHydrationSnapshot(null);
        setSession((current) =>
          updateNode(current, node.id, (currentNode) => ({
            ...currentNode,
            contentState: "error",
            contentError: message,
          })),
        );
        setNotice(message);
      } finally {
        activeHydrationsRef.current.delete(node.id);
      }
    },
    [session.id],
  );

  useEffect(() => {
    if (!isModalOpen || !selectedNode || processingState || isPending) {
      return;
    }

    if (selectedNode.contentState !== "stub") {
      return;
    }

    void hydrateNodeDetails(selectedNode);
  }, [hydrateNodeDetails, isModalOpen, isPending, processingState, selectedNode]);

  async function generateBrief() {
    setNotice(null);
    setProcessingState({ kind: "onepager" });

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

      const nextSession = payload.session as GraphSession;

      startTransition(() => {
        setSession(nextSession);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate one-pager.");
    } finally {
      setProcessingState(null);
    }
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

    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.text(session.onePager.title, 48, 56);
    pdf.setFont("times", "normal");
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(session.onePager.exportText, 510);
    pdf.text(lines, 48, 84);
    pdf.save(`${session.seed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-one-pager.pdf`);
  }

  const secondaryButtonClass =
    "inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition";
  const processingCopy = getProcessingCopy(processingState);
  const nodeAccent = selectedNode ? NODE_ACCENTS[theme][selectedNode.type] : NODE_ACCENTS[theme].seed;
  const titleGlow =
    theme === "dark"
      ? `0 18px 34px color-mix(in srgb, ${nodeAccent} 26%, transparent)`
      : `0 16px 30px color-mix(in srgb, ${nodeAccent} 18%, transparent)`;
  const busy = Boolean(processingState) || isPending;
  const selectedNodeDetailsPending =
    selectedNode?.contentState === "stub" || selectedNode?.contentState === "loading";
  const selectedNodeHydrationDraft =
    selectedNode && hydrationSnapshot?.nodeId === selectedNode.id
      ? parseHydrationSnapshot(hydrationSnapshot.snapshot)
      : null;

  return (
    <div
      data-theme={theme}
      className="graph-workbench-theme min-h-screen"
      style={{ colorScheme: theme }}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
        <header className="glass-panel rounded-[2rem] p-5 md:px-7 md:py-6 text-[var(--foreground)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/workspace"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-muted)] transition hover:bg-[var(--button-secondary-hover)] hover:text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Link>
                <Link
                  href="/workspace"
                  className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]"
                >
                  Synaptic
                </Link>
              </div>
              <h1
                className="mt-2 max-w-5xl text-4xl leading-none text-[var(--foreground)] md:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {session.seed}
              </h1>
            </div>

            <div
              className="flex flex-nowrap items-center gap-3"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <button
                type="button"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className={`${secondaryButtonClass} border-[color:var(--line)] bg-[var(--button-secondary)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]`}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? (
                  <MoonStar className="h-4 w-4" />
                ) : (
                  <SunMedium className="h-4 w-4" />
                )}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
              <button
                type="button"
                onClick={() => setMode3d((v) => !v)}
                className={`${secondaryButtonClass} border-[color:var(--line)] ${mode3d ? "bg-[var(--button-primary)] text-[var(--button-primary-text)]" : "bg-[var(--button-secondary)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]"}`}
                aria-label="Toggle 3D view"
              >
                <Box className="h-4 w-4" />
                {mode3d ? "2D view" : "3D view"}
              </button>

              <button
                type="button"
                onClick={generateBrief}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--button-primary)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                Generate one-pager
              </button>
              <button
                type="button"
                onClick={copyShareLink}
                className={`${secondaryButtonClass} border-[color:var(--line)] bg-[var(--button-secondary)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]`}
              >
                <Copy className="h-4 w-4" />
                Copy share link
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className={`${secondaryButtonClass} border-[color:var(--line)] bg-[var(--button-secondary)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]`}
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </header>

      {notice ? (
        <DismissibleNotice
          onClose={() => setNotice(null)}
          className="glass-panel px-5 py-3 text-sm text-[var(--foreground-muted)]"
          closeClassName="text-[var(--foreground-soft)] hover:bg-[var(--button-secondary)] hover:text-[var(--foreground)]"
        >
          <div style={{ fontFamily: "var(--font-body)" }}>{notice}</div>
        </DismissibleNotice>
      ) : null}

      <section className="glass-panel relative overflow-hidden rounded-[2rem]">
        <div
          className="absolute left-5 top-5 z-10 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Hover to preview · click to explore
        </div>

        <button
          type="button"
          onClick={() => setResetViewVersion((current) => current + 1)}
          className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Reset view
        </button>

        {processingCopy ? (
          <div
            className="absolute bottom-5 right-5 z-10 max-w-sm rounded-[1.4rem] border border-[color:var(--line-strong)] bg-[color:var(--card-strong)] px-4 py-3 text-[var(--foreground)] shadow-[var(--shadow)] backdrop-blur"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
              {processingCopy.title}
            </p>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              <TypingStatus text={processingCopy.animationText} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
              {processingCopy.detail}
            </p>
          </div>
        ) : null}

        <div className="graph-grid h-[78vh] w-full">
          <ForceGraph
            nodes={session.graph.nodes}
            edges={session.graph.edges}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            theme={theme}
            resetViewVersion={resetViewVersion}
            mode3d={mode3d}
            showSatellites={false}
            focusedPath={focusedPath}
            nodeNotes={nodeNotes}
          />
        </div>
      </section>

      {isModalOpen && selectedNode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          style={{ background: "var(--backdrop)" }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="glass-panel max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] p-6 md:p-7"
            onClick={(event) => event.stopPropagation()}
            style={{ fontFamily: "var(--font-body)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                  style={{
                    color: nodeAccent,
                    background: `color-mix(in srgb, ${nodeAccent} 14%, transparent)`,
                    boxShadow: titleGlow,
                  }}
                >
                  {selectedNode.depth === 0 ? "Seed node" : `Depth ${selectedNode.depth} idea`}
                </p>
                <h2
                  className="mt-3 text-4xl leading-tight text-[var(--foreground)]"
                  style={{
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {selectedNode.label}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
                  {selectedNode.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] p-3 text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                aria-label="Close node details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
              <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                {session.graph.nodes.filter((node) => node.parentId === selectedNode.id).length}/5
                child ideas
              </span>
              {selectedNode.status !== "seed" ? (
                <span className="rounded-full border border-[color:var(--line)] px-3 py-1">
                  {selectedNode.contentState === "ready"
                    ? selectedNode.hydratedAt
                      ? `Dossier ready ${formatUtcTimestamp(selectedNode.hydratedAt)}`
                      : "Dossier ready"
                    : selectedNode.contentState === "loading"
                      ? "Generating dossier"
                      : selectedNode.contentState === "error"
                        ? "Dossier failed"
                        : "Teaser only"}
                </span>
              ) : null}
              {selectedNode.crosscheckedAt ? (
                <span
                  className="rounded-full border px-3 py-1"
                  style={{
                    borderColor: "var(--result-line)",
                    background: "var(--result-bg)",
                    color: "var(--result-chip-text)",
                  }}
                >
                  Cross-checked {formatUtcTimestamp(selectedNode.crosscheckedAt)}
                </span>
              ) : null}
            </div>

            {selectedNode.contentState === "loading" ? (
              <div
                className="mt-4 inline-flex items-center gap-3 rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                style={{ background: "var(--card-soft)" }}
              >
                <span
                  className="h-2.5 w-2.5 animate-pulse rounded-full"
                  style={{ background: nodeAccent, boxShadow: `0 0 14px ${nodeAccent}` }}
                />
                <TypingStatus text="Generating notes" />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  mutateSession(
                    `/api/sessions/${session.id}/expand`,
                    { nodeId: selectedNode.id, mode: "deeper" },
                    "Could not expand node.",
                    "expand",
                  )
                }
                disabled={!selectedNode.expandable || busy}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--button-primary)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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
                    "crosscheck",
                  )
                }
                disabled={busy || selectedNode.contentState === "loading"}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)] disabled:cursor-wait disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                Cross-check for existing similar ideas
              </button>
              {selectedNode.depth > 0 && selectedNode.contentState === "error" ? (
                <button
                  type="button"
                  onClick={() => void hydrateNodeDetails(selectedNode)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)] disabled:cursor-wait disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  Retry dossier generation
                </button>
              ) : null}
              {selectedNode.depth > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    mutateSession(
                      `/api/sessions/${session.id}/delete`,
                      { nodeId: selectedNode.id },
                      "Could not delete node.",
                      "delete",
                      (payload) => {
                        setSelectedNodeId(getFallbackNodeId(payload, selectedNode));
                        setIsModalOpen(false);
                        setNotice("Node deleted.");
                      },
                    )
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--card-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete node
                </button>
              ) : null}
            </div>

            {processingCopy && processingState?.kind !== "onepager" ? (
              <div
                className="mt-4 rounded-[1.4rem] border border-[color:var(--line)] px-4 py-3"
                style={{ background: "var(--card-soft)" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
                  Live processing
                </p>
                <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                  <TypingStatus text={processingCopy.animationText} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  {processingCopy.detail}
                </p>
              </div>
            ) : null}

            {selectedNode.status !== "seed" && selectedNode.contentState !== "ready" ? (
              <section
                className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] p-4"
                style={{ background: "var(--card-soft)" }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
                  Node dossier
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  {selectedNode.contentState === "loading"
                    ? "Generating the deeper notes for this node now. The section cards below will fill in as content arrives."
                    : selectedNode.contentState === "error"
                      ? selectedNode.contentError ?? "Node detail generation failed."
                      : "This node is still a teaser. Opening it starts the full dossier generation."}
                </p>
              </section>
            ) : null}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div
                className="rounded-[1.5rem] border p-4"
                style={{
                  background: "var(--card-soft)",
                  borderColor: "color-mix(in srgb, #fbbf24 52%, var(--line))",
                  boxShadow: "0 0 0 1px color-mix(in srgb, #fbbf24 28%, transparent), 0 12px 26px color-mix(in srgb, #fbbf24 16%, transparent)",
                }}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
                  Your note
                </p>
                <textarea
                  rows={3}
                  placeholder="Add your thinking on this node..."
                  value={nodeNotes.get(selectedNode.id) ?? ""}
                  onChange={(e) => {
                    setNodeNotes((prev) => {
                      const next = new Map(prev);
                      next.set(selectedNode.id, e.target.value);
                      return next;
                    });
                  }}
                  className="w-full resize-none rounded-xl border border-[color:var(--line)] bg-transparent px-3 py-2 text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-soft)] focus:border-[color:var(--foreground-soft)]"
                  style={{ fontFamily: "var(--font-body)" }}
                />
              </div>

              <div
                className="flex flex-col gap-3 rounded-[1.5rem] border p-4"
                style={{
                  background: "var(--card-soft)",
                  borderColor: `color-mix(in srgb, ${nodeAccent} 58%, var(--line))`,
                  boxShadow: `0 0 0 1px color-mix(in srgb, ${nodeAccent} 30%, transparent), 0 12px 26px color-mix(in srgb, ${nodeAccent} 18%, transparent)`,
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
                  Path focus
                </p>
                <p className="text-sm leading-6 text-[var(--foreground-muted)]">
                  Highlight the chain from this node back to the seed and down to its deepest children.
                </p>
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const isFocused = focusedPath.has(selectedNode.id);
                      setFocusedPath(isFocused ? new Set() : getNodePath(selectedNode.id));
                    }}
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
                    style={
                      focusedPath.has(selectedNode.id)
                        ? { borderColor: nodeAccent, color: nodeAccent, background: `color-mix(in srgb, ${nodeAccent} 12%, transparent)` }
                        : { borderColor: "var(--line)", color: "var(--foreground)", background: "var(--button-secondary)" }
                    }
                  >
                    {focusedPath.has(selectedNode.id) ? "Unfocus path" : "Highlight this path"}
                  </button>
                  {focusedPath.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setFocusedPath(new Set())}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--foreground-muted)] transition hover:bg-[var(--button-secondary-hover)]"
                    >
                      Show all
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {detailSections.map((section) => {
                const streamState = selectedNodeHydrationDraft?.details[section.key] ?? null;
                const values =
                  selectedNode.contentState === "loading" && streamState
                    ? streamState.items
                    : selectedNode.details[section.key];
                const partialValue =
                  selectedNode.contentState === "loading" && streamState?.partial ? streamState.partial : null;
                let sectionContent: React.ReactNode;

                if (values.length > 0 || partialValue) {
                  sectionContent = (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      {values.map((value) => (
                        <li
                          key={value}
                          className="rounded-[1rem] px-3 py-2"
                          style={{ background: "var(--button-secondary)" }}
                        >
                          {value}
                        </li>
                      ))}
                      {partialValue ? (
                        <li
                          className="rounded-[1rem] px-3 py-2 text-[var(--foreground)]"
                          style={{ background: "var(--button-secondary)" }}
                        >
                          {partialValue}
                          <span className="animate-pulse">▌</span>
                        </li>
                      ) : null}
                    </ul>
                  );
                } else if (selectedNode.contentState === "loading") {
                  sectionContent = (
                    <p className="mt-3 text-sm leading-6 text-[var(--foreground-soft)]">
                      Waiting for this section...
                    </p>
                  );
                } else {
                  sectionContent = (
                    <p className="mt-3 text-sm leading-6 text-[var(--foreground-soft)]">
                      {selectedNode.contentState === "error"
                        ? "Generation failed for this section."
                        : selectedNodeDetailsPending
                          ? "Content is still generating."
                          : "No content yet."}
                    </p>
                  );
                }

                return (
                  <section
                    key={section.key}
                    className="rounded-[1.5rem] border border-[color:var(--line)] p-4"
                    style={{ background: "var(--card-soft)" }}
                  >
                    <p
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                      style={{
                        color: nodeAccent,
                        background: `color-mix(in srgb, ${nodeAccent} 10%, transparent)`,
                      }}
                    >
                      {section.label}
                    </p>
                    {sectionContent}
                  </section>
                );
              })}
            </div>

            <section
              className="mt-6 rounded-[1.5rem] border border-[color:var(--line)] p-4"
              style={{ background: "var(--card-soft)" }}
            >
              <p
                className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
                style={{
                  color: nodeAccent,
                  background: `color-mix(in srgb, ${nodeAccent} 10%, transparent)`,
                }}
              >
                Cross-check results
              </p>
              {selectedNode.priorArt.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
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
                      className="block rounded-[1.2rem] border px-4 py-3"
                      style={{ borderColor: "var(--result-line)", background: "var(--result-bg)" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {hit.title}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                            {hit.snippet}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{
                              borderColor: "var(--result-line)",
                              background: "var(--result-chip-bg)",
                              color: "var(--result-chip-text)",
                            }}
                          >
                            {hit.source}
                          </span>
                          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
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
    </div>
  );
}
