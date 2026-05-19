"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithError(message: string): never {
  redirect(`/transports?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/transports?success=${encodeURIComponent(message)}`);
}

async function getTransportForAction(transportId: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: transport, error } = await supabase
    .from("transports")
    .select("id, hospital_id, status, assigned_to, requested_by")
    .eq("id", transportId)
    .single();

  if (error || !transport) {
    redirectWithError("Chamado não encontrado.");
  }

  if (transport.hospital_id !== profile.hospital_id) {
    redirectWithError("Você não pode acessar chamados de outro hospital.");
  }

  return {
    supabase,
    profile,
    transport
  };
}

export async function acceptTransport(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (profile.role !== "stretcher_bearer") {
    redirectWithError("Somente maqueiros podem aceitar chamados.");
  }

  if (transport.status !== "pending") {
    redirectWithError("Somente chamados pendentes podem ser aceitos.");
  }

  if (transport.assigned_to) {
    redirectWithError("Este chamado já foi atribuído a um maqueiro.");
  }

  const { error } = await supabase
    .from("transports")
    .update({
      status: "accepted",
      assigned_to: profile.id,
      accepted_at: new Date().toISOString()
    })
    .eq("id", transportId);

  if (error) {
    redirectWithError(`Erro ao aceitar chamado: ${error.message}`);
  }

  revalidatePath("/transports");
  redirectWithSuccess("Chamado aceito com sucesso.");
}

export async function startTransport(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (profile.role !== "stretcher_bearer") {
    redirectWithError("Somente maqueiros podem iniciar transportes.");
  }

  if (transport.assigned_to !== profile.id) {
    redirectWithError("Você só pode iniciar transportes atribuídos a você.");
  }

  if (transport.status !== "accepted") {
    redirectWithError("Somente chamados aceitos podem ser iniciados.");
  }

  const { error } = await supabase
    .from("transports")
    .update({
      status: "in_transit",
      started_at: new Date().toISOString()
    })
    .eq("id", transportId);

  if (error) {
    redirectWithError(`Erro ao iniciar transporte: ${error.message}`);
  }

  revalidatePath("/transports");
  redirectWithSuccess("Transporte iniciado com sucesso.");
}

export async function completeTransport(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (profile.role !== "stretcher_bearer") {
    redirectWithError("Somente maqueiros podem concluir transportes.");
  }

  if (transport.assigned_to !== profile.id) {
    redirectWithError("Você só pode concluir transportes atribuídos a você.");
  }

  if (transport.status !== "in_transit") {
    redirectWithError("Somente transportes em trânsito podem ser concluídos.");
  }

  const { error } = await supabase
    .from("transports")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", transportId);

  if (error) {
    redirectWithError(`Erro ao concluir transporte: ${error.message}`);
  }

  revalidatePath("/transports");
  redirectWithSuccess("Transporte concluído com sucesso.");
}

export async function cancelTransport(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  const canCancel =
    profile.role === "manager" ||
    profile.role === "admin" ||
    (profile.role === "nurse" && transport.requested_by === profile.id);

  if (!canCancel) {
    redirectWithError("Você não tem permissão para cancelar este chamado.");
  }

  if (!["pending", "accepted", "in_transit"].includes(transport.status)) {
    redirectWithError("Este chamado não pode mais ser cancelado.");
  }

  const { error } = await supabase
    .from("transports")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString()
    })
    .eq("id", transportId);

  if (error) {
    redirectWithError(`Erro ao cancelar chamado: ${error.message}`);
  }

  revalidatePath("/transports");
  redirectWithSuccess("Chamado cancelado com sucesso.");
}