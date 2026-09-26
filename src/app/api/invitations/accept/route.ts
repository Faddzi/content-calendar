import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to accept this invitation." }, { status: 401 });

  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invitation", { p_token_hash: tokenHash });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ workspaceId }, { headers: { "Cache-Control": "no-store" } });
}
