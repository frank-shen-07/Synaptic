"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const LOADING_PHRASES = [
  "Searching ideas",
  "Mapping connections",
  "Iterating concepts",
  "Expanding branches",
  "Synthesising thoughts",
  "Building your graph",
];

function TypewriterLoader() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = LOADING_PHRASES[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < phrase.length) {
      timeout = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), 55);
    } else if (!deleting && displayed.length === phrase.length) {
      timeout = setTimeout(() => setDeleting(true), 900);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, deleting, phraseIndex]);

  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3" style={{ fontFamily: "var(--font-body)" }}>
      <p className="text-lg font-semibold text-slate-800">
        {displayed}
        <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-slate-800 align-middle" style={{ height: "1.1em" }} />
      </p>
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">This may take a moment</p>
    </div>
  );
}

export function CreateSessionForm() {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            seed,
            domain: domain || undefined,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Could not create session.");
        }

        const payload = (await response.json()) as { id: string };
        router.push(`/session/${payload.id}`);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
      }
    });
  }

  if (isPending) {
    return <TypewriterLoader />;
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} style={{ fontFamily: "var(--font-body)" }}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Seed idea</span>
        <textarea
          required
          rows={5}
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          placeholder="An AI workspace where a founder enters one startup idea and explores tensions, competitors, and adjacent inspiration as a zoomable graph."
          className="w-full rounded-[1.4rem] border border-slate-900/10 bg-white/85 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-slate-900/25 focus:ring-4 focus:ring-slate-900/5"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Domain (optional)</span>
        <input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="SaaS, biotech, climate, fintech..."
          className="w-full rounded-[999px] border border-slate-900/10 bg-white/85 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-slate-900/25 focus:ring-4 focus:ring-slate-900/5"
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center rounded-[999px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-500"
      >
        {isPending ? "Generating graph..." : "Generate thought graph"}
      </button>
    </form>
  );
}
