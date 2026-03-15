"use client";

import { ArrowRight, FileText, GitBranch, MoonStar, Search, ShieldAlert, Sparkles, SunMedium } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { LandingSessionCta } from "@/components/landing-session-cta";
import { SYNAPTIC_THEME_STORAGE_KEY, usePersistedTheme } from "@/components/use-persisted-theme";

const steps = [
  {
    number: "01",
    icon: "seed",
    title: "Plant a Seed",
    body: "Enter one raw idea. It becomes the center node of your graph and everything radiates from there.",
  },
  {
    number: "02",
    icon: "map",
    title: "Generate Graph",
    body: "AI expands the seed into up to five typed idea nodes with labeled relationships rendered as a zoomable map.",
  },
  {
    number: "03",
    icon: "inspect",
    title: "Drill Into Nodes",
    body: "Click any node to open a structured dossier with summary, tensions, questions, and cross-check controls.",
  },
  {
    number: "04",
    icon: "check",
    title: "Pressure-Test",
    body: "Run Exa, patent, GitHub, and optional Elasticsearch cross-checks on demand. The reranked results feed back into critique and prior-art retrieval.",
  },
  {
    number: "05",
    icon: "export",
    title: "Export",
    body: "Generate a clean one-pager PDF from the session with hook, structure, tensions, and next questions.",
  },
];

const nodeTypes = [
  ["Seed", "The origin idea. Everything in the graph descends from here."],
  ["Inspiration", "Adjacent sparks, concepts, and directions worth pursuing."],
  ["Target Audience", "Who benefits, buys, or feels the pain most acutely."],
  ["Technical Constraints", "Engineering limits, infra realities, and hard boundaries."],
  ["Business Constraints", "Budget, timing, regulation, and go-to-market realities."],
  ["Risks & Failure Modes", "What breaks first and where execution is likely to stall."],
  ["Prior Art", "Existing products, papers, tools, and competitive analogs."],
  ["Adjacent Analogies", "Transferable patterns from other industries and workflows."],
  ["Open Questions", "Unknowns that need explicit research instead of guesswork."],
  ["Tensions", "Trade-offs and contradictions surfaced early instead of buried later."],
];

const features = [
  {
    icon: Sparkles,
    title: "Structured Generation",
    body: "OpenAI Responses returns typed node data instead of freeform text, so each idea has shape and purpose.",
  },
  {
    icon: GitBranch,
    title: "Zoomable Idea Graph",
    body: "React Flow renders the graph as an interactive canvas with circular nodes, labeled edges, and controlled branching.",
  },
  {
    icon: ShieldAlert,
    title: "Devil's Advocate Critique",
    body: "Each node dossier surfaces tensions, weak assumptions, and execution risks instead of only validation.",
  },
  {
    icon: Search,
    title: "Live Crosschecks",
    body: "Run on-demand Exa, patent, GitHub, and optional Elasticsearch search, then rerank the combined results before surfacing the strongest matches.",
  },
  {
    icon: FileText,
    title: "Persistent Sessions",
    body: "Sessions live in Supabase per user, so you can resume, share, and build on previous exploration rounds.",
  },
  {
    icon: ArrowRight,
    title: "One-Pager Export",
    body: "Turn the session into a concise export that captures the hook, strongest branches, tensions, and open questions.",
  },
];

const stackGroups = [
  {
    title: "Intelligence",
    items: [
      ["OpenAI Responses API", "Idea generation"],
      ["Structured outputs", "Node validation"],
      ["Critique pipeline", "Tension analysis"],
      ["Cross-check orchestration", "Result blending"],
    ],
  },
  {
    title: "Search & Validation",
    items: [
      ["Exa", "Web + paper search"],
      ["Serper patents", "Patent lookup"],
      ["GitHub REST API", "Repository discovery"],
      ["Elasticsearch", "Indexed corpus search"],
      ["Jina reranker", "Relevance ordering"],
    ],
  },
  {
    title: "Frontend & Persistence",
    items: [
      ["Next.js 16 + React 19", "App framework"],
      ["React Flow", "Graph canvas"],
      ["Tailwind CSS 4", "Styling"],
      ["Supabase", "Source of truth"],
    ],
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[0.65rem] uppercase tracking-[0.24em]"
      style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)" }}
    >
      {children}
    </p>
  );
}

function GraphPreview() {
  const nodeBase =
    "absolute flex flex-col items-center justify-center rounded-full border text-center transition duration-200 hover:scale-[1.04]";

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="relative aspect-square">
        <div
          className="absolute inset-0 rounded-[1.8rem] border"
          style={{
            background: "var(--landing-panel)",
            borderColor: "var(--landing-line)",
            backgroundImage:
              "linear-gradient(var(--landing-grid) 1px, transparent 1px), linear-gradient(90deg, var(--landing-grid) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            boxShadow: "var(--landing-preview-shadow)",
          }}
        />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 460" fill="none" aria-hidden="true">
          <line x1="230" y1="230" x2="230" y2="82" stroke="var(--landing-line)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="364" y2="150" stroke="var(--landing-line-soft)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="370" y2="300" stroke="var(--landing-line-soft)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="230" y2="375" stroke="var(--landing-line-soft)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="96" y2="305" stroke="var(--landing-line-soft)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="90" y2="162" stroke="var(--landing-line-soft)" strokeWidth="1" strokeDasharray="4 3" />
        </svg>

        <div
          className={`${nodeBase} left-1/2 top-1/2 z-10 h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2`}
          style={{
            background: "var(--landing-primary-bg)",
            borderColor: "var(--landing-primary-bg)",
            boxShadow:
              "0 0 0 10px var(--landing-preview-core-ring), 0 8px 28px color-mix(in srgb, var(--landing-primary-bg) 24%, transparent)",
          }}
        >
          <p
            className="px-2 text-[0.58rem] leading-[1.25]"
            style={{ color: "var(--landing-primary-text)", fontFamily: "var(--font-landing-mono)" }}
          >
            Organic search ranking model
          </p>
          <p
            className="mt-1 text-[0.38rem] uppercase tracking-[0.18em]"
            style={{ color: "color-mix(in srgb, var(--landing-primary-text) 55%, transparent)", fontFamily: "var(--font-landing-mono)" }}
          >
            Seed
          </p>
        </div>

        {[
          { label: "Algorithm novelty", type: "Inspiration", className: "left-1/2 top-[2%] h-24 w-24 -translate-x-1/2" },
          { label: "SEO teams", type: "Audience", className: "right-[1%] top-[18%] h-[92px] w-[92px]" },
          { label: "Crawl budget limits", type: "Constraints", className: "bottom-[18%] right-[1%] h-24 w-24" },
          { label: "Index lag failures", type: "Risks", className: "bottom-[2%] left-1/2 h-[92px] w-[92px] -translate-x-1/2" },
          { label: "PageRank lineage", type: "Prior Art", className: "bottom-[18%] left-[1%] h-[92px] w-[92px]" },
          { label: "Personalization scope?", type: "Questions", className: "left-[1%] top-[18%] h-[92px] w-[92px]" },
        ].map((node) => (
          <div
            key={node.label}
            className={`${nodeBase} ${node.className}`}
            style={{
              background: "var(--landing-panel-strong)",
              borderColor: "var(--landing-line)",
              boxShadow: "0 4px 14px color-mix(in srgb, var(--landing-text) 8%, transparent)",
            }}
          >
            <p
              className="px-2 text-[0.5rem] leading-[1.25]"
              style={{ color: "var(--landing-text)", fontFamily: "var(--font-landing-mono)" }}
            >
              {node.label}
            </p>
            <p
              className="mt-1 text-[0.38rem] uppercase tracking-[0.18em]"
              style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)" }}
            >
              {node.type}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

type LandingPageShellProps = {
  fontClassName: string;
  workspaceHref: Route;
};

export function LandingPageShell({ fontClassName, workspaceHref }: LandingPageShellProps) {
  const { theme, setTheme } = usePersistedTheme(SYNAPTIC_THEME_STORAGE_KEY);

  return (
    <main className={`${fontClassName} landing-theme min-h-screen`} data-theme={theme}>
      <nav
        className="sticky top-0 z-50 border-b px-6 py-5 backdrop-blur-xl md:px-10"
        style={{
          borderColor: "var(--landing-line)",
          background: "var(--landing-nav-bg)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-4" style={{ fontFamily: "var(--font-landing-display)" }}>
            <img src="/brand/favicon.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain opacity-90" />
            <span className="text-[2.1rem] leading-none tracking-[-0.03em]">Synaptic</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex" style={{ fontFamily: "var(--font-landing-mono)", color: "var(--landing-text-muted)" }}>
            <a href="#how" className="transition" style={{ fontSize: "0.68rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              How it works
            </a>
            <a href="#features" className="transition" style={{ fontSize: "0.68rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Features
            </a>
            <a href="#stack" className="transition" style={{ fontSize: "0.68rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Stack
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="button-feel inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.68rem] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-landing-mono)",
                borderColor: "var(--landing-line)",
                background: "var(--landing-secondary-bg)",
                color: "var(--landing-text-soft)",
              }}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <MoonStar className="h-3.5 w-3.5" /> : <SunMedium className="h-3.5 w-3.5" />}
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>

            <Link
              href={workspaceHref}
              className="button-feel rounded-full border px-5 py-2 text-[0.68rem] uppercase tracking-[0.14em] transition"
              style={{
                fontFamily: "var(--font-landing-mono)",
                borderColor: "var(--landing-line)",
                background: "var(--landing-secondary-bg)",
                color: "var(--landing-text-soft)",
              }}
            >
              Sign In -&gt;
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-[1200px] gap-16 px-6 pb-16 pt-24 md:grid-cols-2 md:px-10 md:pb-20 md:pt-24">
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2"
            style={{
              borderColor: "var(--landing-line)",
              color: "var(--landing-text-muted)",
              fontFamily: "var(--font-landing-mono)",
            }}
          >
            <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--landing-text-muted)" }} />
            <span className="text-[0.65rem] uppercase tracking-[0.22em]">Structured Reasoning Session</span>
          </div>

          <h1
            className="mt-7 text-[clamp(2.6rem,4.5vw,4rem)] leading-[1.04] tracking-[-0.035em]"
            style={{ fontFamily: "var(--font-landing-display)" }}
          >
            Turn a seed idea into a <em className="italic" style={{ color: "var(--landing-text-soft)" }}>living graph</em>, then pressure-test it.
          </h1>

          <p
            className="mt-6 max-w-[460px] text-base leading-[1.82]"
            style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}
          >
            Synaptic expands one idea into a structured graph with labeled relationships, expandable nodes,
            devil&apos;s-advocate critique, live prior-art crosschecks, tension detection, and one-click export.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={workspaceHref}
              className="button-feel inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-landing-mono)",
                background: "var(--landing-primary-bg)",
                borderColor: "var(--landing-primary-bg)",
                color: "var(--landing-primary-text)",
              }}
            >
              Sign in to start -&gt;
            </Link>
            <a
              href="#how"
              className="button-feel inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-landing-mono)",
                borderColor: "var(--landing-line)",
                background: "var(--landing-secondary-bg)",
                color: "var(--landing-text-soft)",
              }}
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="flex items-center">
          <GraphPreview />
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-6 pb-16 md:px-10 md:pb-20">
        <div
          className="grid gap-px overflow-hidden rounded-[1.2rem] border md:grid-cols-2 xl:grid-cols-4"
          style={{ borderColor: "var(--landing-line)", background: "var(--landing-line)" }}
        >
          {[
            ["5+", "Node types per session"],
            ["5", "Ideas generated per branch"],
            ["1-click", "One-pager PDF export"],
            ["Live", "Cross-check & prior art"],
          ].map(([value, label]) => (
            <div key={label} className="p-6" style={{ background: "var(--landing-panel)" }}>
              <p className="text-[2.2rem] leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                {value}
              </p>
              <p
                className="mt-2 text-[0.62rem] uppercase tracking-[0.18em]"
                style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)" }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "var(--landing-line)" }}>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
              Five moves from <em className="italic" style={{ color: "var(--landing-text-soft)" }}>seed</em>
              <br />
              to structured insight
            </h2>
          </div>
          <p className="max-w-[340px] text-[0.9rem] leading-[1.78]" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}>
            Each session follows a deterministic pipeline so the graph feels deliberate instead of vague or chatty.
          </p>
        </div>

        <div
          className="grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-5"
          style={{ borderColor: "var(--landing-line)", background: "var(--landing-line)" }}
        >
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col p-6" style={{ background: "var(--landing-panel)" }}>
              <p
                className="mb-5 text-[2.6rem] leading-none"
                style={{ color: "color-mix(in srgb, var(--landing-text) 8%, transparent)", fontFamily: "var(--font-landing-display)" }}
              >
                {step.number}
              </p>
              <p className="mb-4 text-sm" style={{ color: "var(--landing-text-soft)", fontFamily: "var(--font-landing-mono)" }}>
                {step.icon}
              </p>
              <h3 className="mb-3 text-[1.05rem] tracking-[-0.02em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                {step.title}
              </h3>
              <p className="text-[0.78rem] leading-[1.72]" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="nodes" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "var(--landing-line)" }}>
        <SectionLabel>Graph anatomy</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          Every node has a <em className="italic" style={{ color: "var(--landing-text-soft)" }}>role</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border md:grid-cols-2 xl:grid-cols-4"
          style={{ borderColor: "var(--landing-line)", background: "var(--landing-line)" }}
        >
          {nodeTypes.map(([name, description]) => (
            <div key={name} className="p-5" style={{ background: "var(--landing-panel)" }}>
              <p
                className="mb-2 text-[0.6rem] uppercase tracking-[0.18em]"
                style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)" }}
              >
                {name}
              </p>
              <p className="text-[0.8rem] leading-[1.62]" style={{ color: "var(--landing-text-soft)", fontFamily: "var(--font-landing-body)" }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "var(--landing-line)" }}>
        <SectionLabel>Features</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          Built for deep <em className="italic" style={{ color: "var(--landing-text-soft)" }}>thinking</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-3"
          style={{ borderColor: "var(--landing-line)", background: "var(--landing-line)" }}
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="p-8" style={{ background: "var(--landing-panel)" }}>
                <div className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--landing-icon-bg)" }}>
                  <Icon className="h-4 w-4" style={{ color: "var(--landing-text)" }} />
                </div>
                <h3 className="mb-3 text-[1.15rem] tracking-[-0.02em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                  {feature.title}
                </h3>
                <p className="text-[0.8rem] leading-[1.76]" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}>
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="stack" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "var(--landing-line)" }}>
        <SectionLabel>Architecture</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          A well-typed <em className="italic" style={{ color: "var(--landing-text-soft)" }}>runtime split</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-3"
          style={{ borderColor: "var(--landing-line)", background: "var(--landing-line)" }}
        >
          {stackGroups.map((group) => (
            <div key={group.title} className="p-6" style={{ background: "var(--landing-panel)" }}>
              <p
                className="mb-4 border-b pb-3 text-[0.62rem] uppercase tracking-[0.2em]"
                style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)", borderColor: "var(--landing-line)" }}
              >
                {group.title}
              </p>
              <div className="space-y-2">
                {group.items.map(([name, role]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 border-b py-2"
                    style={{ borderColor: "var(--landing-line-soft)" }}
                  >
                    <span className="text-[0.74rem]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                      {name}
                    </span>
                    <span className="text-[0.72rem] italic" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}>
                      {role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="start" className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-20 md:px-10">
        <div className="rounded-[1.6rem] border px-6 py-14 text-center md:px-10" style={{ borderColor: "var(--landing-line)", background: "var(--landing-panel)" }}>
          <h2 className="text-[clamp(1.9rem,3.5vw,3rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
            One idea is all
            <br />
            you need to <em className="italic" style={{ color: "var(--landing-text-soft)" }}>start</em>
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[0.95rem] leading-[1.78]" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-body)" }}>
            Enter a seed below and Synaptic will expand it into a structured graph ready to explore, critique, and export.
          </p>
          <div className="mt-8">
            <LandingSessionCta signedIn={false} />
          </div>
        </div>
      </section>

      <footer
        className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t px-6 py-8 md:px-10"
        style={{ borderColor: "var(--landing-line)" }}
      >
        <div className="flex items-center gap-4" style={{ fontFamily: "var(--font-landing-display)" }}>
          <img src="/brand/favicon.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain opacity-90" />
          <p style={{ fontSize: "1.7rem", lineHeight: 1 }}>Synaptic</p>
        </div>
        <p className="text-[0.62rem] uppercase tracking-[0.18em]" style={{ color: "var(--landing-text-muted)", fontFamily: "var(--font-landing-mono)" }}>
          Idea exploration, structured.
        </p>
      </footer>
    </main>
  );
}
