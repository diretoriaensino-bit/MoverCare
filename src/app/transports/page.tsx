import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransportsRefresh } from "@/components/realtime/realtime-transports-refresh";
import {
  acceptTransport,
  cancelTransport,
  completeTransport,
  startTransport
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransportPageProps = {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    risk?: string;
    precaution?: string;
    error?: string;
    success?: string;
  }>;
};

type SectorRelation = {
  id: string;
  name: string;
  floor: string | null;
};

type ProfileRelation = {
  id: string;
  name: string;
  role: string;
};

type TransportRow = {
  id: string;
  patient_code: string;
  bed_number: string | null;
  priority: string;
  status: string;
  equipment_required: string[] | null;
  requested_at: string | null;
  requested_by: string;
  assigned_to: string | null;

  transport_reason: string | null;
  risk_classification: string | null;
  precaution_type: string | null;
  required_team: string[] | null;
  required_equipment: string[] | null;
  destination_contact_confirmed: boolean | null;

  origin: SectorRelation | SectorRelation[] | null;
  destination: SectorRelation | SectorRelation[] | null;
  requester: ProfileRelation | ProfileRelation[] | null;
  assignee: ProfileRelation | ProfileRelation[] | null;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  in_transit: "Em trânsito",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falhou"
};

const priorityLabels: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgente"
};

const transportReasonLabels: Record<string, string> = {
  exam: "Exame",
  procedure: "Procedimento",
  surgery: "Cirurgia",
  bed_transfer: "Transferência de leito",
  interclinic_transfer: "Transferência interclínica",
  hospital_discharge: "Alta hospitalar",
  external_activity: "Atividade externa",
  other: "Outro"
};

const riskClassificationLabels: Record<string, string> = {
  low: "Baixo risco",
  medium: "Médio risco",
  high: "Alto risco"
};

const precautionTypeLabels: Record<string, string> = {
  standard: "Padrão",
  contact: "Contato",
  droplet: "Gotículas",
  aerosol: "Aerossóis",
  reverse: "Reverso"
};

const requiredTeamLabels: Record<string, string> = {
  nursing_technician: "Téc. enfermagem",
  nurse: "Enfermeiro",
  physician: "Médico",
  physiotherapist: "Fisioterapeuta",
  stretcher_bearer: "Maqueiro",
  cleaning_team: "Higienização",
  destination_team: "Equipe destino"
};

const equipmentLabels: Record<string, string> = {
  wheelchair: "Cadeira de rodas",
  stretcher: "Maca",
  oxygen: "Oxigênio",
  oxygen_cylinder: "Cilindro O₂",
  monitor: "Monitor",
  pulse_oximeter: "Oxímetro",
  infusion_pump: "Bomba de infusão",
  transport_ventilator: "Ventilador transporte",
  transport_kit: "Kit transporte",
  suction: "Aspiração",
  ppe: "EPIs",
  isolation: "Isolamento",
  other: "Outros"
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

function getLabel(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback = "Não informado"
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

function formatArrayBrief(
  values: string[] | null,
  labels: Record<string, string>,
  maxItems = 3
) {
  if (!values || values.length === 0) {
    return "Não informado";
  }

  const visibleItems = values
    .slice(0, maxItems)
    .map((item) => labels[item] ?? item);

  const remaining = values.length - visibleItems.length;

  if (remaining > 0) {
    return `${visibleItems.join(", ")} +${remaining}`;
  }

  return visibleItems.join(", ");
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

function StatCard({
  label,
  value,
  description,
  tone = "primary"
}: {
  label: string;
  value: number;
  description: string;
  tone?: "primary" | "gold" | "danger" | "neutral";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-white",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
    danger: "border-red-200 bg-red-50/70",
    neutral: "border-slate-200 bg-white"
  }[tone];

  const dotClass = {
    primary: "bg-[#009da8]",
    gold: "bg-[#f2b709]",
    danger: "bg-red-500",
    neutral: "bg-slate-400"
  }[tone];

  return (
    <div
      className={`rounded-[1.35rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>

          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <span className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
      </div>

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ActionButton({
  children,
  variant = "primary"
}: {
  children: React.ReactNode;
  variant?: "primary" | "gold" | "danger" | "outline";
}) {
  const className = {
    primary:
      "bg-[#009da8] text-white hover:brightness-95",
    gold:
      "bg-[#f2b709] text-slate-950 hover:brightness-95",
    danger:
      "bg-red-600 text-white hover:bg-red-700",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }[variant];

  return (
    <button
      className={`w-full rounded-xl px-3 py-2 text-xs font-black transition ${className}`}
    >
      {children}
    </button>
  );
}

export default async function TransportsPage({
  searchParams
}: TransportPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  let query = supabase
    .from("transports")
    .select(
      `
        id,
        patient_code,
        bed_number,
        priority,
        status,
        equipment_required,
        requested_at,
        requested_by,
        assigned_to,
        transport_reason,
        risk_classification,
        precaution_type,
        required_team,
        required_equipment,
        destination_contact_confirmed,
        origin:origin_sector_id (
          id,
          name,
          floor
        ),
        destination:destination_sector_id (
          id,
          name,
          floor
        ),
        requester:requested_by (
          id,
          name,
          role
        ),
        assignee:assigned_to (
          id,
          name,
          role
        )
      `
    )
    .eq("hospital_id", profile.hospital_id)
    .order("requested_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.priority && params.priority !== "all") {
    query = query.eq("priority", params.priority);
  }

  if (params.risk && params.risk !== "all") {
    query = query.eq("risk_classification", params.risk);
  }

  if (params.precaution && params.precaution !== "all") {
    query = query.eq("precaution_type", params.precaution);
  }

  const { data, error } = await query;
  const transports = (data ?? []) as TransportRow[];

  const pendingCount = transports.filter(
    (item) => item.status === "pending"
  ).length;

  const inTransitCount = transports.filter(
    (item) => item.status === "in_transit"
  ).length;

  const highRiskCount = transports.filter(
    (item) => item.risk_classification === "high"
  ).length;

  const isolationCount = transports.filter(
    (item) => item.precaution_type && item.precaution_type !== "standard"
  ).length;

  return (
    <DashboardShell
      title="Chamados"
      description="Acompanhe e atualize os transportes intra-hospitalares."
      userName={profile.name}
      userRole={profile.role}
    >
      <RealtimeTransportsRefresh hospitalId={profile.hospital_id} />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Central operacional
                </p>

                <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Lista de chamados
                </h3>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Visualize status, risco, precaução, equipe necessária,
                  equipamentos, responsáveis e rastreabilidade dos transportes.
                </p>
              </div>

              <Link
                href="/nurse/new-request"
                className="inline-flex w-fit rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
              >
                Nova requisição
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-4">
            <StatCard
              label="Pendentes"
              value={pendingCount}
              description="Aguardando aceite"
              tone="gold"
            />

            <StatCard
              label="Em trânsito"
              value={inTransitCount}
              description="Transportes em andamento"
              tone="primary"
            />

            <StatCard
              label="Alto risco"
              value={highRiskCount}
              description="Exigem maior atenção"
              tone="danger"
            />

            <StatCard
              label="Com precaução"
              value={isolationCount}
              description="Contato, gotículas, aerossóis ou reverso"
              tone="neutral"
            />
          </div>
        </section>

        {params.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 shadow-sm">
            {params.error}
          </div>
        ) : null}

        {params.success ? (
          <div className="rounded-2xl border border-[#009da8]/25 bg-[#009da8]/10 px-5 py-4 text-sm font-bold text-[#007983] shadow-sm">
            {params.success}
          </div>
        ) : null}

        <form className="grid gap-4 rounded-[1.5rem] border border-[#009da8]/20 bg-white p-5 shadow-sm md:grid-cols-5">
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-black text-slate-700"
            >
              Status
            </label>

            <select
              id="status"
              name="status"
              defaultValue={params.status ?? "all"}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="accepted">Aceito</option>
              <option value="in_transit">Em trânsito</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
              <option value="failed">Falhou</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-black text-slate-700"
            >
              Prioridade
            </label>

            <select
              id="priority"
              name="priority"
              defaultValue={params.priority ?? "all"}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            >
              <option value="all">Todas</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="risk"
              className="block text-sm font-black text-slate-700"
            >
              Risco
            </label>

            <select
              id="risk"
              name="risk"
              defaultValue={params.risk ?? "all"}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            >
              <option value="all">Todos</option>
              <option value="low">Baixo risco</option>
              <option value="medium">Médio risco</option>
              <option value="high">Alto risco</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="precaution"
              className="block text-sm font-black text-slate-700"
            >
              Precaução
            </label>

            <select
              id="precaution"
              name="precaution"
              defaultValue={params.precaution ?? "all"}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            >
              <option value="all">Todas</option>
              <option value="standard">Padrão</option>
              <option value="contact">Contato</option>
              <option value="droplet">Gotículas</option>
              <option value="aerosol">Aerossóis</option>
              <option value="reverse">Reverso</option>
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="w-full rounded-xl bg-[#009da8] px-4 py-3 text-sm font-black text-white transition hover:brightness-95"
            >
              Filtrar
            </button>

            <Link
              href="/transports"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 shadow-sm">
            Não foi possível carregar os chamados: {error.message}
          </div>
        ) : null}

        {transports.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#009da8]/30 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-black text-slate-950">
              Nenhum chamado encontrado
            </h3>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Crie uma nova requisição ou altere os filtros.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {transports.map((transport) => {
              const origin = getFirstRelation(transport.origin);
              const destination = getFirstRelation(transport.destination);
              const assignee = getFirstRelation(transport.assignee);

              const isHighRisk = transport.risk_classification === "high";
              const hasSpecialPrecaution =
                transport.precaution_type &&
                transport.precaution_type !== "standard";

              return (
                <div
                  key={transport.id}
                  className={`overflow-hidden rounded-[1.5rem] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    isHighRisk
                      ? "border-red-200"
                      : hasSpecialPrecaution
                        ? "border-[#f2b709]/50"
                        : "border-[#009da8]/20"
                  }`}
                >
                  <div
                    className={`h-2 ${
                      isHighRisk
                        ? "bg-red-500"
                        : hasSpecialPrecaution
                          ? "bg-[#f2b709]"
                          : "bg-[#009da8]"
                    }`}
                  />

                  <div className="p-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-slate-950">
                            Paciente {transport.patient_code}
                          </h4>

                          {isHighRisk ? (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                              Atenção: alto risco
                            </span>
                          ) : null}

                          {hasSpecialPrecaution ? (
                            <span className="rounded-full border border-[#f2b709]/50 bg-[#f2b709]/15 px-3 py-1 text-xs font-black text-slate-900">
                              Precaução especial
                            </span>
                          ) : null}

                          {transport.destination_contact_confirmed ? (
                            <span className="rounded-full border border-[#009da8]/30 bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#007983]">
                              Destino avisado
                            </span>
                          ) : (
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                              Destino não confirmado
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Leito
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {transport.bed_number || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Origem
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {origin?.name ?? "-"}
                            </p>

                            <p className="text-xs font-semibold text-slate-500">
                              {origin?.floor ?? ""}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Destino
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {destination?.name ?? "-"}
                            </p>

                            <p className="text-xs font-semibold text-slate-500">
                              {destination?.floor ?? ""}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Criado em
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {formatDate(transport.requested_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Motivo
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {getLabel(
                                transportReasonLabels,
                                transport.transport_reason
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Risco
                            </p>

                            <span
                              className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getRiskBadgeClass(
                                transport.risk_classification
                              )}`}
                            >
                              {getLabel(
                                riskClassificationLabels,
                                transport.risk_classification
                              )}
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Precaução
                            </p>

                            <span
                              className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getPrecautionBadgeClass(
                                transport.precaution_type
                              )}`}
                            >
                              {getLabel(
                                precautionTypeLabels,
                                transport.precaution_type
                              )}
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Responsável
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {assignee?.name ?? "Sem responsável"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-[#007983]">
                              Equipe necessária
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {formatArrayBrief(
                                transport.required_team,
                                requiredTeamLabels
                              )}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[#f2b709]/30 bg-[#f2b709]/10 p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-700">
                              Equipamentos obrigatórios
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {formatArrayBrief(
                                transport.required_equipment,
                                equipmentLabels
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 xl:w-48">
                        <div className="flex flex-wrap gap-2 xl:flex-col">
                          <span
                            className={`inline-flex justify-center rounded-full border px-3 py-1 text-xs font-black ${getPriorityBadgeClass(
                              transport.priority
                            )}`}
                          >
                            {priorityLabels[transport.priority] ??
                              transport.priority}
                          </span>

                          <span
                            className={`inline-flex justify-center rounded-full border px-3 py-1 text-xs font-black ${getStatusBadgeClass(
                              transport.status
                            )}`}
                          >
                            {statusLabels[transport.status] ?? transport.status}
                          </span>
                        </div>

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

                            <ActionButton>Aceitar</ActionButton>
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

                            <ActionButton variant="gold">Iniciar</ActionButton>
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

                            <ActionButton>Concluir</ActionButton>
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

                            <ActionButton variant="danger">Cancelar</ActionButton>
                          </form>
                        ) : null}

                        <Link
                          href={`/transports/${transport.id}`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-xs font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          Abrir detalhes
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}