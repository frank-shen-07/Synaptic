"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Square,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { DismissibleNotice } from "@/components/dismissible-notice";
import { SYNAPTIC_THEME_STORAGE_KEY, usePersistedTheme } from "@/components/use-persisted-theme";
import { getSupabaseBrowser } from "@/lib/integrations/supabase-browser";

type Mode = "login" | "register";

function buildRedirect(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.5H12Z"
      />
      <path fill="#34A853" d="M3.9 7.5l3.2 2.3c.9-1.8 2.7-3 4.9-3 1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.6 14.6 2.7 12 2.7c-3.5 0-6.6 2-8.1 4.8Z" />
      <path fill="#FBBC05" d="M2.8 12c0 1.6.4 3.2 1.1 4.5l3.7-2.9c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L3.9 7.5A9.3 9.3 0 0 0 2.8 12Z" />
      <path fill="#4285F4" d="M12 21.3c2.5 0 4.6-.8 6.2-2.2l-3-2.4c-.8.6-1.9 1.1-3.2 1.1-2.2 0-4-1.2-4.9-3l-3.7 2.9c1.5 2.9 4.6 4.6 8.6 4.6Z" />
    </svg>
  );
}

function Field({
  icon,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  trailing,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div
        className="flex items-center gap-3 rounded-[1rem] border px-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
        style={{
          borderColor: "var(--auth-field-border)",
          background: "var(--auth-field-bg)",
          color: "var(--auth-field-label)",
          paddingBlock: compact ? "0.62rem" : "0.78rem",
        }}
      >
        <div className="shrink-0" style={{ color: "var(--auth-field-icon)" }}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8rem] font-medium" style={{ color: "var(--auth-field-label)" }}>{label}</p>
          <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="mt-1 w-full bg-transparent text-[0.92rem] font-semibold outline-none placeholder:text-[var(--auth-field-placeholder)]"
            style={{ color: "var(--auth-field-text)" }}
          />
        </div>
        {trailing ? <div className="shrink-0" style={{ color: "var(--auth-field-icon)" }}>{trailing}</div> : null}
      </div>
    </label>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 text-sm" style={{ color: "var(--auth-text-soft)" }}>
      <div className="h-px flex-1" style={{ background: "var(--auth-divider)" }} />
      <span>or</span>
      <div className="h-px flex-1" style={{ background: "var(--auth-divider)" }} />
    </div>
  );
}

function SlidingStage({
  active,
  children,
  from,
}: {
  active: boolean;
  children: React.ReactNode;
  from: "left" | "right";
}) {
  const inactiveTransform = from === "left" ? "translateX(-12%)" : "translateX(12%)";

  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 flex items-center justify-center px-10 lg:px-14 ${
        active ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateX(0)" : inactiveTransform,
        transitionDuration: "720ms",
        transitionProperty: "transform, opacity",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

function SwitchPrompt({
  title,
  buttonLabel,
  onClick,
}: {
  title: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="w-full max-w-[30rem] text-center">
      <h2
        className="mx-auto max-w-[28rem] font-semibold tracking-[-0.05em]"
        style={{
          color: "var(--auth-text)",
          fontSize: "clamp(2rem, 1.3rem + 1.25vw, 3rem)",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClick}
        className="mx-auto mt-8 flex h-[4.7rem] w-full max-w-[25rem] items-center justify-center rounded-[1.05rem] font-semibold transition"
        style={{
          background: "var(--auth-primary-bg)",
          color: "var(--auth-primary-text)",
          boxShadow: "0 18px 38px color-mix(in srgb, var(--auth-primary-bg) 24%, transparent)",
          fontSize: "1.35rem",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function AuthFormCard({
  mode,
  email,
  setEmail,
  fullName,
  setFullName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  rememberMe,
  setRememberMe,
  acceptedTerms,
  setAcceptedTerms,
  handleForgotPassword,
  handleEmailAuth,
  handleGoogle,
  message,
  setMessage,
  error,
  setError,
  isPending,
}: {
  mode: Mode;
  email: string;
  setEmail: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean | ((value: boolean) => boolean)) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean | ((value: boolean) => boolean)) => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean | ((value: boolean) => boolean)) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (value: boolean | ((value: boolean) => boolean)) => void;
  handleForgotPassword: () => void;
  handleEmailAuth: () => void;
  handleGoogle: () => void;
  message: string | null;
  setMessage: (value: string | null) => void;
  error: string | null;
  setError: (value: string | null) => void;
  isPending: boolean;
}) {
  const isLogin = mode === "login";

  return (
    <div
      className="w-full max-w-[31.5rem] rounded-[1.65rem] border"
      style={{
        background: "var(--auth-card-bg)",
        borderColor: "var(--auth-card-border)",
        boxShadow: "var(--auth-card-shadow)",
        paddingInline: "clamp(1.1rem, 1.7vw, 1.6rem)",
        paddingBlock: isLogin ? "clamp(1.2rem, 1.7vh, 1.8rem)" : "clamp(0.9rem, 1.3vh, 1.2rem)",
      }}
    >
      <div className="text-center">
        <p
          className="font-semibold leading-none tracking-[-0.04em]"
          style={{ color: "var(--auth-text-muted)", fontSize: isLogin ? "clamp(1.9rem, 1.3rem + 0.9vw, 2.45rem)" : "clamp(1.45rem, 1.1rem + 0.55vw, 1.9rem)" }}
        >
          Welcome to
        </p>
        <h1
          className="mt-2 font-semibold leading-none tracking-[-0.06em]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isLogin ? "clamp(2.7rem, 1.95rem + 1.35vw, 3.6rem)" : "clamp(2.1rem, 1.6rem + 0.85vw, 2.6rem)",
            color: "var(--auth-text)",
          }}
        >
          Synaptic
        </h1>
      </div>

      <div className={`mx-auto mt-6 w-full max-w-[26.75rem] ${isLogin ? "space-y-4" : "space-y-2.5"}`}>
        <Field
          icon={<Mail className="h-6 w-6" />}
          label="Email"
          placeholder="name@email.com"
          type="email"
          value={email}
          onChange={setEmail}
          compact={!isLogin}
        />

        {!isLogin ? (
          <Field
            icon={<UserRound className="h-6 w-6" />}
            label="Display name"
            placeholder="Your Name"
            value={fullName}
            onChange={setFullName}
            compact
          />
        ) : null}

        <Field
          icon={<KeyRound className="h-6 w-6" />}
          label="Password"
          placeholder="••••••••"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
          compact={!isLogin}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="transition"
              style={{ color: "var(--auth-field-icon)" }}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
        />

        {!isLogin ? (
          <Field
            icon={<LockKeyhole className="h-6 w-6" />}
            label="Confirm password"
            placeholder="••••••••"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={setConfirmPassword}
            compact
            trailing={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="transition"
                style={{ color: "var(--auth-field-icon)" }}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />
        ) : null}

        {isLogin ? (
          <div className="flex items-center justify-between gap-4 text-[0.92rem]" style={{ color: "var(--auth-text-muted)" }}>
            <button type="button" onClick={() => setRememberMe((value) => !value)} className="inline-flex items-center gap-3 transition" style={{ color: "var(--auth-text-muted)" }}>
              <span style={{ color: "var(--auth-text-soft)" }}>
                {rememberMe ? (
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] border text-[14px]"
                    style={{
                      borderColor: "var(--auth-primary-bg)",
                      background: "var(--auth-primary-bg)",
                      color: "var(--auth-primary-text)",
                    }}
                  >
                    ✓
                  </span>
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </span>
              Remember me
            </button>

            <button type="button" onClick={handleForgotPassword} disabled={isPending} className="font-semibold transition disabled:opacity-60" style={{ color: "var(--auth-text)" }}>
              Forgot password?
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAcceptedTerms((value) => !value)} className="inline-flex items-start gap-3 text-left text-[0.82rem] leading-snug transition" style={{ color: "var(--auth-text-muted)" }}>
            <span className="mt-0.5" style={{ color: "var(--auth-text-soft)" }}>
              {acceptedTerms ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] border text-[14px]"
                  style={{
                    borderColor: "var(--auth-primary-bg)",
                    background: "var(--auth-primary-bg)",
                    color: "var(--auth-primary-text)",
                  }}
                >
                  ✓
                </span>
              ) : (
                <Square className="h-5 w-5" />
              )}
            </span>
            <span>
              I have read and agree to the <span className="font-semibold" style={{ color: "var(--auth-text)" }}>Disclaimer</span>.
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleEmailAuth}
          disabled={isPending}
          className="flex w-full items-center justify-center rounded-[14px] font-semibold transition disabled:cursor-wait disabled:opacity-70"
          style={{
            background: "var(--auth-primary-bg)",
            color: "var(--auth-primary-text)",
            height: isLogin ? "3.95rem" : "3.15rem",
            fontSize: isLogin ? "1.12rem" : "1rem",
            boxShadow: "0 16px 34px color-mix(in srgb, var(--auth-primary-bg) 24%, transparent)",
          }}
        >
          {isPending ? <LoaderCircle className="h-6 w-6 animate-spin" /> : isLogin ? "Login" : "Register"}
        </button>

        <Divider />

        <button
          type="button"
          onClick={handleGoogle}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-3 rounded-[14px] border font-semibold transition disabled:cursor-wait disabled:opacity-70"
          style={{
            background: "var(--auth-secondary-bg)",
            borderColor: "var(--auth-secondary-border)",
            color: "var(--auth-secondary-text)",
            height: isLogin ? "3.55rem" : "3.05rem",
            fontSize: isLogin ? "0.96rem" : "0.9rem",
            boxShadow: "0 8px 20px color-mix(in srgb, var(--auth-text) 8%, transparent)",
          }}
        >
          <GoogleMark />
          {isLogin ? "Continue with Google" : "Join with Google"}
        </button>

        {message ? (
          <DismissibleNotice
            onClose={() => setMessage(null)}
            className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
            closeClassName="text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
          >
            {message}
          </DismissibleNotice>
        ) : null}
        {error ? (
          <DismissibleNotice
            onClose={() => setError(null)}
            className="border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            closeClassName="text-red-500 hover:bg-red-100 hover:text-red-700"
          >
            {error}
          </DismissibleNotice>
        ) : null}
      </div>
    </div>
  );
}

function DesktopSplit({
  mode,
  onSwitch,
  card,
}: {
  mode: Mode;
  onSwitch: (mode: Mode) => void;
  card: React.ReactNode;
}) {
  const isLogin = mode === "login";

  return (
    <div className="absolute inset-0 hidden md:grid md:grid-cols-2">
      <div className="relative min-h-full overflow-hidden">
        <SlidingStage active={isLogin} from="left">
          <SwitchPrompt title="Don't have an account?" buttonLabel="Register" onClick={() => onSwitch("register")} />
        </SlidingStage>
        <SlidingStage active={!isLogin} from="right">
          {card}
        </SlidingStage>
      </div>

      <div className="relative min-h-full overflow-hidden">
        <SlidingStage active={isLogin} from="right">
          {card}
        </SlidingStage>
        <SlidingStage active={!isLogin} from="left">
          <SwitchPrompt title="Already have an account?" buttonLabel="Login" onClick={() => onSwitch("login")} />
        </SlidingStage>
      </div>
    </div>
  );
}

function MobileStack({
  mode,
  onSwitch,
  card,
}: {
  mode: Mode;
  onSwitch: (mode: Mode) => void;
  card: React.ReactNode;
}) {
  const isLogin = mode === "login";

  return (
    <div className="px-5 pb-10 pt-24 md:hidden">
      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
        {card}
        <div className="rounded-[1rem] border p-4 text-center" style={{ borderColor: "var(--auth-field-border)", background: "var(--auth-mobile-card-bg)" }}>
          <h2 className="text-[1.4rem] font-semibold" style={{ color: "var(--auth-text)" }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </h2>
          <button
            type="button"
            onClick={() => onSwitch(isLogin ? "register" : "login")}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-[12px] text-base font-semibold transition"
            style={{ background: "var(--auth-primary-bg)", color: "var(--auth-primary-text)" }}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthShell() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/workspace";
  const oauthNext = useMemo(() => `/auth/callback?next=${encodeURIComponent(next)}`, [next]);
  const { theme } = usePersistedTheme(SYNAPTIC_THEME_STORAGE_KEY);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(searchParams.get("message"));
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [isPending, startTransition] = useTransition();

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function handleModeChange(nextMode: Mode) {
    resetFeedback();
    setMode(nextMode);
  }

  function handleEmailAuth() {
    resetFeedback();

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      if (!acceptedTerms) {
        setError("Please accept the disclaimer to continue.");
        return;
      }
    }

    startTransition(async () => {
      const supabase = getSupabaseBrowser();

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        if (rememberMe) {
          localStorage.setItem("synaptic:last-email", email);
        } else {
          localStorage.removeItem("synaptic:last-email");
        }

        window.location.assign(next);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildRedirect(oauthNext),
          data: {
            full_name: fullName.trim() || undefined,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setMessage("Check your inbox and verify your email before signing in.");
      setPassword("");
      setConfirmPassword("");
    });
  }

  function handleGoogle() {
    resetFeedback();

    startTransition(async () => {
      const { error: oauthError } = await getSupabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildRedirect(oauthNext),
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    });
  }

  function handleForgotPassword() {
    resetFeedback();

    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }

    startTransition(async () => {
      const { error: resetError } = await getSupabaseBrowser().auth.resetPasswordForEmail(email, {
        redirectTo: buildRedirect("/auth/callback?next=/auth/reset-password"),
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage("Password reset link sent. Check your email.");
    });
  }

  const card = (
    <AuthFormCard
      mode={mode}
      email={email}
      setEmail={setEmail}
      fullName={fullName}
      setFullName={setFullName}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      rememberMe={rememberMe}
      setRememberMe={setRememberMe}
      acceptedTerms={acceptedTerms}
      setAcceptedTerms={setAcceptedTerms}
      handleForgotPassword={handleForgotPassword}
      handleEmailAuth={handleEmailAuth}
      handleGoogle={handleGoogle}
      message={message}
      setMessage={setMessage}
      error={error}
      setError={setError}
      isPending={isPending}
    />
  );

  return (
    <main
      className="auth-theme min-h-screen w-full px-3 py-3 md:px-4 md:py-4"
      data-theme={theme}
      style={{ fontFamily: "var(--font-display)" }}
    >
      <div
        className="glass-panel relative min-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[2rem] border md:min-h-[calc(100dvh-2rem)]"
        style={{
          borderColor: "var(--auth-shell-border)",
          boxShadow: "var(--auth-panel-shadow)",
          background: "var(--auth-shell-bg)",
        }}
      >
        <Link
          href="/"
          className="button-feel absolute left-6 top-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border transition"
          style={{
            borderColor: "var(--auth-home-border)",
            background: "var(--auth-home-bg)",
            color: "var(--auth-home-text)",
            boxShadow: "0 12px 30px color-mix(in srgb, var(--auth-text) 10%, transparent)",
          }}
        >
          <Home className="h-6 w-6" />
        </Link>

        <DesktopSplit mode={mode} onSwitch={handleModeChange} card={card} />
        <MobileStack mode={mode} onSwitch={handleModeChange} card={card} />
      </div>
    </main>
  );
}
