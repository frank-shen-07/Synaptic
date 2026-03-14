"use client";

import { LogOut, MoonStar, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getSupabaseBrowser } from "@/lib/integrations/supabase-browser";

type AccountBarProps = {
  email: string;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

export function AccountBar({ email, theme, onToggleTheme }: AccountBarProps) {
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--line)] bg-[var(--card)] px-5 py-3 text-[var(--foreground)] shadow-[var(--shadow)] backdrop-blur-xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground-soft)]">Signed in</p>
        <p className="mt-1 text-sm text-[var(--foreground)]">{email}</p>
      </div>
      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {theme && onToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:border-[color:var(--line-strong)] hover:bg-[var(--button-secondary-hover)]"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[var(--button-secondary)] px-4 py-2 text-sm font-semibold text-[var(--button-secondary-text)] transition hover:border-[color:var(--line-strong)] hover:bg-[var(--button-secondary-hover)] disabled:cursor-wait disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}
