"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

const allowedPriority = ["normal", "urgent"];

const allowedTransportReason = [
  "exam",
  "procedure",
  "surgery",
  "bed_transfer",
  "interclinic_transfer",
  "hospital_discharge",
  "external_activity",
  "other"
];

const allowedRiskClassification = ["low", "medium", "high"];

const allowedPrecautionType = [
  "standard",
  "contact",
  "droplet",
  "aerosol",
  "reverse"
];

const allowedLegacyEquipment = [
  "wheelchair",
  "stretcher",
  "oxygen",
  "monitor",
  "isolation"
];

const allowedRequiredEquipment = [
  "wheelchair",
  "stretcher",
  "oxygen",
  "oxygen_cylinder",
  "monitor",
  "pulse_oximeter",
  "infusion_pump",
  "transport_ventilator",
  "transport_kit",
  "suction",
  "ppe",
  "isolation",
  "other"
];

const allowedRequiredTeam = [
  "nursing_technician",
  "nurse",
  "physician",
  "physiotherapist",
  "stretcher_bearer",
  "cleaning_team",
  "destination_team"
];

const allowedInvasiveDevices = [
  "sng",
  "sne",
  "svd",
  "dpt",
  "tot_tqt",
  "khr",
  "drain",
  "dve",
  "pai",
  "central_venous_access",
  "peripheral_venous_access",
  "dialysis_catheter",
  "other"
];

const allowedDocuments = [
  "medical_record",
  "daily_prescription",
  "laboratory_tests",
  "ct_scan",
  "surgical_description",
  "identification_bracelet",
  "other"
];

function redirectWithError(message: string): never {
  redirect(`/nurse/new-request?error=${encodeURIComponent(message)}`);
}

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getAllowedArray(
  formData: FormData,
  field: string,
  allowedValues: string[]
) {
  return formData
    .getAll(field)
    .map((item) => String(item))
    .filter((item) => allowedValues.includes(item));
}

export async function createTransportRequest(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const patientCode = getText(formData, "patient_code");
  const bedNumber = getText(formData, "bed_number");
  const originSectorId = getText(formData, "origin_sector_id");
  const destinationSectorId = getText(formData, "destination_sector_id");
  const priority = getText(formData, "priority") || "normal";
  const notes = getText(formData, "notes");

  const transportReason = getText(formData, "transport_reason");
  const riskClassification = getText(formData, "risk_classification");
  const precautionType = getText(formData, "precaution_type");
  const clinicalObservations = getText(formData, "clinical_observations");

  const requiredTeam = getAllowedArray(
    formData,
    "required_team",
    allowedRequiredTeam
  );

  const requiredEquipment = getAllowedArray(
    formData,
    "required_equipment",
    allowedRequiredEquipment
  );

  const invasiveDevices = getAllowedArray(
    formData,
    "invasive_devices",
    allowedInvasiveDevices
  );

  const documentsRequired = getAllowedArray(
    formData,
    "documents_required",
    allowedDocuments
  );

  const continuousMedications = formData
    .getAll("continuous_medications")
    .map((item) => String(item).trim())
    .filter(Boolean);

  const destinationContactConfirmed =
    String(formData.get("destination_contact_confirmed") ?? "") === "true";

  const legacyEquipmentRequired = requiredEquipment.filter((item) =>
    allowedLegacyEquipment.includes(item)
  );

  if (!patientCode) {
    redirectWithError("Informe o código do paciente.");
  }

  if (!originSectorId) {
    redirectWithError("Selecione o setor de origem.");
  }

  if (!destinationSectorId) {
    redirectWithError("Selecione o setor de destino.");
  }

  if (originSectorId === destinationSectorId) {
    redirectWithError("Origem e destino não podem ser iguais.");
  }

  if (!allowedPriority.includes(priority)) {
    redirectWithError("Prioridade inválida.");
  }

  if (!allowedTransportReason.includes(transportReason)) {
    redirectWithError("Selecione o motivo do transporte.");
  }

  if (!allowedRiskClassification.includes(riskClassification)) {
    redirectWithError("Selecione a classificação de risco.");
  }

  if (!allowedPrecautionType.includes(precautionType)) {
    redirectWithError("Selecione o tipo de precaução/isolamento.");
  }

  if (requiredTeam.length === 0) {
    redirectWithError("Selecione pelo menos um profissional/equipe necessária.");
  }

  if (requiredEquipment.length === 0) {
    redirectWithError("Selecione pelo menos um equipamento obrigatório.");
  }

  if (!destinationContactConfirmed) {
    redirectWithError(
      "Confirme que houve contato ou ciência do setor de destino."
    );
  }

  const { error } = await supabase.from("transports").insert({
    hospital_id: profile.hospital_id,
    patient_code: patientCode,
    bed_number: bedNumber || null,
    origin_sector_id: originSectorId,
    destination_sector_id: destinationSectorId,
    requested_by: profile.id,
    assigned_to: null,
    priority,
    status: "pending",

    equipment_required: legacyEquipmentRequired,
    notes: notes || null,

    transport_reason: transportReason,
    risk_classification: riskClassification,
    precaution_type: precautionType,
    required_team: requiredTeam,
    required_equipment: requiredEquipment,
    invasive_devices: invasiveDevices,
    continuous_medications: continuousMedications,
    documents_required: documentsRequired,
    destination_contact_confirmed: destinationContactConfirmed,
    clinical_observations: clinicalObservations || null
  });

  if (error) {
    redirectWithError(`Erro ao criar requisição: ${error.message}`);
  }

  revalidatePath("/nurse");
  revalidatePath("/nurse/new-request");
  revalidatePath("/manager");
  revalidatePath("/transports");
  revalidatePath("/reports/sla-alerts");

  redirect(
    "/nurse/new-request?success=Requisição criada com sucesso. O chamado já está pendente para atendimento."
  );
}