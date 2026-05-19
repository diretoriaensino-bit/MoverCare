"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithError(message: string): never {
  redirect(`/stretcher-bearer?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/stretcher-bearer?success=${encodeURIComponent(message)}`);
}

async function getTransportForAction(transportId: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (profile.role !== "stretcher_bearer") {
    redirectWithError("Somente maqueiros podem executar esta ação.");
  }

  const { data: transport, error } = await supabase
    .from("transports")
    .select("id, hospital_id, status, assigned_to")
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

export async function acceptTransportFromPanel(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (transport.status !== "pending") {
    redirectWithError("Somente chamados pendentes podem ser aceitos.");
  }

  if (transport.assigned_to) {
    redirectWithError("Este chamado já foi aceito por outro maqueiro.");
  }

  const { error } = await supabase
    .from("transports")
    .update({
      status: "accepted",
      assigned_to: profile.id,
      accepted_at: new Date().toISOString()
    })
    .eq("id", transportId)
    .eq("status", "pending")
    .is("assigned_to", null);

  if (error) {
    redirectWithError(`Erro ao aceitar chamado: ${error.message}`);
  }

  revalidatePath("/stretcher-bearer");
  revalidatePath("/transports");

  redirectWithSuccess("Chamado aceito com sucesso.");
}

export async function startTransportFromPanel(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (transport.assigned_to !== profile.id) {
    redirectWithError("Você só pode iniciar transportes atribuídos a você.");
  }

  if (transport.status !== "accepted") {
    redirectWithError("Somente transportes aceitos podem ser iniciados.");
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

  revalidatePath("/stretcher-bearer");
  revalidatePath("/transports");

  redirectWithSuccess("Transporte iniciado com sucesso.");
}

export async function completeTransportFromPanel(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

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

  revalidatePath("/stretcher-bearer");
  revalidatePath("/transports");
  revalidatePath("/manager");
  revalidatePath("/reports");

  redirectWithSuccess("Transporte concluído com sucesso.");
}

export async function reportFailureFromPanel(formData: FormData) {
  const transportId = String(formData.get("transport_id") ?? "").trim();
  const reason = String(formData.get("failure_reason") ?? "").trim();

  if (!transportId) {
    redirectWithError("Chamado inválido.");
  }

  if (!reason) {
    redirectWithError("Informe o motivo da falha.");
  }

  const { supabase, profile, transport } = await getTransportForAction(
    transportId
  );

  if (transport.assigned_to !== profile.id) {
    redirectWithError("Você só pode reportar falha em transportes atribuídos a você.");
  }

  if (!["accepted", "in_transit"].includes(transport.status)) {
    redirectWithError("Este transporte não permite registro de falha neste status.");
  }

  const { error: updateError } = await supabase
    .from("transports")
    .update({
      status: "failed"
    })
    .eq("id", transportId);

  if (updateError) {
    redirectWithError(`Erro ao registrar falha: ${updateError.message}`);
  }

  await supabase.rpc("register_transport_log", {
    p_transport_id: transportId,
    p_action: "failure_reason_registered",
    p_metadata: {
      reason,
      reported_by: profile.id
    }
  });

  revalidatePath("/stretcher-bearer");
  revalidatePath("/transports");
  revalidatePath("/manager");
  revalidatePath("/reports");

  redirectWithSuccess("Falha registrada com sucesso.");
}