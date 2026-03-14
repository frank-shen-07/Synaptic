"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getSupabaseBrowser } from "@/lib/integrations/supabase-browser";

export function AccountBar({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    setError(null);

    startTransition(async () => {
      const { error: signOutError } = await getSupabaseBrowser().auth.signOut();

      if (signOutError) {
        setError(signOutError.message);
        return;
      }

      router.push("/auth");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/55 bg-white/55 px-5 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Signed in</p>
        <p className="mt-1 text-sm text-slate-800">{email}</p>
      </div>
      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-900/25 hover:bg-white disabled:cursor-wait disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
