"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(`/settings/users/requests?${type}=${encodeURIComponent(message)}`);
}

function assertCanManageUsers(role: string) {
  if (role !== "manager" && role !== "admin") {
    redirectWithMessage(
      "error",
      "Apenas gestor ou administrador pode analisar solicitações."
    );
  }
}

export async function approveAccessRequestAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageUsers(profile.role);

  const requestId = String(formData.get("request_id") || "").trim();

  if (!requestId) {
    redirectWithMessage("error", "Solicitação inválida.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_access_request_admin", {
    p_request_id: requestId
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings/users/requests");
  revalidatePath("/settings/users");
  revalidatePath("/settings");
  revalidatePath("/manager");

  redirectWithMessage("success", "Solicitação aprovada com sucesso.");
}

export async function rejectAccessRequestAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageUsers(profile.role);

  const requestId = String(formData.get("request_id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!requestId) {
    redirectWithMessage("error", "Solicitação inválida.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_access_request_admin", {
    p_request_id: requestId,
    p_reason: reason || null
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings/users/requests");
  revalidatePath("/settings/users");
  revalidatePath("/settings");
  revalidatePath("/manager");

  redirectWithMessage("success", "Solicitação recusada com sucesso.");
}

export async function regenerateHospitalAccessCodeAction(_formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageUsers(profile.role);

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "regenerate_hospital_access_code_admin"
  );

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings/users/requests");
  revalidatePath("/settings/users");
  revalidatePath("/settings");

  redirectWithMessage("success", "Novo código de convite gerado com sucesso.");
}