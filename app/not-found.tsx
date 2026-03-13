import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel max-w-xl rounded-[2rem] p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Missing Session</p>
        <h1 className="mt-4 text-4xl text-slate-950" style={{ fontFamily: "var(--font-display)" }}>
          That Synaptic session doesn&apos;t exist.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
          Start a new idea graph from the home page or revisit a valid share link.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Back Home
        </Link>
      </div>
    </main>
  );
}
