"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DismissibleNotice } from "@/components/dismissible-notice";

export function LandingSessionCta({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!seed.trim()) {
      setError("Enter a seed idea first.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            seed: seed.trim(),
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

  if (!signedIn) {
    return (
      <div className="flex flex-col items-center gap-4">
        <input
          disabled
          value=""
          placeholder="e.g. Decentralized social graph..."
          className="w-full max-w-[22rem] rounded-full border px-6 py-3 text-sm outline-none placeholder:text-[var(--landing-text-muted)] md:w-[22rem]"
          style={{
            borderColor: "var(--landing-line)",
            background: "var(--landing-panel-strong)",
            color: "var(--landing-text)",
          }}
        />
        <Link
          href="/auth"
          className="button-feel inline-flex items-center justify-center rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
          style={{
            fontFamily: "var(--font-landing-mono)",
            background: "var(--landing-primary-bg)",
            borderColor: "var(--landing-primary-bg)",
            color: "var(--landing-primary-text)",
          }}
        >
          Sign in to start
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <div className="flex w-full flex-col items-center justify-center gap-3 md:flex-row">
        <input
          type="text"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          placeholder="e.g. Decentralized social graph..."
          className="w-full max-w-[22rem] rounded-full border px-6 py-3 text-sm outline-none transition placeholder:text-[var(--landing-text-muted)] focus:ring-4 md:w-[22rem]"
          style={{
            borderColor: "var(--landing-line)",
            background: "var(--landing-panel-strong)",
            color: "var(--landing-text)",
            boxShadow: "0 0 0 0 rgba(22,17,11,0)",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          style={{
            fontFamily: "var(--font-landing-mono)",
            background: "var(--landing-primary-bg)",
            borderColor: "var(--landing-primary-bg)",
            color: "var(--landing-primary-text)",
          }}
        >
          {isPending ? "Generating..." : "Generate Graph ->"}
        </button>
      </div>

      {error ? (
        <DismissibleNotice
          onClose={() => setError(null)}
          className="border px-3 py-2 text-center text-sm"
          closeClassName="hover:bg-black/5"
        >
          <span style={{ color: "var(--landing-text-muted)" }}>{error}</span>
        </DismissibleNotice>
      ) : null}
    </form>
  );
}
