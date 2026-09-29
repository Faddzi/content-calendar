"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BarChart2, Building2, CalendarDays, Eye, EyeOff, LockKeyhole, Mail, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { initialError?: string };

export function AuthPanel({ initialError = "" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
        });
        if (error) throw error;
        if (data.session) router.refresh();
        else setMessage("Check your email to verify your account, then sign in.");
      } else {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/reset-password");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback.toString() });
        if (error) throw error;
        setMessage("If an account exists for that address, a reset link is on its way.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not complete that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <a className="brand-mark" href="/" aria-label="Calday home">
          <span className="brand-glyph">C</span><span>Calday</span>
        </a>
        <p className="eyebrow">TEAM CONTENT OPERATIONS</p>
        <h1 id="auth-title">
          {mode === "signin" ? "Welcome back." : mode === "signup" ? "Start your workspace." : "Reset your password."}
        </h1>
        <p className="auth-copy">
          {mode === "signin"
            ? "Sign in to plan, schedule, and track your team's content."
            : mode === "signup"
            ? "Create your account first. You'll set up your workspace next."
            : "Enter your account email and we'll send a secure reset link."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label className="input-label" htmlFor="auth-email">Email address</label>
          <div className="input-wrap">
            <Mail size={15} aria-hidden="true" />
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          {mode !== "reset" && <>
            <label className="input-label" htmlFor="auth-password">Password</label>
            <div className="input-wrap">
              <LockKeyhole size={15} aria-hidden="true" />
              <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <button className="visibility-button" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            <ArrowRight size={15} />
          </button>
        </form>
        {mode === "signin" ? <>
          <p className="auth-switch"><button type="button" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot password?</button></p>
          <p className="auth-switch">New to Calday? <button type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button></p>
        </> : (
          <p className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "Remembered your password?"}{" "}
            <button type="button" onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
          </p>
        )}
        <p className="auth-footnote">Joining a team? Open the invitation link your admin shared with you.</p>
      </section>

      <aside className="auth-aside" aria-label="Product overview">
        <div className="aside-topline"><span>CALDAY</span><span>CONTENT OPERATIONS</span></div>
        <div>
          <div className="aside-headline">
            Plan together.<br />
            <strong>Publish with intent.</strong>
          </div>
          <p className="aside-pitch">
            One shared content calendar for your entire team — from brief to published post, all in one place.
          </p>
          <ul className="aside-features">
            <li>
              <CalendarDays size={16} />
              <span>Schedule posts across X, Instagram, LinkedIn, Threads, Facebook &amp; YouTube</span>
            </li>
            <li>
              <Building2 size={16} />
              <span>Manage multiple companies or clients from a single workspace</span>
            </li>
            <li>
              <Users size={16} />
              <span>Invite teammates as Admins, Contributors, or Viewers — with email-based access</span>
            </li>
            <li>
              <BarChart2 size={16} />
              <span>Filter by date range and compare periods to track publishing velocity</span>
            </li>
          </ul>
        </div>
        <div className="aside-foot"><span>Shared publishing calendar</span><span>Built for content teams</span></div>
      </aside>
    </main>
  );
}
