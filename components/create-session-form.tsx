"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
