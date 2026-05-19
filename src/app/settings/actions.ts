"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(`/settings?${type}=${encodeURIComponent(message)}`);
}

function assertCanManageSettings(role: string) {
  if (role !== "manager" && role !== "admin") {
    redirectWithMessage(
      "error",
      "Apenas gestor ou administrador pode gerenciar configurações."
    );
  }
}

export async function createSectorAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const name = String(formData.get("name") || "").trim();
  const floor = String(formData.get("floor") || "").trim();

  if (!name) {
    redirectWithMessage("error", "Informe o nome do setor.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_sector_admin", {
    p_name: name,
    p_floor: floor || null
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/sector-qrcodes");
  revalidatePath("/settings/audit");
  revalidatePath("/nurse/new-request");

  redirectWithMessage("success", "Setor cadastrado com sucesso.");
}

export async function updateSectorAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const sectorId = String(formData.get("sector_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const floor = String(formData.get("floor") || "").trim();

  if (!sectorId) {
    redirectWithMessage("error", "Setor inválido.");
  }

  if (!name) {
    redirectWithMessage("error", "Informe o nome do setor.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_sector_admin", {
    p_sector_id: sectorId,
    p_name: name,
    p_floor: floor || null
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/sector-qrcodes");
  revalidatePath("/settings/audit");
  revalidatePath("/nurse/new-request");

  redirectWithMessage("success", "Setor atualizado com sucesso.");
}

export async function regenerateSectorQRCodeAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const sectorId = String(formData.get("sector_id") || "").trim();

  if (!sectorId) {
    redirectWithMessage("error", "Setor inválido.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("regenerate_sector_qrcode_admin", {
    p_sector_id: sectorId
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/sector-qrcodes");
  revalidatePath("/settings/audit");

  redirectWithMessage("success", "Novo QR Code gerado para o setor.");
}

export async function toggleSectorActiveAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const sectorId = String(formData.get("sector_id") || "").trim();
  const nextActiveValue = String(formData.get("next_active") || "");

  if (!sectorId) {
    redirectWithMessage("error", "Setor inválido.");
  }

  const active = nextActiveValue === "true";

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_sector_active_admin", {
    p_sector_id: sectorId,
    p_active: active
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/sector-qrcodes");
  revalidatePath("/settings/audit");
  revalidatePath("/nurse/new-request");

  redirectWithMessage(
    "success",
    active ? "Setor ativado com sucesso." : "Setor inativado com sucesso."
  );
}

export async function updateUserRoleAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const profileId = String(formData.get("profile_id") || "").trim();
  const newRole = String(formData.get("role") || "").trim();

  const allowedRoles = ["nurse", "stretcher_bearer", "manager", "admin"];

  if (!profileId) {
    redirectWithMessage("error", "Usuário inválido.");
  }

  if (!allowedRoles.includes(newRole)) {
    redirectWithMessage("error", "Perfil inválido.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_user_role_admin", {
    p_profile_id: profileId,
    p_new_role: newRole
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/users");
  revalidatePath("/settings/audit");

  redirectWithMessage("success", "Perfil do usuário atualizado com sucesso.");
}

export async function toggleUserActiveAction(formData: FormData) {
  const profile = await getCurrentProfile();

  assertCanManageSettings(profile.role);

  const profileId = String(formData.get("profile_id") || "").trim();
  const nextActiveValue = String(formData.get("next_active") || "");

  if (!profileId) {
    redirectWithMessage("error", "Usuário inválido.");
  }

  const active = nextActiveValue === "true";

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_user_active_admin", {
    p_profile_id: profileId,
    p_active: active
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/users");
  revalidatePath("/settings/audit");

  redirectWithMessage(
    "success",
    active ? "Usuário ativado com sucesso." : "Usuário inativado com sucesso."
  );
}