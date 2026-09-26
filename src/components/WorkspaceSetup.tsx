"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = { email: string };

export function WorkspaceSetup({ email }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Workspace could not be created.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="setup-screen"><a className="brand-mark" href="/"><Building2 size={18} /> Calday</a><section className="setup-panel"><span className="eyebrow">FIRST, YOUR TEAM SPACE</span><h1>Create a workspace</h1><p>Signed in as <strong>{email}</strong>. Your workspace starts with you as its admin.</p><form onSubmit={submit}><label className="input-label" htmlFor="workspace-name">Workspace name</label><input className="text-input" id="workspace-name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={80} required placeholder="e.g. Draftss social team" />{message && <p className="form-message" role="alert">{message}</p>}<button className="button-primary" disabled={busy}>{busy ? "Creating…" : "Create workspace"}<ArrowRight size={16} /></button></form></section></main>;
}
