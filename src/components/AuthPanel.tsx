"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CalendarDays, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
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
        else setMessage("Check your email to verify your account, then sign in to continue.");
      } else {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/reset-password");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback.toString() });
        if (error) throw error;
        setMessage("If an account exists for that address, a password reset link is on its way.");
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
        <a className="brand-mark" href="/" aria-label="Calday home"><CalendarDays size={19} strokeWidth={2.2} /><span>Calday</span></a>
        <p className="eyebrow">TEAM CONTENT OPERATIONS</p>
        <h1 id="auth-title">{mode === "signin" ? "Welcome back." : mode === "signup" ? "Start your workspace." : "Reset your password."}</h1>
        <p className="auth-copy">{mode === "signin" ? "Sign in to plan, publish, and review your team’s content." : mode === "signup" ? "Create your account first. Your first workspace will make you its admin." : "Enter your account email and we’ll send a secure reset link."}</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="input-label" htmlFor="auth-email">Email address</label>
          <div className="input-wrap"><Mail size={16} aria-hidden="true" /><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></div>
          {mode !== "reset" && <><label className="input-label" htmlFor="auth-password">Password</label><div className="input-wrap"><LockKeyhole size={16} aria-hidden="true" /><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /><button className="visibility-button" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="button-primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}<ArrowRight size={16} /></button>
        </form>
        {mode === "signin" ? <><p className="auth-switch"><button type="button" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot password?</button></p><p className="auth-switch">New to Calday? <button type="button" onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button></p></> : <p className="auth-switch">{mode === "signup" ? "Already have an account?" : "Remembered your password?"} <button type="button" onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button></p>}
        <p className="auth-footnote">Teammate? Open the invitation link shared by your workspace admin.</p>
      </section>
      <aside className="auth-aside" aria-label="Calendar preview">
        <div className="aside-topline"><span>EDITORIAL PLANNER</span><span>01 / TEAM SPACE</span></div>
        <div className="aside-heading"><span>Plan together.</span><strong>Publish with intent.</strong></div>
        <div className="mini-calendar">
          <div className="mini-calendar-head"><span>SEPTEMBER 2026</span><span>WEEK 39</span></div>
          <div className="mini-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="mini-days">{Array.from({ length: 35 }, (_, index) => <span className={[4, 8, 10, 11, 17, 19, 22, 25].includes(index) ? `mini-event event-${index % 3}` : ""} key={index}>{index < 1 ? "31" : index < 31 ? String(index) : String(index - 30)}</span>)}</div>
        </div>
        <div className="aside-foot"><span>Drafts, dates, and decisions</span><span>One shared calendar</span></div>
      </aside>
    </main>
  );
}
