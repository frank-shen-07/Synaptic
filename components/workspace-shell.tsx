"use client";

import Link from "next/link";
import { MoonStar, SunMedium } from "lucide-react";

import { AccountBar } from "@/components/account-bar";
import { CreateSessionForm } from "@/components/create-session-form";
import { usePersistedTheme } from "@/components/use-persisted-theme";
import type { GraphSession } from "@/lib/graph/schema";

const THEME_STORAGE_KEY = "synaptic-workbench-theme";

type WorkspaceShellProps = {
  email: string;
  sessions: GraphSession[];
};

export function WorkspaceShell({ email, sessions }: WorkspaceShellProps) {
  const { theme, setTheme } = usePersistedTheme(THEME_STORAGE_KEY);

  return (
    <div
      data-theme={theme}
      className="graph-workbench-theme min-h-screen"
      style={{ colorScheme: theme }}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-10 px-5 py-6 md:px-8 md:py-8">
        <AccountBar
          email={email}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        />

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel rounded-[2rem] p-8 md:p-10 text-[var(--foreground)]">
            <p className="mb-4 inline-flex rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground-soft)]">
              Private Reasoning Workspace
            </p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1
                  className="max-w-4xl text-5xl leading-[0.94] tracking-[-0.04em] text-[var(--foreground)] md:text-7xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Turn a seed idea into a living graph, then pressure-test it against reality.
                </h1>
                <p
                  className="mt-5 max-w-2xl text-base leading-7 text-[var(--foreground-muted)] md:text-lg"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Synaptic expands one idea into a structured graph with labeled relationships,
                  expandable nodes, devil&apos;s-advocate critique, live prior-art crosschecks,
                  tension detection, and one-click export.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-3 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? (
                  <MoonStar className="h-4 w-4" />
                ) : (
                  <SunMedium className="h-4 w-4" />
                )}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 md:p-8 text-[var(--foreground)]">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground-soft)]">
                Start Session
              </p>
              <h2
                className="mt-2 text-2xl text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Build one complete thinking session
              </h2>
            </div>
            <CreateSessionForm />
          </div>
        </section>

        <section className="glass-panel rounded-[2rem] p-6 md:p-8 text-[var(--foreground)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground-soft)]">
                Recent Sessions
              </p>
              <h2
                className="mt-2 text-2xl text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Resume a graph
              </h2>
            </div>
            <p className="text-sm text-[var(--foreground-muted)]" style={{ fontFamily: "var(--font-body)" }}>
              Only your account can list and reopen these sessions.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sessions.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[color:var(--line)] bg-[var(--button-secondary)] p-6 text-sm text-[var(--foreground-muted)]">
                No sessions yet. Start with one seed idea above.
              </div>
            ) : null}

            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className="rounded-[1.6rem] border border-[color:var(--line)] bg-[var(--button-secondary)] p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--line-strong)] hover:bg-[var(--button-secondary-hover)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
                  Saved Session
                </p>
                <h3
                  className="mt-3 text-2xl leading-tight text-[var(--foreground)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {session.seed}
                </h3>
                <p
                  className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--foreground-muted)]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {session.onePager?.hook ??
                    session.graph.nodes.find((node) => node.type === "seed")?.summary}
                </p>
                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-[var(--foreground-soft)]">
                  Updated {new Date(session.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}