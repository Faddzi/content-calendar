import { AuthPanel } from "@/components/AuthPanel";
import { CalendarWorkspace } from "@/components/CalendarWorkspace";
import { WorkspaceSetup } from "@/components/WorkspaceSetup";
import { createClient } from "@/lib/supabase/server";
import type { CalendarPost, Company, Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "@/lib/types";

type PageProps = { searchParams: Promise<{ workspace?: string; error?: string }> };

export default async function Home({ searchParams }: PageProps) {
  const envReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!envReady) {
    return <main className="config-screen"><span className="brand-mark">Calday</span><span className="eyebrow">ONE-TIME SETUP</span><h1>Connect your Supabase project.</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase project URL and publishable key, then apply the database migration.</p></main>;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <AuthPanel initialError={params.error ? "Your sign-in link could not be verified. Request a fresh link or sign in again." : ""} />;

  const { data: memberships, error: memberError } = await supabase.from("workspace_members").select("workspace_id, role, created_at").order("created_at", { ascending: true });
  if (memberError) return <main className="config-screen"><span className="eyebrow">WORKSPACE DATA</span><h1>Could not load your access.</h1><p>{memberError.message}</p><p>Confirm that the Supabase migration has been applied to this project.</p></main>;
  if (!memberships?.length) return <WorkspaceSetup email={user.email || ""} />;

  const workspaceIds = memberships.map(item => item.workspace_id as string);
  const { data: workspaces, error: workspaceError } = await supabase.from("workspaces").select("id, name").in("id", workspaceIds).order("created_at", { ascending: true });
  if (workspaceError || !workspaces?.length) return <main className="config-screen"><span className="eyebrow">WORKSPACE DATA</span><h1>Could not load your workspace.</h1><p>{workspaceError?.message || "No workspace is available for this account."}</p></main>;

  const selectedWorkspace = workspaces.find(item => item.id === params.workspace) || workspaces[0];
  const membership = memberships.find(item => item.workspace_id === selectedWorkspace.id);
  const role = membership?.role as WorkspaceRole;
  const [{ data: companies }, { data: posts }, { data: memberRows }, invitationResult] = await Promise.all([
    supabase.from("companies").select("id, workspace_id, name, color").eq("workspace_id", selectedWorkspace.id).order("created_at", { ascending: true }),
    supabase.from("calendar_posts").select("id, workspace_id, company_id, platform, topic, scheduled_for, published_url, created_by").eq("workspace_id", selectedWorkspace.id).order("scheduled_for", { ascending: true }).limit(1000),
    supabase.from("workspace_members").select("workspace_id, user_id, role, profiles(email, display_name)").eq("workspace_id", selectedWorkspace.id).order("created_at", { ascending: true }),
    role === "admin" ? supabase.from("workspace_invitations").select("id, workspace_id, email, role, expires_at").eq("workspace_id", selectedWorkspace.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as WorkspaceInvitation[] }),
  ]);

  const hydratedMembers = (memberRows || []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { workspace_id: row.workspace_id, user_id: row.user_id, role: row.role as WorkspaceRole, email: profile?.email || null } satisfies WorkspaceMember;
  });

  return <CalendarWorkspace
    userEmail={user.email || ""}
    currentUserId={user.id}
    role={role}
    workspace={selectedWorkspace as Workspace}
    workspaces={workspaces as Workspace[]}
    companies={(companies || []) as Company[]}
    posts={(posts || []) as CalendarPost[]}
    members={hydratedMembers}
    invitations={(invitationResult.data || []) as WorkspaceInvitation[]}
  />;
}
