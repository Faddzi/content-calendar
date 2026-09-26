"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AuthError, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Props = { token: string };

export function InvitationRedeemer({ token }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function acceptInvitation() {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setMessage("This invitation link is invalid.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Invitation could not be accepted.");
    setAccepted(true);
    router.replace("/");
    router.refresh();
  }

  useEffect(() => {
    let active = true;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setMessage("This invitation link is invalid.");
      setBusy(false);
      return () => { active = false; };
    }
    createClient().auth.getUser().then(({ data, error }: { data: { user: User | null }; error: AuthError | null }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      if (data.user) {
        setEmail(data.user.email || "");
        acceptInvitation().catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Invitation could not be accepted."); }).finally(() => { if (active) setBusy(false); });
      } else setBusy(false);
    });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const next = `/invite/${token}`;
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", next);
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback.toString() } });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to verify your address, then open this invitation link again.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      await acceptInvitation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="invite-screen"><a className="brand-mark" href="/"><span className="brand-glyph">C</span> Calday</a><section className="invite-panel"><span className="eyebrow">TEAM INVITATION</span>{accepted ? <><div className="invite-success"><Check size={22} /></div><h1>You’re in.</h1><p>Opening your team calendar…</p></> : <><h1>Join your team.</h1><p>Use the email address this invite was sent to. Your teammate role will be applied after email verification.</p><form className="auth-form" onSubmit={submit}><label className="input-label" htmlFor="invite-email">Email address</label><div className="input-wrap"><Mail size={16} /><input id="invite-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></div><label className="input-label" htmlFor="invite-password">{mode === "signup" ? "Choose a password" : "Password"}</label><div className="input-wrap"><KeyRound size={16} /><input id="invite-password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>{message && <p className="form-message" role="status">{message}</p>}<button className="button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account & join" : "Sign in & join"}<ArrowRight size={16} /></button></form><p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Calday?"}<button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }}>{mode === "signup" ? "Sign in" : "Create account"}</button></p></>}</section></main>;
}
