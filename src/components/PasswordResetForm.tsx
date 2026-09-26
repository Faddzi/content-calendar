"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm() {
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setHasRecoverySession(Boolean(data.user));
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="invite-screen"><a className="brand-mark" href="/"><span className="brand-glyph">C</span> Calday</a><section className="invite-panel"><span className="eyebrow">ACCOUNT SECURITY</span><h1>Choose a new password.</h1>{!ready ? <p>Verifying your secure reset link…</p> : !hasRecoverySession ? <><p>This reset link is invalid, expired, or already used. Request a fresh link from the sign-in page.</p><a className="button-primary" href="/">Return to sign in <ArrowRight size={15} /></a></> : <><p>Choose a new password with at least 8 characters.</p><form className="auth-form" onSubmit={submit}><label className="input-label" htmlFor="new-password">New password</label><div className="input-wrap"><LockKeyhole size={16} /><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></div><label className="input-label" htmlFor="confirm-password">Confirm password</label><div className="input-wrap"><LockKeyhole size={16} /><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>{message && <p className="form-message" role="alert">{message}</p>}<button className="button-primary auth-submit" disabled={busy}>{busy ? "Updating…" : "Update password"}<ArrowRight size={16} /></button></form></>}</section></main>;
}
