"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clipboard, ExternalLink,
  LogOut, Moon, Plus, Search, Settings2, Sun, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarPost, Company, Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "@/lib/types";

type Props = {
  userEmail: string;
  currentUserId: string;
  role: WorkspaceRole;
  workspace: Workspace;
  workspaces: Workspace[];
  companies: Company[];
  posts: CalendarPost[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
};

type DateRange = { label: string; start: string; end: string } | null;

const platforms = ["X", "Instagram", "LinkedIn", "Threads", "Facebook", "YouTube"];
const roleNames: Record<WorkspaceRole, string> = { admin: "Admin", contributor: "Contributor", viewer: "Viewer" };
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const utcDate = (key: string) => new Date(`${key}T00:00:00Z`);
const shiftDate = (key: string, days: number) => { const value = utcDate(key); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const safeMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export function CalendarWorkspace(props: Props) {
  const { userEmail, currentUserId, role, workspace, workspaces, companies, posts, members, invitations } = props;
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = role === "admin";
  const canCreate = role !== "viewer";
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewDate, setViewDate] = useState(() => { const now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(null);
  const [compare, setCompare] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeDraftStart, setRangeDraftStart] = useState("");
  const [rangeDraftEnd, setRangeDraftEnd] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null);
  const [postDate, setPostDate] = useState("");
  const [postCompany, setPostCompany] = useState(companies[0]?.id || "");
  const [postPlatform, setPostPlatform] = useState("X");
  const [postTopic, setPostTopic] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newCompanyColor, setNewCompanyColor] = useState("#d77858");
  const [pendingCompanyRemoval, setPendingCompanyRemoval] = useState("");
  const [pendingInvitationRemoval, setPendingInvitationRemoval] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("viewer");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingMemberRemoval, setPendingMemberRemoval] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("calday-theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("calday-theme", theme);
  }, [theme]);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(viewDate);
  const filteredPosts = posts.filter(post => {
    const company = companies.find(item => item.id === post.company_id);
    const matchesCompany = filter === "all" || post.company_id === filter;
    const matchesSearch = !search.trim() || `${post.topic} ${post.platform} ${company?.name || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesRange = !range || (post.scheduled_for >= range.start && post.scheduled_for <= range.end);
    return matchesCompany && matchesSearch && matchesRange;
  });
  const monthPosts = filteredPosts.filter(post => post.scheduled_for.startsWith(`${viewDate.getUTCFullYear()}-${String(viewDate.getUTCMonth() + 1).padStart(2, "0")}-`));
  const rangeLength = range ? Math.round((utcDate(range.end).getTime() - utcDate(range.start).getTime()) / 86400000) + 1 : 0;
  const previousRangeCount = range && compare
    ? posts.filter(post => {
      const previousEnd = shiftDate(range.start, -1);
      const previousStart = shiftDate(previousEnd, -(rangeLength - 1));
      const companyMatches = filter === "all" || post.company_id === filter;
      const searchMatches = !search.trim() || `${post.topic} ${post.platform} ${companies.find(item => item.id === post.company_id)?.name || ""}`.toLowerCase().includes(search.trim().toLowerCase());
      return companyMatches && searchMatches && post.scheduled_for >= previousStart && post.scheduled_for <= previousEnd;
    }).length
    : null;
  const firstDay = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1));
  const gridStart = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1 - firstDay.getUTCDay()));
  const dayCount = firstDay.getUTCDay() + new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0)).getUTCDate() > 35 ? 42 : 35;
  const calendarDays = Array.from({ length: dayCount }, (_, index) => { const day = new Date(gridStart); day.setUTCDate(gridStart.getUTCDate() + index); return day; });
  const postsByDate = new Map<string, CalendarPost[]>();
  filteredPosts.forEach(post => { const dayPosts = postsByDate.get(post.scheduled_for) || []; dayPosts.push(post); postsByDate.set(post.scheduled_for, dayPosts); });
  const todayKey = localDateKey(new Date());

  function openPost(date: string, post?: CalendarPost) {
    if (post && !isAdmin) return;
    if (!post && !canCreate) return;
    setEditingPost(post || null);
    setPostDate(date);
    setPostCompany(post?.company_id || companies[0]?.id || "");
    setPostPlatform(post?.platform || "X");
    setPostTopic(post?.topic || "");
    setPostUrl(post?.published_url || "");
    setPostDialogOpen(true);
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canCreate || (editingPost && !isAdmin)) return;
    setBusy(true);
    setNotice("");
    let publishedUrl: string | null = null;
    if (postUrl.trim()) {
      try {
        const parsed = new URL(postUrl.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        publishedUrl = parsed.toString();
      } catch {
        setNotice("Published links must start with http:// or https://.");
        setBusy(false);
        return;
      }
    }
    const values = { workspace_id: workspace.id, company_id: postCompany, platform: postPlatform, topic: postTopic.trim(), scheduled_for: postDate, published_url: publishedUrl };
    const result = editingPost
      ? await supabase.from("calendar_posts").update(values).eq("id", editingPost.id).eq("workspace_id", workspace.id).select("id").maybeSingle()
      : await supabase.from("calendar_posts").insert({ ...values, created_by: currentUserId }).select("id").single();
    setBusy(false);
    if (result.error) { setNotice(result.error.message); return; }
    setPostDialogOpen(false);
    router.refresh();
  }

  async function deletePost() {
    if (!editingPost || !isAdmin || busy) return;
    setBusy(true);
    const { error } = await supabase.from("calendar_posts").delete().eq("id", editingPost.id).eq("workspace_id", workspace.id);
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setPostDialogOpen(false);
    router.refresh();
  }

  async function addCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || busy) return;
    setBusy(true);
    const { error } = await supabase.from("companies").insert({ workspace_id: workspace.id, name: newCompany.trim(), color: newCompanyColor });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setNewCompany("");
    setNotice("Company added.");
    router.refresh();
  }

  async function removeCompany(companyId: string) {
    if (!isAdmin || busy) return;
    if (pendingCompanyRemoval !== companyId) { setPendingCompanyRemoval(companyId); return; }
    setBusy(true);
    const { error } = await supabase.from("companies").delete().eq("id", companyId).eq("workspace_id", workspace.id);
    setBusy(false);
    setPendingCompanyRemoval("");
    if (error) { setNotice(error.message); return; }
    if (filter === companyId) setFilter("all");
    setNotice("Company and its scheduled posts removed.");
    router.refresh();
  }

  async function inviteTeammate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, email: inviteEmail, role: inviteRole }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invitation could not be created.");
      setInviteUrl(result.inviteUrl);
      setNotice(`Invitation created for ${inviteEmail}. The link expires in ${result.expiresInDays} days.`);
      setInviteEmail("");
      router.refresh();
    } catch (error) {
      setNotice(safeMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function updateMember(member: WorkspaceMember, nextRole: WorkspaceRole) {
    if (!isAdmin || member.user_id === currentUserId || busy) return;
    setBusy(true);
    const response = await fetch("/api/workspaces/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, userId: member.user_id, role: nextRole }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(result.error || "Access could not be changed."); return; }
    setNotice(`Access updated for ${member.email || "teammate"}.`);
    router.refresh();
  }

  async function removeMember(member: WorkspaceMember) {
    if (!isAdmin || member.user_id === currentUserId || busy) return;
    if (pendingMemberRemoval !== member.user_id) { setPendingMemberRemoval(member.user_id); return; }
    setBusy(true);
    const response = await fetch("/api/workspaces/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, userId: member.user_id }) });
    const result = await response.json();
    setBusy(false);
    setPendingMemberRemoval("");
    if (!response.ok) { setNotice(result.error || "Teammate could not be removed."); return; }
    setNotice("Teammate removed from the workspace.");
    router.refresh();
  }

  async function revokeInvitation(invitation: WorkspaceInvitation) {
    if (!isAdmin || busy) return;
    if (pendingInvitationRemoval !== invitation.id) { setPendingInvitationRemoval(invitation.id); return; }
    setBusy(true);
    const response = await fetch("/api/invitations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, invitationId: invitation.id }) });
    const result = await response.json();
    setBusy(false);
    setPendingInvitationRemoval("");
    if (!response.ok) { setNotice(result.error || "Invitation could not be revoked."); return; }
    setNotice(`Invitation for ${invitation.email} revoked.`);
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  function setPreset(preset: string) {
    const today = todayKey;
    const date = utcDate(today);
    const monday = shiftDate(today, -((date.getUTCDay() + 6) % 7));
    let start = today;
    let end = today;
    let label = "Today";
    if (preset === "yesterday") { start = end = shiftDate(today, -1); label = "Yesterday"; }
    if (preset === "this-week") { start = monday; label = "This week"; }
    if (preset === "last-7") { start = shiftDate(today, -6); label = "Last 7 days"; }
    if (preset === "last-14") { start = shiftDate(today, -13); label = "Last 14 days"; }
    if (preset === "this-month") { start = `${today.slice(0, 7)}-01`; label = "This month"; }
    if (preset === "last-30") { start = shiftDate(today, -29); label = "Last 30 days"; }
    if (preset === "last-week") { start = shiftDate(monday, -7); end = shiftDate(start, 6); label = "Last week"; }
    if (preset === "last-month") {
      const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
      start = previous.toISOString().slice(0, 10);
      end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0)).toISOString().slice(0, 10);
      label = "Last month";
    }
    setRange({ label, start, end });
    setRangeOpen(false);
  }

  async function submitRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rangeDraftStart || !rangeDraftEnd || rangeDraftStart > rangeDraftEnd) { setNotice("Choose a valid start and end date."); return; }
    setRange({ label: `${rangeDraftStart} – ${rangeDraftEnd}`, start: rangeDraftStart, end: rangeDraftEnd });
    setViewDate(new Date(Date.UTC(utcDate(rangeDraftEnd).getUTCFullYear(), utcDate(rangeDraftEnd).getUTCMonth(), 1)));
    setRangeOpen(false);
  }

  return (
    <main className={`app-shell ${theme === "dark" ? "theme-dark" : ""}`}>
      <header className="topbar">
        <a className="brand-mark" href="/" aria-label="Calday"><span className="brand-glyph">C</span> Calday</a>
        <div className="topbar-right">
          {workspaces.length > 1 && <label className="workspace-select-wrap" aria-label="Active workspace"><select className="workspace-select" value={workspace.id} onChange={event => router.push(`/?workspace=${event.target.value}`)}>{workspaces.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>}
          <span className="user-email">{userEmail}</span><span className={`role-chip role-${role}`}>{roleNames[role]}</span>
          <button className="icon-button" type="button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></button>
          <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={17} /></button>
        </div>
      </header>
      <section className="calendar-page">
        <div className="page-heading"><div><p className="eyebrow">SHARED CONTENT CALENDAR</p><h1>Content Calendar</h1><p className="page-subtitle">Draftss.com and Deliveryman.ai publishing schedule</p></div><div className="heading-actions">{isAdmin && <button className="button-secondary" onClick={() => { setTeamOpen(true); setNotice(""); }}><Users size={15} /> Team access</button>}{isAdmin && <button className="button-secondary" onClick={() => { setCompaniesOpen(true); setNotice(""); }}><Settings2 size={15} /> Companies</button>}{canCreate && <button className="button-primary" onClick={() => openPost(todayKey)}><Plus size={16} /> New post</button>}</div></div>
        <div className="calendar-toolbar">
          <div className="range-wrap"><button className={`button-secondary range-button ${range ? "selected" : ""}`} onClick={() => { setRangeOpen(value => !value); setRangeDraftStart(range?.start || `${todayKey.slice(0, 7)}-01`); setRangeDraftEnd(range?.end || todayKey); }} aria-expanded={rangeOpen}><CalendarDays size={15} />{range?.label || "All dates"}<ChevronDown size={13} /></button>{rangeOpen && <div className="range-popover"><div className="range-preset-list">{[["today","Today"],["yesterday","Yesterday"],["this-week","This week (Mon - today)"],["last-7","Last 7 days"],["last-week","Last week (Mon - Sun)"],["last-14","Last 14 days"],["this-month","This month"],["last-30","Last 30 days"],["last-month","Last month"]].map(([key,label]) => <button type="button" key={key} onClick={() => setPreset(key)}>{label}</button>)}<button type="button" onClick={() => { setRange(null); setCompare(false); setRangeOpen(false); }}>All dates</button></div><form className="range-custom" onSubmit={submitRange}><strong>Custom range</strong><label>Start<input type="date" value={rangeDraftStart} onChange={event => setRangeDraftStart(event.target.value)} required /></label><label>End<input type="date" value={rangeDraftEnd} onChange={event => setRangeDraftEnd(event.target.value)} required /></label><label className="compare-check"><input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)} disabled={!range} />Compare previous period</label><button className="button-primary" type="submit">Apply dates</button></form></div>}</div>
          <label className="search-box"><Search size={16} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search topics or platforms" aria-label="Search calendar" /></label>
          <div className="month-control"><button className="icon-button" aria-label="Previous month" onClick={() => setViewDate(new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() - 1, 1)))}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button className="icon-button" aria-label="Next month" onClick={() => setViewDate(new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 1)))}><ChevronRight size={17} /></button><button className="button-text" onClick={() => setViewDate(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)))}>Today</button></div>
        </div>
        <div className="company-filters"><button className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All companies</button>{companies.map(company => <button className={`filter-chip ${filter === company.id ? "active" : ""}`} key={company.id} onClick={() => setFilter(company.id)}><span className="company-swatch" style={{ background: company.color }} />{company.name}</button>)}<span className="post-summary">{range ? `${filteredPosts.length} posts in range` : `${monthPosts.length} posts this month`}{previousRangeCount !== null ? <span className="compare-hint"> · previous {previousRangeCount}</span> : null}</span></div>
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}
        <div className="calendar-frame"><div className="calendar-grid"><div className="weekday-row">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day}>{day}</div>)}</div><div className="days-grid">{calendarDays.map(day => {
          const key = day.toISOString().slice(0, 10);
          const dayPosts = postsByDate.get(key) || [];
          const inMonth = day.getUTCMonth() === viewDate.getUTCMonth();
          const inSelectedRange = !range || (key >= range.start && key <= range.end);
          return <div className={`day-cell ${inMonth ? "" : "outside-month"} ${key === todayKey ? "today" : ""} ${!inSelectedRange ? "outside-range" : ""}`} key={key} onDoubleClick={() => canCreate && openPost(key)}>
            <div className="day-cell-head"><span className="day-number">{day.getUTCDate()}</span>{canCreate && <button className="day-add" type="button" aria-label={`Add post on ${key}`} onClick={() => openPost(key)}><Plus size={14} /></button>}</div>
            <div className="day-events">{dayPosts.map(post => {
              const company = companies.find(item => item.id === post.company_id);
              return <article className="event-entry" key={post.id}><div className="event-card" style={{ "--event-color": company?.color || "#187052" } as React.CSSProperties}>{isAdmin ? <button className="event-edit" onClick={() => openPost(key, post)} aria-label={`Edit ${post.topic}`}><strong>{company?.name || "Company"}</strong><span>{post.platform}</span><span className="event-topic">{post.topic}</span></button> : <div className="event-readonly"><strong>{company?.name || "Company"}</strong><span>{post.platform}</span><span className="event-topic">{post.topic}</span></div>}</div>{post.published_url && <a className="published-link" href={post.published_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> View post</a>}</article>;
            })}</div>
          </div>;
        })}</div></div></div>
        <footer className="calendar-footer"><span><i className="company-swatch" style={{ background: "#d77858" }} />Companies use their own color</span><span>{role === "admin" ? "Admin access · manage posts, companies, and teammates" : role === "contributor" ? "Contributor access · add new posts" : "Viewer access · read-only calendar"}</span></footer>
      </section>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-heading"><div><span className="eyebrow">PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17} /></button></div><div className="setting-line"><div><strong>Appearance</strong><span>Choose how the calendar looks on this device.</span></div><button className="theme-toggle" role="switch" aria-checked={theme === "dark"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}{theme === "dark" ? "Dark" : "Light"}</button></div><div className="setting-line"><div><strong>Signed in as</strong><span>{userEmail}</span></div><span className={`role-chip role-${role}`}>{roleNames[role]}</span></div><p className="settings-note">Team roles are enforced by Supabase Row Level Security on every database request.</p><div className="modal-actions"><button className="button-secondary" onClick={signOut}><LogOut size={14} /> Sign out</button><button className="button-primary" onClick={() => setSettingsOpen(false)}>Done</button></div></section></div>}

      {postDialogOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPostDialogOpen(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="post-dialog-title"><div className="modal-heading"><div><span className="eyebrow">{editingPost ? "SCHEDULED CONTENT" : "NEW CONTENT"}</span><h2 id="post-dialog-title">{editingPost ? "Edit post" : "Schedule a post"}</h2></div><button className="icon-button" aria-label="Close post editor" onClick={() => setPostDialogOpen(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={savePost}><label>Scheduled date<input type="date" required value={postDate} onChange={event => setPostDate(event.target.value)} /></label><label>Company<select required value={postCompany} onChange={event => setPostCompany(event.target.value)}>{companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label><label>Platform<select value={postPlatform} onChange={event => setPostPlatform(event.target.value)}>{platforms.map(platform => <option key={platform}>{platform}</option>)}</select></label><label>Post topic<input required maxLength={200} value={postTopic} onChange={event => setPostTopic(event.target.value)} placeholder="What are you sharing?" /></label><label>Published post URL <span className="optional-label">Optional</span><input type="url" inputMode="url" value={postUrl} onChange={event => setPostUrl(event.target.value)} placeholder="https://…" /></label>{notice && <p className="form-message" role="alert">{notice}</p>}<div className="modal-actions">{editingPost && isAdmin && <button className="button-danger" type="button" disabled={busy} onClick={deletePost}>Delete</button>}<span className="action-spacer" /><button className="button-secondary" type="button" onClick={() => setPostDialogOpen(false)}>Cancel</button><button className="button-primary" type="submit" disabled={busy || companies.length === 0}>{busy ? "Saving…" : "Save post"}</button></div></form></section></div>}

      {companiesOpen && isAdmin && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCompaniesOpen(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="companies-title"><div className="modal-heading"><div><span className="eyebrow">WORKSPACE SETTINGS</span><h2 id="companies-title">Companies</h2></div><button className="icon-button" aria-label="Close companies" onClick={() => setCompaniesOpen(false)}><X size={17} /></button></div><form className="company-form" onSubmit={addCompany}><label>Company name<input required maxLength={50} value={newCompany} onChange={event => setNewCompany(event.target.value)} placeholder="Company name" /></label><label className="color-field">Color<input type="color" value={newCompanyColor} onChange={event => setNewCompanyColor(event.target.value)} aria-label="Company color" /></label><button className="button-primary" disabled={busy}><Plus size={15} /> Add company</button></form><div className="management-list">{companies.map(company => <div className="management-row" key={company.id}><span className="company-swatch" style={{ background: company.color }} /><strong>{company.name}</strong><span className="row-detail">{posts.filter(post => post.company_id === company.id).length} posts</span><button className="button-danger" onClick={() => removeCompany(company.id)} disabled={busy}>{pendingCompanyRemoval === company.id ? "Confirm remove" : "Remove"}</button>{pendingCompanyRemoval === company.id && <button className="button-text" onClick={() => setPendingCompanyRemoval("")}>Cancel</button>}</div>)}</div><p className="settings-note">Removing a company also deletes its posts. Confirm to proceed.</p><div className="modal-actions"><span className="action-spacer" /><button className="button-primary" onClick={() => setCompaniesOpen(false)}>Done</button></div></section></div>}

      {teamOpen && isAdmin && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setTeamOpen(false); }}><section className="modal-card team-card" role="dialog" aria-modal="true" aria-labelledby="team-title"><div className="modal-heading"><div><span className="eyebrow">WORKSPACE ACCESS</span><h2 id="team-title">Team access</h2></div><button className="icon-button" aria-label="Close team access" onClick={() => setTeamOpen(false)}><X size={17} /></button></div><p className="modal-intro">Invite teammates by email. They choose their own password after confirming the address.</p><form className="invite-form" onSubmit={inviteTeammate}><label>Email<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="teammate@company.com" /></label><label>Access<select value={inviteRole} onChange={event => setInviteRole(event.target.value as WorkspaceRole)}><option value="viewer">Viewer · read only</option><option value="contributor">Contributor · add posts</option><option value="admin">Admin · full access</option></select></label><button className="button-primary" disabled={busy}><Plus size={15} /> Create invite</button></form>{inviteUrl && <div className="invite-link-box"><div><strong>Share this invitation link</strong><span>{inviteUrl}</span></div><button className="button-secondary" onClick={copyInvite}><Clipboard size={14} />{copied ? "Copied" : "Copy"}</button></div>}{notice && <p className="inline-notice" role="status">{notice}</p>}<h3 className="section-label">Members</h3><div className="management-list">{members.map(member => <div className="management-row member-row" key={member.user_id}><span className="avatar-small">{(member.email || "?").slice(0, 1).toUpperCase()}</span><span className="member-identity"><strong>{member.email || "Workspace member"}</strong><small>{member.user_id === currentUserId ? "You" : roleNames[member.role]}</small></span>{member.user_id === currentUserId ? <span className={`role-chip role-${member.role}`}>You · {roleNames[member.role]}</span> : <><select aria-label={`Access for ${member.email || "teammate"}`} className="member-role-select" value={member.role} onChange={event => updateMember(member, event.target.value as WorkspaceRole)} disabled={busy}>{(["admin", "contributor", "viewer"] as WorkspaceRole[]).map(value => <option value={value} key={value}>{roleNames[value]}</option>)}</select><button className="button-danger" onClick={() => removeMember(member)} disabled={busy}>{pendingMemberRemoval === member.user_id ? "Confirm" : "Remove"}</button>{pendingMemberRemoval === member.user_id && <button className="button-text" onClick={() => setPendingMemberRemoval("")}>Cancel</button>}</>}</div>)}</div>{invitations.length > 0 && <><h3 className="section-label">Pending invitations</h3><div className="management-list">{invitations.map(invitation => <div className="management-row" key={invitation.id}><span className="pending-dot" /><strong>{invitation.email}</strong><span className="role-chip">{roleNames[invitation.role]}</span><span className="row-detail">Expires {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(invitation.expires_at))}</span><button className="button-danger" onClick={() => revokeInvitation(invitation)} disabled={busy}>{pendingInvitationRemoval === invitation.id ? "Confirm revoke" : "Revoke"}</button>{pendingInvitationRemoval === invitation.id && <button className="button-text" onClick={() => setPendingInvitationRemoval("")}>Cancel</button>}</div>)}</div></>}<div className="modal-actions"><span className="action-spacer" /><button className="button-primary" onClick={() => setTeamOpen(false)}>Done</button></div></section></div>}
    </main>
  );
}
