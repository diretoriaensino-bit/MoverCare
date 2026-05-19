"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type RequestedRole = "nurse" | "stretcher_bearer";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(`/register?${type}=${encodeURIComponent(message)}`);
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase();
}

function isValidRequestedRole(value: string): value is RequestedRole {
  return value === "nurse" || value === "stretcher_bearer";
}

export async function requestAccessAction(formData: FormData) {
  const fullName = String(formData.get("full_name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  const requestedRole = String(formData.get("requested_role") || "");
  const accessCode = normalizeAccessCode(String(formData.get("access_code") || ""));
  const requestMessage = String(formData.get("request_message") || "").trim();

  if (!fullName) {
    redirectWithMessage("error", "Informe seu nome completo.");
  }

  if (!email || !email.includes("@")) {
    redirectWithMessage("error", "Informe um e-mail válido.");
  }

  if (password.length < 6) {
    redirectWithMessage("error", "A senha precisa ter pelo menos 6 caracteres.");
  }

  if (!isValidRequestedRole(requestedRole)) {
    redirectWithMessage("error", "Selecione uma função válida.");
  }

  if (!accessCode) {
    redirectWithMessage("error", "Informe o código de convite do hospital.");
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: hospital, error: hospitalError } = await supabaseAdmin
    .from("hospitals")
    .select("id, name, access_code")
    .eq("access_code", accessCode)
    .single();

  if (hospitalError || !hospital) {
    redirectWithMessage("error", "Código de convite inválido.");
  }

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    redirectWithMessage(
      "error",
      "Já existe um usuário cadastrado com este e-mail."
    );
  }

  const { data: pendingRequest } = await supabaseAdmin
    .from("access_requests")
    .select("id, status")
    .eq("email", email)
    .eq("hospital_id", hospital.id)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingRequest) {
    redirectWithMessage(
      "error",
      "Já existe uma solicitação pendente para este e-mail."
    );
  }

  const { data: createdUser, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        requested_role: requestedRole,
        hospital_id: hospital.id
      }
    });

  if (createUserError || !createdUser.user) {
    redirectWithMessage(
      "error",
      createUserError?.message || "Não foi possível criar o usuário."
    );
  }

  const authUserId = createdUser.user.id;

  const { data: createdProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      user_id: authUserId,
      hospital_id: hospital.id,
      name: fullName,
      email,
      role: requestedRole,
      active: false
    })
    .select("id")
    .single();

  if (profileError || !createdProfile) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    redirectWithMessage(
      "error",
      profileError?.message || "Não foi possível criar o perfil do usuário."
    );
  }

  const { error: requestError } = await supabaseAdmin
    .from("access_requests")
    .insert({
      hospital_id: hospital.id,
      user_id: authUserId,
      profile_id: createdProfile.id,
      full_name: fullName,
      email,
      requested_role: requestedRole,
      status: "pending",
      request_message: requestMessage || null
    });

  if (requestError) {
    await supabaseAdmin.from("profiles").delete().eq("id", createdProfile.id);
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    redirectWithMessage(
      "error",
      requestError.message || "Não foi possível criar a solicitação."
    );
  }

  redirectWithMessage(
    "success",
    "Solicitação enviada com sucesso. Aguarde a aprovação do gestor."
  );
}