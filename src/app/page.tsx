import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getRedirectPathByRole(role: string) {
  const paths: Record<string, string> = {
    nurse: "/nurse",
    stretcher_bearer: "/stretcher-bearer",
    manager: "/manager",
    admin: "/admin"
  };

  return paths[role] ?? "/login";
}

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("user_id", user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();

    redirect(
      "/login?error=Perfil não encontrado no MoverCare. Solicite acesso ou fale com o gestor."
    );
  }

  if (!profile.active) {
    await supabase.auth.signOut();

    redirect(
      "/login?error=Seu acesso ainda não está liberado. Aguarde a aprovação do gestor."
    );
  }

  redirect(getRedirectPathByRole(profile.role));
}