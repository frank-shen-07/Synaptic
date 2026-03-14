"use client";

import { LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getSupabaseBrowser } from "@/lib/integrations/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const { error: updateError } = await getSupabaseBrowser().auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Password updated. Redirecting to your workspace...");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[820px] items-center px-5 py-8">
      <section className="glass-panel w-full rounded-[2.2rem] p-8 md:p-10">
        <p className="inline-flex rounded-full border border-white/70 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
          Password Recovery
        </p>
        <h1 className="mt-5 text-5xl leading-[0.96] tracking-[-0.05em] text-slate-950 md:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
          Set a new password
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700" style={{ fontFamily: "var(--font-body)" }}>
          Use the recovery session from your email link to choose a new password for this account.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleReset}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">New password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="w-full rounded-[1.3rem] border border-slate-900/10 bg-white/90 px-4 py-3 outline-none transition focus:border-slate-900/25 focus:ring-4 focus:ring-slate-900/5"
              placeholder="Enter a new password"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              className="w-full rounded-[1.3rem] border border-slate-900/10 bg-white/90 px-4 py-3 outline-none transition focus:border-slate-900/25 focus:ring-4 focus:ring-slate-900/5"
              placeholder="Repeat the new password"
            />
          </label>

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Update password
          </button>
        </form>

        <div className="mt-6">
          <Link href="/auth" className="text-sm font-semibold text-slate-700 transition hover:text-slate-950">
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
