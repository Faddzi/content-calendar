import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/?error=auth_callback", request.url));
  } else if (tokenHash && ["signup", "invite", "recovery", "email_change", "email"].includes(rawType || "")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as "signup" | "invite" | "recovery" | "email_change" | "email" });
    if (error) return NextResponse.redirect(new URL("/?error=auth_callback", request.url));
  } else {
    return NextResponse.redirect(new URL("/?error=auth_callback", request.url));
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
