import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, hospital_id, name, email, role, active")
    .eq("user_id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login?error=Perfil não encontrado no MoverCare.");
  }

  if (!profile.active) {
    redirect("/login?error=Usuário inativo. Fale com o administrador.");
  }

  return profile;
}