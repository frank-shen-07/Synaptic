import { ArrowRight, FileText, GitBranch, Search, ShieldAlert, Sparkles } from "lucide-react";
import { DM_Mono, Instrument_Serif, Libre_Baskerville } from "next/font/google";
import Link from "next/link";

import { AccountBar } from "@/components/account-bar";
import { LandingSessionCta } from "@/components/landing-session-cta";
import { getAuthenticatedUser } from "@/lib/integrations/supabase-server";
import { listSessions } from "@/lib/storage/sessions";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-display",
});

const body = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-landing-body",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-landing-mono",
});

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
    body: "Run web and GitHub cross-checks on demand. The results feed back into critique and prior-art retrieval.",
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
    body: "Run on-demand web and GitHub search, then blend those results with Elasticsearch semantic retrieval.",
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
      ["text-embedding-3-small", "Vector embeddings"],
      ["Critique pipeline", "Tension analysis"],
    ],
  },
  {
    title: "Search & Index",
    items: [
      ["Elasticsearch", "Semantic retrieval"],
      ["Session index", "Full-text search"],
      ["Idea index", "Node similarity"],
      ["Cross-check pipeline", "Web + GitHub"],
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
      style={{ color: "#8a8278", fontFamily: "var(--font-landing-mono)" }}
    >
      {children}
    </p>
  );
}

function GraphPreview() {
  const nodeBase =
    "absolute flex flex-col items-center justify-center rounded-full border text-center shadow-[0_4px_14px_rgba(22,17,11,0.07)] transition duration-200 hover:scale-[1.04]";

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="relative aspect-square">
        <div
          className="absolute inset-0 rounded-[1.8rem] border"
          style={{
            background: "#efeae3",
            borderColor: "rgba(22,17,11,0.1)",
            backgroundImage:
              "linear-gradient(rgba(22,17,11,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(22,17,11,0.07) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            boxShadow: "0 12px 40px rgba(22,17,11,0.07)",
          }}
        />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 460" fill="none" aria-hidden="true">
          <line x1="230" y1="230" x2="230" y2="82" stroke="rgba(22,17,11,0.12)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="364" y2="150" stroke="rgba(22,17,11,0.1)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="370" y2="300" stroke="rgba(22,17,11,0.1)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="230" y2="375" stroke="rgba(22,17,11,0.1)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="96" y2="305" stroke="rgba(22,17,11,0.1)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="230" y1="230" x2="90" y2="162" stroke="rgba(22,17,11,0.1)" strokeWidth="1" strokeDasharray="4 3" />
        </svg>

        <div
          className={`${nodeBase} left-1/2 top-1/2 z-10 h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2`}
          style={{
            background: "#16110b",
            borderColor: "#16110b",
            boxShadow: "0 0 0 10px rgba(22,17,11,0.06), 0 8px 28px rgba(22,17,11,0.18)",
          }}
        >
          <p
            className="px-2 text-[0.58rem] leading-[1.25]"
            style={{ color: "#f5f2ee", fontFamily: "var(--font-landing-mono)" }}
          >
            Organic search ranking model
          </p>
          <p
            className="mt-1 text-[0.38rem] uppercase tracking-[0.18em]"
            style={{ color: "rgba(245,242,238,0.5)", fontFamily: "var(--font-landing-mono)" }}
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
              background: "#f5f2ee",
              borderColor: "rgba(22,17,11,0.1)",
              color: "#3d3830",
            }}
          >
            <p
              className="px-2 text-[0.5rem] leading-[1.25]"
              style={{ color: "#16110b", fontFamily: "var(--font-landing-mono)" }}
            >
              {node.label}
            </p>
            <p
              className="mt-1 text-[0.38rem] uppercase tracking-[0.18em]"
              style={{ color: "#8a8278", fontFamily: "var(--font-landing-mono)" }}
            >
              {node.type}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  const sessions = user ? await listSessions(user.id) : [];

  return (
    <main
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen`}
      style={{
        background: "#f5f2ee",
        color: "#16110b",
      }}
    >
      <nav
        className="sticky top-0 z-50 border-b px-6 py-5 backdrop-blur-xl md:px-10"
        style={{
          borderColor: "rgba(22,17,11,0.1)",
          background: "rgba(245,242,238,0.85)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2" style={{ fontFamily: "var(--font-landing-display)" }}>
            <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#16110b] opacity-35" />
            <span className="text-[1.3rem] tracking-[-0.02em]">Synaptic</span>
          </Link>

          <div
            className="hidden items-center gap-8 md:flex"
            style={{ fontFamily: "var(--font-landing-mono)", color: "#8a8278" }}
          >
            <a href="#how" className="text-[0.68rem] uppercase tracking-[0.16em] transition hover:text-[#16110b]">
              How it works
            </a>
            <a href="#features" className="text-[0.68rem] uppercase tracking-[0.16em] transition hover:text-[#16110b]">
              Features
            </a>
            <a href="#stack" className="text-[0.68rem] uppercase tracking-[0.16em] transition hover:text-[#16110b]">
              Stack
            </a>
          </div>

          <Link
            href={user ? "#start" : "/auth"}
            className="rounded-full border px-5 py-2 text-[0.68rem] uppercase tracking-[0.14em] transition hover:bg-[#efeae3]"
            style={{
              fontFamily: "var(--font-landing-mono)",
              borderColor: "rgba(22,17,11,0.1)",
            }}
          >
            {user ? "Start Session ->" : "Sign In ->"}
          </Link>
        </div>
      </nav>

      {user ? (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 md:px-10">
          <AccountBar email={user.email ?? "Signed in"} />
        </div>
      ) : null}

      <section className="mx-auto grid w-full max-w-[1200px] gap-16 px-6 pb-16 pt-24 md:grid-cols-2 md:px-10 md:pb-20 md:pt-24">
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2"
            style={{
              borderColor: "rgba(22,17,11,0.1)",
              color: "#8a8278",
              fontFamily: "var(--font-landing-mono)",
            }}
          >
            <span className="h-[5px] w-[5px] rounded-full bg-[#8a8278]" />
            <span className="text-[0.65rem] uppercase tracking-[0.22em]">Structured Reasoning Session</span>
          </div>

          <h1
            className="mt-7 text-[clamp(2.6rem,4.5vw,4rem)] leading-[1.04] tracking-[-0.035em]"
            style={{ fontFamily: "var(--font-landing-display)" }}
          >
            Turn a seed idea into a <em className="italic text-[#3d3830]">living graph</em>, then pressure-test it.
          </h1>

          <p
            className="mt-6 max-w-[460px] text-base leading-[1.82] text-[#8a8278]"
            style={{ fontFamily: "var(--font-landing-body)" }}
          >
            Synaptic expands one idea into a structured graph with labeled relationships, expandable nodes,
            devil&apos;s-advocate critique, live prior-art crosschecks, tension detection, and one-click export.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={user ? "#start" : "/auth"}
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-landing-mono)",
                background: "#16110b",
                borderColor: "#16110b",
                color: "#f5f2ee",
              }}
            >
              {user ? "Plant a seed idea ->" : "Sign in to start ->"}
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
              style={{
                fontFamily: "var(--font-landing-mono)",
                borderColor: "rgba(22,17,11,0.1)",
                color: "#3d3830",
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
          style={{ borderColor: "rgba(22,17,11,0.1)", background: "rgba(22,17,11,0.1)" }}
        >
          {[
            ["5+", "Node types per session"],
            ["5", "Ideas generated per branch"],
            ["1-click", "One-pager PDF export"],
            ["Live", "Cross-check & prior art"],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#efeae3] p-6">
              <p className="text-[2.2rem] leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                {value}
              </p>
              <p className="mt-2 text-[0.62rem] uppercase tracking-[0.18em] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
              Five moves from <em className="italic text-[#3d3830]">seed</em>
              <br />
              to structured insight
            </h2>
          </div>
          <p className="max-w-[340px] text-[0.9rem] leading-[1.78] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
            Each session follows a deterministic pipeline so the graph feels deliberate instead of vague or chatty.
          </p>
        </div>

        <div
          className="grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-5"
          style={{ borderColor: "rgba(22,17,11,0.1)", background: "rgba(22,17,11,0.1)" }}
        >
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col bg-[#efeae3] p-6">
              <p className="mb-5 text-[2.6rem] leading-none text-[rgba(22,17,11,0.08)]" style={{ fontFamily: "var(--font-landing-display)" }}>
                {step.number}
              </p>
              <p className="mb-4 text-sm text-[#3d3830]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                {step.icon}
              </p>
              <h3 className="mb-3 text-[1.05rem] tracking-[-0.02em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                {step.title}
              </h3>
              <p className="text-[0.78rem] leading-[1.72] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="nodes" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
        <SectionLabel>Graph anatomy</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          Every node has a <em className="italic text-[#3d3830]">role</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border md:grid-cols-2 xl:grid-cols-4"
          style={{ borderColor: "rgba(22,17,11,0.1)", background: "rgba(22,17,11,0.1)" }}
        >
          {nodeTypes.map(([name, description]) => (
            <div key={name} className="bg-[#efeae3] p-5">
              <p className="mb-2 text-[0.6rem] uppercase tracking-[0.18em] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                {name}
              </p>
              <p className="text-[0.8rem] leading-[1.62] text-[#3d3830]" style={{ fontFamily: "var(--font-landing-body)" }}>
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
        <SectionLabel>Features</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          Built for deep <em className="italic text-[#3d3830]">thinking</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-3"
          style={{ borderColor: "rgba(22,17,11,0.1)", background: "rgba(22,17,11,0.1)" }}
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="bg-[#efeae3] p-8">
                <div className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(22,17,11,0.07)]">
                  <Icon className="h-4 w-4 text-[#16110b]" />
                </div>
                <h3 className="mb-3 text-[1.15rem] tracking-[-0.02em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                  {feature.title}
                </h3>
                <p className="text-[0.8rem] leading-[1.76] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="stack" className="mx-auto w-full max-w-[1200px] border-t px-6 py-20 md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
        <SectionLabel>Architecture</SectionLabel>
        <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
          A well-typed <em className="italic text-[#3d3830]">runtime split</em>
        </h2>

        <div
          className="mt-10 grid gap-px overflow-hidden rounded-[1.2rem] border lg:grid-cols-3"
          style={{ borderColor: "rgba(22,17,11,0.1)", background: "rgba(22,17,11,0.1)" }}
        >
          {stackGroups.map((group) => (
            <div key={group.title} className="bg-[#efeae3] p-6">
              <p
                className="mb-4 border-b pb-3 text-[0.62rem] uppercase tracking-[0.2em] text-[#8a8278]"
                style={{ fontFamily: "var(--font-landing-mono)", borderColor: "rgba(22,17,11,0.1)" }}
              >
                {group.title}
              </p>
              <div className="space-y-2">
                {group.items.map(([name, role]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4 border-b py-2"
                    style={{ borderColor: "rgba(22,17,11,0.07)" }}
                  >
                    <span className="text-[0.74rem]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                      {name}
                    </span>
                    <span className="text-[0.72rem] italic text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
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
        <div className="rounded-[1.6rem] border bg-[#efeae3] px-6 py-14 text-center md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
          <h2 className="text-[clamp(1.9rem,3.5vw,3rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
            One idea is all
            <br />
            you need to <em className="italic text-[#3d3830]">start</em>
          </h2>
          <p className="mx-auto mt-4 max-w-[440px] text-[0.95rem] leading-[1.78] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
            Enter a seed below and Synaptic will expand it into a structured graph ready to explore, critique, and export.
          </p>
          <div className="mt-8">
            <LandingSessionCta signedIn={Boolean(user)} />
          </div>
        </div>
      </section>

      {user ? (
        <section className="mx-auto w-full max-w-[1200px] border-t px-6 pb-24 pt-20 md:px-10" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel>Workspace</SectionLabel>
              <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                Resume a <em className="italic text-[#3d3830]">saved session</em>
              </h2>
            </div>
            <p className="max-w-[360px] text-sm leading-7 text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
              Sessions are private to your authenticated account and reopen exactly where you left them.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sessions.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed bg-[#efeae3] p-6 text-sm text-[#8a8278]" style={{ borderColor: "rgba(22,17,11,0.1)" }}>
                No sessions yet. Start with one seed idea above.
              </div>
            ) : null}

            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className="rounded-[1.2rem] border bg-[#efeae3] p-6 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(22,17,11,0.07)]"
                style={{ borderColor: "rgba(22,17,11,0.1)" }}
              >
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                  Saved Session
                </p>
                <h3 className="mt-3 text-[1.8rem] leading-tight tracking-[-0.03em]" style={{ fontFamily: "var(--font-landing-display)" }}>
                  {session.seed}
                </h3>
                <p className="mt-4 line-clamp-3 text-[0.85rem] leading-[1.8] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-body)" }}>
                  {session.onePager?.hook ?? session.graph.nodes.find((node) => node.type === "seed")?.summary}
                </p>
                <p className="mt-5 text-[0.62rem] uppercase tracking-[0.18em] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-mono)" }}>
                  Updated {new Date(session.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <footer
        className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t px-6 py-8 md:px-10"
        style={{ borderColor: "rgba(22,17,11,0.1)" }}
      >
        <p style={{ fontFamily: "var(--font-landing-display)", fontSize: "1.1rem" }}>Synaptic</p>
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#8a8278]" style={{ fontFamily: "var(--font-landing-mono)" }}>
          Idea exploration, structured.
        </p>
      </footer>
    </main>
  );
}
