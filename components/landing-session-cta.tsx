"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
          className="w-full max-w-[22rem] rounded-full border px-6 py-3 text-sm outline-none md:w-[22rem]"
          style={{
            borderColor: "rgba(22, 17, 11, 0.1)",
            background: "#f5f2ee",
            color: "#16110b",
          }}
        />
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5"
          style={{
            fontFamily: "var(--font-landing-mono)",
            background: "#16110b",
            borderColor: "#16110b",
            color: "#f5f2ee",
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
          className="w-full max-w-[22rem] rounded-full border px-6 py-3 text-sm outline-none transition focus:ring-4 md:w-[22rem]"
          style={{
            borderColor: "rgba(22, 17, 11, 0.1)",
            background: "#f5f2ee",
            color: "#16110b",
            boxShadow: "0 0 0 0 rgba(22,17,11,0)",
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-full border px-7 py-3 text-[0.72rem] uppercase tracking-[0.14em] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
          style={{
            fontFamily: "var(--font-landing-mono)",
            background: "#16110b",
            borderColor: "#16110b",
            color: "#f5f2ee",
          }}
        >
          {isPending ? "Generating..." : "Generate Graph ->"}
        </button>
      </div>

      {error ? (
        <p className="text-center text-sm" style={{ color: "#8a8278" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
