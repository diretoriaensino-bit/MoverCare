"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(`/settings/sla?${type}=${encodeURIComponent(message)}`);
}

function getPositiveInteger(value: FormDataEntryValue | null, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback;
  }

  return Math.round(numberValue);
}

export async function updateHospitalSlaSettingsAction(formData: FormData) {
  const acceptLimit = getPositiveInteger(formData.get("accept_limit"), 10);
  const startLimit = getPositiveInteger(formData.get("start_limit"), 15);
  const transportLimit = getPositiveInteger(formData.get("transport_limit"), 60);

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_hospital_sla_settings_admin", {
    p_accept_limit_minutes: acceptLimit,
    p_start_limit_minutes: startLimit,
    p_transport_limit_minutes: transportLimit
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings/sla");
  revalidatePath("/reports/sla-alerts");
  revalidatePath("/manager");

  redirectWithMessage(
    "success",
    "Configurações de SLA atualizadas com sucesso."
  );
}