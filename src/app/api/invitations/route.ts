import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-security";

const validRoles = new Set(["admin", "contributor", "viewer"]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { workspaceId?: unknown; email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { workspaceId, email, role } = body;
  if (typeof workspaceId !== "string" || typeof email !== "string" || typeof role !== "string") {
    return NextResponse.json({ error: "Workspace, email, and access level are required." }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!validRoles.has(role)) return NextResponse.json({ error: "Invalid access level." }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return NextResponse.json({ error: "Set NEXT_PUBLIC_SITE_URL before creating invitations." }, { status: 503 });
  let baseUrl: URL;
  try {
    baseUrl = new URL(siteUrl);
    if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") throw new Error();
  } catch {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL must be a valid HTTPS URL in production." }, { status: 503 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("create_workspace_invitation", {
    p_workspace_id: workspaceId,
    p_email: normalizedEmail,
    p_role: role,
    p_token_hash: tokenHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const inviteUrl = new URL(`/invite/${token}`, baseUrl).toString();
  return NextResponse.json({ inviteUrl, expiresInDays: 7 }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { workspaceId?: unknown; invitationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.workspaceId !== "string" || typeof body.invitationId !== "string") {
    return NextResponse.json({ error: "Workspace and invitation are required." }, { status: 400 });
  }
  const { error } = await supabase.rpc("revoke_workspace_invitation", {
    p_workspace_id: body.workspaceId,
    p_invitation_id: body.invitationId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
