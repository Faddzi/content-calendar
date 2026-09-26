import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-security";

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { workspaceId?: unknown; userId?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { workspaceId, userId, role } = body;
  if (typeof workspaceId !== "string" || typeof userId !== "string" || !["admin", "contributor", "viewer"].includes(String(role))) {
    return NextResponse.json({ error: "Workspace, teammate, and a valid role are required." }, { status: 400 });
  }
  const { error } = await supabase.rpc("update_workspace_member_role", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { workspaceId?: unknown; userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { workspaceId, userId } = body;
  if (typeof workspaceId !== "string" || typeof userId !== "string") {
    return NextResponse.json({ error: "Workspace and teammate are required." }, { status: 400 });
  }
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
