import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransportsRefresh } from "@/components/realtime/realtime-transports-refresh";
import {
  acceptTransport,
  cancelTransport,
  completeTransport,
  startTransport
} from "../actions";
import TransportChatPanel from "@/components/transports/transport-chat-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransportDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SectorRelation = {
  id: string;
  name: string;
  floor: string | null;
  qr_code?: string | null;
};

type ProfileRelation = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
};

type TransportDetails = {
  id: string;
  hospital_id: string;
  patient_code: string;
  bed_number: string | null;
  priority: string;
  status: string;
  equipment_required: string[] | null;
  notes: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  requested_by: string;
  assigned_to: string | null;

  transport_reason: string | null;
  risk_classification: string | null;
  precaution_type: string | null;
  required_team: string[] | null;
  required_equipment: string[] | null;
  invasive_devices: string[] | null;
  continuous_medications: string[] | null;
  documents_required: string[] | null;
  destination_contact_confirmed: boolean | null;
  clinical_observations: string | null;

  origin: SectorRelation | SectorRelation[] | null;
  destination: SectorRelation | SectorRelation[] | null;
  requester: ProfileRelation | ProfileRelation[] | null;
  assignee: ProfileRelation | ProfileRelation[] | null;
};

type TransportLog = {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  user: ProfileRelation | ProfileRelation[] | null;
};

type TransportAuditLog = {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  in_transit: "Em trÃ¢nsito",
  completed: "ConcluÃ­do",
  cancelled: "Cancelado",
  failed: "Falhou"
};

const priorityLabels: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgente"
};

const transportReasonLabels: Record<string, string> = {
  exam: "RealizaÃ§Ã£o de exame",
  procedure: "Procedimento terapÃªutico",
  surgery: "Procedimento cirÃºrgico",
  bed_transfer: "TransferÃªncia de leito",
  interclinic_transfer: "TransferÃªncia interclÃ­nica",
  hospital_discharge: "Alta hospitalar",
  external_activity: "Atividade externa",
  other: "Outro"
};

const riskClassificationLabels: Record<string, string> = {
  low: "Baixo risco",
  medium: "MÃ©dio risco",
  high: "Alto risco"
};

const precautionTypeLabels: Record<string, string> = {
  standard: "PadrÃ£o",
  contact: "Contato",
  droplet: "GotÃ­culas",
  aerosol: "AerossÃ³is / respiratÃ³rio",
  reverse: "Reverso"
};

const requiredTeamLabels: Record<string, string> = {
  nursing_technician: "TÃ©cnico de enfermagem",
  nurse: "Enfermeiro",
  physician: "MÃ©dico",
  physiotherapist: "Fisioterapeuta",
  stretcher_bearer: "Maqueiro",
  cleaning_team: "HigienizaÃ§Ã£o / limpeza",
  destination_team: "Equipe do setor de destino"
};

const equipmentLabels: Record<string, string> = {
  wheelchair: "Cadeira de rodas",
  stretcher: "Maca",
  oxygen: "OxigÃªnio",
  oxygen_cylinder: "Cilindro de oxigÃªnio cheio",
  monitor: "Monitor cardÃ­aco / multiparamÃ©trico",
  pulse_oximeter: "OxÃ­metro de pulso",
  infusion_pump: "Bomba de infusÃ£o contÃ­nua",
  transport_ventilator: "Ventilador de transporte",
  transport_kit: "Maleta / kit de transporte",
  suction: "Aspirador / sonda de aspiraÃ§Ã£o",
  ppe: "EPIs conforme precauÃ§Ã£o",
  isolation: "Isolamento",
  other: "Outros"
};

const invasiveDeviceLabels: Record<string, string> = {
  sng: "SNG",
  sne: "SNE",
  svd: "SVD",
  dpt: "DPT",
  tot_tqt: "TOT / TQT",
  khr: "KHR",
  drain: "Dreno",
  dve: "DVE",
  pai: "PAI",
  central_venous_access: "Acesso venoso central",
  peripheral_venous_access: "Acesso venoso perifÃ©rico",
  dialysis_catheter: "Cateter para diÃ¡lise",
  other: "Outro"
};

const continuousMedicationLabels: Record<string, string> = {
  vasoactive_drug: "Droga vasoativa",
  sedation: "SedaÃ§Ã£o contÃ­nua",
  insulin: "Insulina contÃ­nua",
  antibiotic: "AntibiÃ³tico em infusÃ£o",
  other: "Outra infusÃ£o contÃ­nua"
};

const documentLabels: Record<string, string> = {
  medical_record: "ProntuÃ¡rio",
  daily_prescription: "PrescriÃ§Ã£o do dia",
  laboratory_tests: "Exames laboratoriais",
  ct_scan: "Tomografia / TC",
  surgical_description: "DescriÃ§Ã£o cirÃºrgica",
  identification_bracelet: "Pulseira de identificaÃ§Ã£o",
  other: "Outro"
};

const actionLabels: Record<string, string> = {
  transport_created: "Chamado criado",
  transport_accepted: "Chamado aceito",
  transport_started: "Transporte iniciado",
  transport_completed: "Transporte concluÃ­do",
  transport_cancelled: "Transporte cancelado",
  transport_failed: "Falha registrada",
  transport_status_changed: "Status alterado",
  transport_assignment_changed: "ResponsÃ¡vel alterado",
  origin_qr_validated: "Origem validada por QR Code",
  destination_qr_validated: "Destino validado por QR Code"
};

const auditActionLabels: Record<string, string> = {
  create_transport: "Transporte criado",
  accept_transport: "Transporte aceito",
  start_transport: "Transporte iniciado",
  complete_transport: "Transporte concluÃ­do",
  cancel_transport: "Transporte cancelado",
  fail_transport: "Transporte com falha",
  update_transport: "Transporte atualizado",
  update_transport_status: "Status alterado"
};

const roleLabels: Record<string, string> = {
  nurse: "Enfermeiro",
  stretcher_bearer: "Maqueiro",
  manager: "Gestor",
  admin: "Administrador"
};

function getFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "pending":
      return "border-[#f2b709]/40 bg-[#f2b709]/15 text-slate-900";

    case "accepted":
      return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";

    case "in_transit":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    case "failed":
      return "border-slate-200 bg-slate-100 text-slate-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getAuditActionBadgeClass(action: string) {
  if (
    action === "create_transport" ||
    action === "accept_transport" ||
    action === "start_transport"
  ) {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  if (action === "complete_transport") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (action === "cancel_transport" || action === "fail_transport") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getTimelineDotClass(action: string) {
  if (action === "complete_transport") {
    return "bg-emerald-600 ring-emerald-100";
  }

  if (action === "cancel_transport" || action === "fail_transport") {
    return "bg-red-600 ring-red-100";
  }

  if (action === "start_transport") {
    return "bg-[#f2b709] ring-[#f2b709]/20";
  }

  if (action === "accept_transport") {
    return "bg-[#009da8] ring-[#009da8]/15";
  }

  return "bg-slate-600 ring-slate-100";
}

function getPriorityBadgeClass(priority: string) {
  if (priority === "urgent") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[#009da8]/25 bg-[#009da8]/10 text-[#007983]";
}

function getRiskBadgeClass(risk: string | null) {
  if (risk === "high") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (risk === "medium") {
    return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
  }

  if (risk === "low") {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getPrecautionBadgeClass(precaution: string | null) {
  if (!precaution || precaution === "standard") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
}

function getRoleLabel(role: string | null | undefined) {
  if (!role) {
    return "NÃ£o informado";
  }

  return roleLabels[role] ?? role;
}

function getStatusLabel(status: string | null) {
  if (!status) {
    return "-";
  }

  return statusLabels[status] ?? status;
}

function getLabel(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback = "NÃ£o informado"
) {
  if (!value) {
    return fallback;
  }

  return labels[value] ?? value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatEquipment(equipment: string[] | null) {
  if (!equipment || equipment.length === 0) {
    return "Nenhum";
  }

  return equipment.map((item) => equipmentLabels[item] ?? item).join(", ");
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "Sem informaÃ§Ãµes adicionais";
  }

  return JSON.stringify(metadata, null, 2);
}

function canAcceptTransport(
  role: string,
  status: string,
  assignedTo: string | null
) {
  return role === "stretcher_bearer" && status === "pending" && !assignedTo;
}

function canStartTransport(
  role: string,
  status: string,
  assignedTo: string | null,
  profileId: string
) {
  return (
    role === "stretcher_bearer" &&
    status === "accepted" &&
    assignedTo === profileId
  );
}

function canCompleteTransport(
  role: string,
  status: string,
  assignedTo: string | null,
  profileId: string
) {
  return (
    role === "stretcher_bearer" &&
    status === "in_transit" &&
    assignedTo === profileId
  );
}

function canCancelTransport(
  role: string,
  status: string,
  requestedBy: string,
  profileId: string
) {
  const statusAllowsCancel = ["pending", "accepted", "in_transit"].includes(
    status
  );

  if (!statusAllowsCancel) {
    return false;
  }

  return role === "manager" || role === "admin" || requestedBy === profileId;
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-slate-900">
        {value || "NÃ£o informado"}
      </p>
    </div>
  );
}

function BadgeInfo({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <span
        className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${className}`}
      >
        {value}
      </span>
    </div>
  );
}

function TagList({
  title,
  values,
  labels,
  emptyText = "Nenhum item informado."
}: {
  title: string;
  values: string[] | null;
  labels: Record<string, string>;
  emptyText?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4">
      <h5 className="text-sm font-black text-slate-900">{title}</h5>

      {!values || values.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-[#009da8]/30 bg-white px-3 py-1 text-xs font-black text-[#007983]"
            >
              {labels[value] ?? value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionSubmitButton({
  children,
  variant = "primary"
}: {
  children: string;
  variant?: "primary" | "gold" | "success" | "danger";
}) {
  const className = {
    primary: "bg-[#009da8] text-white hover:brightness-95",
    gold: "bg-[#f2b709] text-slate-950 hover:brightness-95",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "bg-red-600 text-white hover:bg-red-700"
  }[variant];

  return (
    <button
      className={`w-full rounded-xl px-4 py-3 text-sm font-black transition ${className}`}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  description,
  children,
  badge
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-lg font-black text-slate-950">{title}</h4>

          {description ? (
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {badge ? (
          <span className="w-fit rounded-full border border-[#f2b709]/50 bg-[#f2b709]/15 px-3 py-1 text-xs font-black text-slate-900">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

export default async function TransportDetailsPage({
  params
}: TransportDetailsPageProps) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: transportData, error: transportError } = await supabase
    .from("transports")
    .select(
      `
        id,
        hospital_id,
        patient_code,
        bed_number,
        priority,
        status,
        equipment_required,
        notes,
        requested_at,
        accepted_at,
        started_at,
        completed_at,
        cancelled_at,
        created_at,
        updated_at,
        requested_by,
        assigned_to,
        transport_reason,
        risk_classification,
        precaution_type,
        required_team,
        required_equipment,
        invasive_devices,
        continuous_medications,
        documents_required,
        destination_contact_confirmed,
        clinical_observations,
        origin:origin_sector_id (
          id,
          name,
          floor,
          qr_code
        ),
        destination:destination_sector_id (
          id,
          name,
          floor,
          qr_code
        ),
        requester:requested_by (
          id,
          name,
          email,
          role
        ),
        assignee:assigned_to (
          id,
          name,
          email,
          role
        )
      `
    )
    .eq("id", id)
    .eq("hospital_id", profile.hospital_id)
    .single();

  if (transportError || !transportData) {
    notFound();
  }

  const transport = transportData as TransportDetails;

  const { data: logsData } = await supabase
    .from("transport_logs")
    .select(
      `
        id,
        action,
        old_status,
        new_status,
        metadata,
        created_at,
        user:user_id (
          id,
          name,
          role
        )
      `
    )
    .eq("transport_id", transport.id)
    .order("created_at", { ascending: true });

  const { data: auditLogsData } = await supabase
    .from("transport_audit_logs")
    .select(
      `
        id,
        action,
        old_status,
        new_status,
        description,
        metadata,
        created_at,
        actor_name,
        actor_email,
        actor_role
      `
    )
    .eq("transport_id", transport.id)
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: true });

  const logs = (logsData ?? []) as TransportLog[];
  const auditLogs = (auditLogsData ?? []) as TransportAuditLog[];

  const origin = getFirstRelation(transport.origin);
  const destination = getFirstRelation(transport.destination);
  const requester = getFirstRelation(transport.requester);
  const assignee = getFirstRelation(transport.assignee);

  const isHighRisk = transport.risk_classification === "high";
  const hasSpecialPrecaution =
    transport.precaution_type && transport.precaution_type !== "standard";

  return (
    <DashboardShell
      title="Detalhes do Chamado"
      description="Acompanhe os dados, horÃ¡rios e histÃ³rico do transporte."
      userName={profile.name}
      userRole={profile.role}
    >
      <RealtimeTransportsRefresh hospitalId={profile.hospital_id} />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Rastreabilidade do transporte
                </p>

                <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Chamado {transport.patient_code}
                </h3>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  VisualizaÃ§Ã£o detalhada para seguranÃ§a do paciente, auditoria,
                  histÃ³rico operacional e acompanhamento do fluxo do transporte.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusBadgeClass(
                      transport.status
                    )}`}
                  >
                    {statusLabels[transport.status] ?? transport.status}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${getPriorityBadgeClass(
                      transport.priority
                    )}`}
                  >
                    {priorityLabels[transport.priority] ?? transport.priority}
                  </span>

                  {isHighRisk ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                      Alto risco
                    </span>
                  ) : null}

                  {hasSpecialPrecaution ? (
                    <span className="rounded-full border border-[#f2b709]/50 bg-[#f2b709]/15 px-3 py-1 text-xs font-black text-slate-900">
                      PrecauÃ§Ã£o especial
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/transports/${transport.id}/pdf`}
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#009da8] transition hover:bg-slate-50"
                >
                  Exportar PDF
                </Link>

                <Link
                  href={`/transports/${transport.id}/csv`}
                  className="inline-flex rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-95"
                >
                  Exportar CSV
                </Link>

                <Link
                  href="/transports"
                  className="inline-flex rounded-2xl border border-white/40 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Voltar
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Origem" value={origin?.name ?? "-"} />
            <InfoItem label="Destino" value={destination?.name ?? "-"} />
            <InfoItem label="Leito" value={transport.bed_number || "-"} />
            <InfoItem
              label="ResponsÃ¡vel"
              value={assignee?.name ?? "Sem responsÃ¡vel"}
            />
          </div>
        </section>

        <TransportChatPanel
          transportId={transport.id}
          hospitalId={transport.hospital_id}
          currentProfileId={profile.id}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="space-y-6 xl:col-span-2">
            <SectionCard title="Dados do transporte">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem
                  label="CÃ³digo do paciente"
                  value={transport.patient_code}
                />

                <InfoItem label="Leito" value={transport.bed_number || "-"} />

                <InfoItem
                  label="Equipamentos operacionais"
                  value={formatEquipment(transport.equipment_required)}
                />

                <InfoItem
                  label="ResponsÃ¡vel"
                  value={assignee?.name ?? "Sem responsÃ¡vel"}
                />

                <InfoItem
                  label="Solicitado por"
                  value={requester?.name ?? "-"}
                />

                <InfoItem
                  label="Atualizado em"
                  value={formatDate(transport.updated_at)}
                />

                <div className="md:col-span-2">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    ObservaÃ§Ãµes para o maqueiro
                  </p>

                  <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                    {transport.notes || "Nenhuma observaÃ§Ã£o registrada."}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Planejamento seguro do transporte"
              description="InformaÃ§Ãµes assistenciais e operacionais necessÃ¡rias para organizar equipe, precauÃ§Ãµes e equipamentos antes do deslocamento."
              badge="SeguranÃ§a do paciente"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem
                  label="Motivo do transporte"
                  value={getLabel(
                    transportReasonLabels,
                    transport.transport_reason
                  )}
                />

                <BadgeInfo
                  label="ClassificaÃ§Ã£o de risco"
                  value={getLabel(
                    riskClassificationLabels,
                    transport.risk_classification
                  )}
                  className={getRiskBadgeClass(transport.risk_classification)}
                />

                <BadgeInfo
                  label="PrecauÃ§Ã£o / isolamento"
                  value={getLabel(
                    precautionTypeLabels,
                    transport.precaution_type
                  )}
                  className={getPrecautionBadgeClass(
                    transport.precaution_type
                  )}
                />

                <BadgeInfo
                  label="Setor de destino avisado"
                  value={
                    transport.destination_contact_confirmed
                      ? "Confirmado"
                      : "NÃ£o confirmado"
                  }
                  className={
                    transport.destination_contact_confirmed
                      ? "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]"
                      : "border-red-200 bg-red-50 text-red-700"
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TagList
                  title="Equipe multidisciplinar necessÃ¡ria"
                  values={transport.required_team}
                  labels={requiredTeamLabels}
                />

                <TagList
                  title="Equipamentos obrigatÃ³rios"
                  values={transport.required_equipment}
                  labels={equipmentLabels}
                />

                <TagList
                  title="Dispositivos invasivos"
                  values={transport.invasive_devices}
                  labels={invasiveDeviceLabels}
                />

                <TagList
                  title="MedicaÃ§Ãµes / infusÃµes contÃ­nuas"
                  values={transport.continuous_medications}
                  labels={continuousMedicationLabels}
                />

                <div className="md:col-span-2">
                  <TagList
                    title="Documentos necessÃ¡rios"
                    values={transport.documents_required}
                    labels={documentLabels}
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  ObservaÃ§Ãµes clÃ­nicas e operacionais
                </p>

                <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4 text-sm font-semibold leading-6 text-slate-700">
                  {transport.clinical_observations ||
                    "Nenhuma observaÃ§Ã£o clÃ­nica ou operacional registrada."}
                </p>
              </div>
            </SectionCard>

            <SectionCard
              title="Rastreabilidade do transporte"
              description="Linha do tempo oficial com os eventos auditados deste chamado."
            >
              <div className="mb-5">
                <Link
                  href="/reports/transport-audit"
                  className="inline-flex w-fit rounded-2xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95"
                >
                  Ver auditoria geral
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-bold text-slate-500">
                  Nenhum evento de auditoria encontrado para este transporte.
                  Eventos novos serÃ£o registrados automaticamente a partir das
                  aÃ§Ãµes realizadas no chamado.
                </div>
              ) : (
                <div className="space-y-5">
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-10">
                      {index < auditLogs.length - 1 ? (
                        <div className="absolute left-[13px] top-9 h-full w-px bg-slate-200" />
                      ) : null}

                      <div
                        className={`absolute left-0 top-1 h-7 w-7 rounded-full ring-8 ${getTimelineDotClass(
                          log.action
                        )}`}
                      />

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getAuditActionBadgeClass(
                                log.action
                              )}`}
                            >
                              {auditActionLabels[log.action] ?? log.action}
                            </span>

                            <h5 className="mt-3 text-base font-black text-slate-950">
                              {log.description}
                            </h5>

                            <p className="mt-2 text-sm font-semibold text-slate-500">
                              ResponsÃ¡vel:{" "}
                              <strong className="text-slate-800">
                                {log.actor_name ?? "Sistema"}
                              </strong>
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {log.actor_email ?? "E-mail nÃ£o informado"} Â·{" "}
                              {getRoleLabel(log.actor_role)}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-slate-500">
                            {formatDate(log.created_at)}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoItem
                            label="Status anterior"
                            value={getStatusLabel(log.old_status)}
                          />

                          <InfoItem
                            label="Novo status"
                            value={getStatusLabel(log.new_status)}
                          />
                        </div>

                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-black text-[#009da8]">
                            Ver dados tÃ©cnicos da auditoria
                          </summary>

                          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                            {formatMetadata(log.metadata)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Logs tÃ©cnicos do chamado"
              description="HistÃ³rico tÃ©cnico complementar usado pelo sistema."
            >
              {logs.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  Nenhum log tÃ©cnico encontrado para este chamado.
                </p>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => {
                    const logUser = getFirstRelation(log.user);

                    return (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-black text-slate-900">
                              {actionLabels[log.action] ?? log.action}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              UsuÃ¡rio: {logUser?.name ?? "Sistema"}
                            </p>
                          </div>

                          <p className="text-sm font-semibold text-slate-500">
                            {formatDate(log.created_at)}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <InfoItem
                            label="Status anterior"
                            value={getStatusLabel(log.old_status)}
                          />

                          <InfoItem
                            label="Novo status"
                            value={getStatusLabel(log.new_status)}
                          />
                        </div>

                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-black text-[#009da8]">
                            Ver informaÃ§Ãµes adicionais
                          </summary>

                          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                            {formatMetadata(log.metadata)}
                          </pre>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
              <h4 className="text-lg font-black text-slate-950">
                HorÃ¡rios do chamado
              </h4>

              <div className="mt-5 space-y-3">
                <InfoItem
                  label="Solicitado em"
                  value={formatDate(transport.requested_at)}
                />

                <InfoItem
                  label="Aceito em"
                  value={formatDate(transport.accepted_at)}
                />

                <InfoItem
                  label="Iniciado em"
                  value={formatDate(transport.started_at)}
                />

                <InfoItem
                  label="ConcluÃ­do em"
                  value={formatDate(transport.completed_at)}
                />

                <InfoItem
                  label="Cancelado em"
                  value={formatDate(transport.cancelled_at)}
                />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#009da8]/25 bg-[#009da8]/10 p-6 shadow-sm">
              <h4 className="text-lg font-black text-slate-950">
                Resumo de seguranÃ§a
              </h4>

              <div className="mt-5 space-y-3">
                <BadgeInfo
                  label="Risco"
                  value={getLabel(
                    riskClassificationLabels,
                    transport.risk_classification
                  )}
                  className={getRiskBadgeClass(transport.risk_classification)}
                />

                <BadgeInfo
                  label="PrecauÃ§Ã£o"
                  value={getLabel(
                    precautionTypeLabels,
                    transport.precaution_type
                  )}
                  className={getPrecautionBadgeClass(transport.precaution_type)}
                />

                <InfoItem
                  label="Equipe necessÃ¡ria"
                  value={
                    transport.required_team && transport.required_team.length > 0
                      ? `${transport.required_team.length} item(ns)`
                      : "NÃ£o informado"
                  }
                />

                <InfoItem
                  label="Equipamentos obrigatÃ³rios"
                  value={
                    transport.required_equipment &&
                    transport.required_equipment.length > 0
                      ? `${transport.required_equipment.length} item(ns)`
                      : "NÃ£o informado"
                  }
                />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
              <h4 className="text-lg font-black text-slate-950">
                AÃ§Ãµes disponÃ­veis
              </h4>

              <div className="mt-5 space-y-3">
                {canAcceptTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to
                ) ? (
                  <form action={acceptTransport}>
                    <input
                      type="hidden"
                      name="transport_id"
                      value={transport.id}
                    />

                    <ActionSubmitButton>Aceitar chamado</ActionSubmitButton>
                  </form>
                ) : null}

                {canStartTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to,
                  profile.id
                ) ? (
                  <form action={startTransport}>
                    <input
                      type="hidden"
                      name="transport_id"
                      value={transport.id}
                    />

                    <ActionSubmitButton variant="gold">
                      Iniciar transporte
                    </ActionSubmitButton>
                  </form>
                ) : null}

                {canCompleteTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to,
                  profile.id
                ) ? (
                  <form action={completeTransport}>
                    <input
                      type="hidden"
                      name="transport_id"
                      value={transport.id}
                    />

                    <ActionSubmitButton variant="success">
                      Concluir transporte
                    </ActionSubmitButton>
                  </form>
                ) : null}

                {canCancelTransport(
                  profile.role,
                  transport.status,
                  transport.requested_by,
                  profile.id
                ) ? (
                  <form action={cancelTransport}>
                    <input
                      type="hidden"
                      name="transport_id"
                      value={transport.id}
                    />

                    <ActionSubmitButton variant="danger">
                      Cancelar chamado
                    </ActionSubmitButton>
                  </form>
                ) : null}

                {!canAcceptTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to
                ) &&
                !canStartTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to,
                  profile.id
                ) &&
                !canCompleteTransport(
                  profile.role,
                  transport.status,
                  transport.assigned_to,
                  profile.id
                ) &&
                !canCancelTransport(
                  profile.role,
                  transport.status,
                  transport.requested_by,
                  profile.id
                ) ? (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Nenhuma aÃ§Ã£o disponÃ­vel para seu perfil neste status.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

