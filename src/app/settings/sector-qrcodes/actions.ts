"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithMessage(type: "success" | "error", message: string) {
  redirect(`/settings/sector-qrcodes?${type}=${encodeURIComponent(message)}`);
}

export async function generateMissingSectorQRCodesAction() {
  const profile = await getCurrentProfile();

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirectWithMessage(
      "error",
      "Apenas gestor ou administrador pode gerar QR Codes."
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generate_missing_sector_qrcodes");

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings/sector-qrcodes");

  const generated = data?.generated ?? 0;

  redirectWithMessage(
    "success",
    `QR Codes gerados com sucesso. Setores atualizados: ${generated}.`
  );
}