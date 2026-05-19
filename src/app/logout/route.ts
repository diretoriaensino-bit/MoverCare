import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("success", "Você saiu do sistema com segurança.");

  return NextResponse.redirect(loginUrl);
}