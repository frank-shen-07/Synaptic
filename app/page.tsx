import Link from "next/link";

import { CreateSessionForm } from "@/components/create-session-form";
import { listSessions } from "@/lib/storage/sessions";

export default async function HomePage() {
  const sessions = await listSessions();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-10 px-5 py-6 md:px-8 md:py-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel rounded-[2rem] p-8 md:p-10">
          <p className="mb-4 inline-flex rounded-full border border-white/60 bg-white/65 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
            Structured Reasoning Session
          </p>
          <h1
            className="max-w-4xl text-5xl leading-[0.94] tracking-[-0.04em] text-slate-950 md:text-7xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Turn a seed idea into a living graph, then pressure-test it against reality.
          </h1>
          <p
            className="mt-5 max-w-2xl text-base leading-7 text-slate-700 md:text-lg"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Synaptic expands one idea into a structured graph with labeled relationships, expandable nodes,
            devil&apos;s-advocate critique, live prior-art crosschecks, tension detection, and one-click export.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3" style={{ fontFamily: "var(--font-body)" }}>
            <div className="rounded-[1.6rem] border border-slate-900/10 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Pipeline</p>
              <p className="mt-2 text-sm text-slate-700">Seed input to graph generation to critique to export.</p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-900/10 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Graph Model</p>
              <p className="mt-2 text-sm text-slate-700">Flat nodes and typed edges rendered as a zoomable spiral map.</p>
            </div>
            <div className="rounded-[1.6rem] border border-slate-900/10 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Crosscheck</p>
              <p className="mt-2 text-sm text-slate-700">Web and GitHub search are indexed back into the session.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6 md:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Start Session</p>
            <h2 className="mt-2 text-2xl text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
              Build one complete thinking session
            </h2>
          </div>
          <CreateSessionForm />
        </div>
      </section>

      <section className="glass-panel rounded-[2rem] p-6 md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent Sessions</p>
            <h2 className="mt-2 text-2xl text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
              Resume a graph
            </h2>
          </div>
          <p className="text-sm text-slate-600" style={{ fontFamily: "var(--font-body)" }}>
            Share links work because each session persists on the server.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-900/15 bg-white/55 p-6 text-sm text-slate-600">
              No sessions yet. Start with one seed idea above.
            </div>
          ) : null}

          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.id}`}
              className="rounded-[1.6rem] border border-slate-900/10 bg-white/75 p-5 transition hover:-translate-y-0.5 hover:border-slate-900/20 hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Originality {(session.insights.originalityScore * 100).toFixed(0)}%
              </p>
              <h3
                className="mt-3 text-2xl leading-tight text-slate-950"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {session.seed}
              </h3>
              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
                {session.onePager?.hook ?? session.graph.nodes.find((node) => node.type === "seed")?.summary}
              </p>
              <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">
                Updated {new Date(session.updatedAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
