import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let name: unknown;
  try {
    ({ name } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
    return NextResponse.json({ error: "Workspace name must be 2-80 characters." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_workspace_for_current_user", { p_name: name.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ workspaceId: data }, { status: 201 });
}
