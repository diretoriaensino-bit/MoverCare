"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type WebAccessStatus = {
  allowed: boolean;
  status?: string;
  message?: string;
  role?: string;
};

function redirectWithError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function getRedirectPathByRole(role: string) {
  const paths: Record<string, string> = {
    nurse: "/nurse",
    stretcher_bearer: "/stretcher-bearer",
    manager: "/manager",
    admin: "/admin"
  };

  return paths[role] ?? "/";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirectWithError("Informe e-mail e senha.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    redirectWithError("E-mail ou senha inválidos.");
  }

  const { data: accessData, error: accessError } = await supabase.rpc(
    "get_my_web_access_status"
  );

  if (accessError || !accessData) {
    await supabase.auth.signOut();

    redirectWithError(
      "Não foi possível verificar seu acesso agora. Tente novamente em instantes."
    );
  }

  const accessStatus = accessData as WebAccessStatus;

  if (!accessStatus.allowed) {
    await supabase.auth.signOut();

    redirectWithError(
      accessStatus.message ||
        "Seu acesso ainda não está liberado. Aguarde a aprovação do gestor."
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("user_id", data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    redirectWithError("Usuário autenticado, mas sem perfil no MoverCare.");
  }

  if (!profile.active) {
    await supabase.auth.signOut();

    redirectWithError(
      "Seu acesso ainda não está liberado. Aguarde a aprovação do gestor."
    );
  }

  revalidatePath("/", "layout");
redirect(getRedirectPathByRole(profile.role));
}