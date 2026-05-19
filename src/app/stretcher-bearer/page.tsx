import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransportsRefresh } from "@/components/realtime/realtime-transports-refresh";
import {
  acceptTransportFromPanel,
  completeTransportFromPanel,
  reportFailureFromPanel,
  startTransportFromPanel
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StretcherBearerPageProps = {
  searchParams: Promise<{
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

type TransportCardRow = {
  id: string;
  patient_code: string;
  bed_number: string | null;
  priority: string;
  status: string;
  equipment_required: string[] | null;
  notes: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  assigned_to: string | null;

  transport_reason: string | null;
  risk_classification: string | null;
  precaution_type: string | null;
  required_team: string[] | null;
  required_equipment: string[] | null;
  destination_contact_confirmed: boolean | null;
  clinical_observations: string | null;

  origin: SectorRelation | SectorRelation[] | null;
  destination: SectorRelation | SectorRelation[] | null;
  requester: ProfileRelation | ProfileRelation[] | null;
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

function TransportCard({
  transport,
  profileId
}: {
  transport: TransportCardRow;
  profileId: string;
}) {
  const origin = getFirstRelation(transport.origin);
  const destination = getFirstRelation(transport.destination);
  const requester = getFirstRelation(transport.requester);

  const isPending = transport.status === "pending";
  const isAcceptedByMe =
    transport.status === "accepted" && transport.assigned_to === profileId;
  const isInTransitByMe =
    transport.status === "in_transit" && transport.assigned_to === profileId;

  const isHighRisk = transport.risk_classification === "high";
  const hasSpecialPrecaution =
    transport.precaution_type && transport.precaution_type !== "standard";

  return (
    <article
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

      <div className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
              {transport.patient_code}
            </p>

            <h3 className="mt-2 text-xl font-black text-slate-950">
              {origin?.name ?? "-"} → {destination?.name ?? "-"}
            </h3>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              Leito: {transport.bed_number || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getPriorityBadgeClass(
                transport.priority
              )}`}
            >
              {priorityLabels[transport.priority] ?? transport.priority}
            </span>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getStatusBadgeClass(
                transport.status
              )}`}
            >
              {statusLabels[transport.status] ?? transport.status}
            </span>

            {isHighRisk ? (
              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                Alto risco
              </span>
            ) : null}

            {hasSpecialPrecaution ? (
              <span className="inline-flex rounded-full border border-[#f2b709]/50 bg-[#f2b709]/15 px-3 py-1 text-xs font-black text-slate-900">
                Precaução especial
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#007983]">
              Origem
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {origin?.name ?? "-"}
            </p>

            <p className="text-sm font-semibold text-slate-500">
              {origin?.floor ?? ""}
            </p>
          </div>

          <div className="rounded-2xl border border-[#f2b709]/30 bg-[#f2b709]/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-700">
              Destino
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {destination?.name ?? "-"}
            </p>

            <p className="text-sm font-semibold text-slate-500">
              {destination?.floor ?? ""}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Motivo
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {getLabel(transportReasonLabels, transport.transport_reason)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Solicitado em
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatDate(transport.requested_at)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#007983]">
              Equipe necessária
            </p>

            <p className="mt-1 text-sm font-bold text-slate-800">
              {formatArrayBrief(transport.required_team, requiredTeamLabels)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#f2b709]/30 bg-[#f2b709]/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-700">
              Equipamentos obrigatórios
            </p>

            <p className="mt-1 text-sm font-bold text-slate-800">
              {formatArrayBrief(
                transport.required_equipment ?? transport.equipment_required,
                equipmentLabels
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Risco
            </p>

            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getRiskBadgeClass(
                transport.risk_classification
              )}`}
            >
              {getLabel(riskClassificationLabels, transport.risk_classification)}
            </span>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Precaução
            </p>

            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${getPrecautionBadgeClass(
                transport.precaution_type
              )}`}
            >
              {getLabel(precautionTypeLabels, transport.precaution_type)}
            </span>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Destino avisado
            </p>

            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                transport.destination_contact_confirmed
                  ? "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {transport.destination_contact_confirmed
                ? "Confirmado"
                : "Não confirmado"}
            </span>
          </div>
        </div>

        {transport.clinical_observations ? (
          <div className="mt-4 rounded-2xl border border-[#009da8]/15 bg-[#009da8]/5 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#007983]">
              Observações clínicas
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
              {transport.clinical_observations}
            </p>
          </div>
        ) : null}

        {transport.notes ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Observações para o maqueiro
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
              {transport.notes}
            </p>
          </div>
        ) : null}

        <div className="mt-4 text-sm font-semibold text-slate-500">
          Solicitado por:{" "}
          <strong className="text-slate-700">{requester?.name ?? "-"}</strong>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {isPending ? (
            <form action={acceptTransportFromPanel}>
              <input type="hidden" name="transport_id" value={transport.id} />

              <ActionSubmitButton>Aceitar</ActionSubmitButton>
            </form>
          ) : null}

          {isAcceptedByMe ? (
            <form action={startTransportFromPanel}>
              <input type="hidden" name="transport_id" value={transport.id} />

              <ActionSubmitButton variant="gold">Iniciar</ActionSubmitButton>
            </form>
          ) : null}

          {isInTransitByMe ? (
            <form action={completeTransportFromPanel}>
              <input type="hidden" name="transport_id" value={transport.id} />

              <ActionSubmitButton variant="success">Concluir</ActionSubmitButton>
            </form>
          ) : null}

          {isAcceptedByMe || isInTransitByMe ? (
            <details className="rounded-xl border border-slate-300 bg-white p-3">
              <summary className="cursor-pointer text-sm font-black text-slate-700">
                Reportar falha
              </summary>

              <form action={reportFailureFromPanel} className="mt-3 space-y-3">
                <input type="hidden" name="transport_id" value={transport.id} />

                <textarea
                  name="failure_reason"
                  required
                  rows={3}
                  placeholder="Descreva o motivo da falha"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
                />

                <ActionSubmitButton variant="danger">
                  Confirmar falha
                </ActionSubmitButton>
              </form>
            </details>
          ) : null}

          <Link
            href={`/transports/${transport.id}`}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Ver detalhes
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function StretcherBearerPage({
  searchParams
}: StretcherBearerPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  if (profile.role !== "stretcher_bearer") {
    return (
      <DashboardShell
        title="Painel do Maqueiro"
        description="Área operacional para transporte intra-hospitalar."
        userName={profile.name}
        userRole={profile.role}
      >
        <div className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">
            Acesso restrito
          </h3>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Esta tela é destinada aos maqueiros.
          </p>

          <Link
            href="/transports"
            className="mt-6 inline-flex rounded-2xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95"
          >
            Ir para chamados
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { data, error } = await supabase
    .from("transports")
    .select(
      `
        id,
        patient_code,
        bed_number,
        priority,
        status,
        equipment_required,
        notes,
        requested_at,
        accepted_at,
        started_at,
        assigned_to,
        transport_reason,
        risk_classification,
        precaution_type,
        required_team,
        required_equipment,
        destination_contact_confirmed,
        clinical_observations,
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
        )
      `
    )
    .eq("hospital_id", profile.hospital_id)
    .in("status", ["pending", "accepted", "in_transit"])
    .order("priority", { ascending: false })
    .order("requested_at", { ascending: true });

  const transports = (data ?? []) as TransportCardRow[];

  const pendingTransports = transports.filter(
    (transport) => transport.status === "pending" && !transport.assigned_to
  );

  const myActiveTransports = transports.filter((transport) => {
    return (
      transport.assigned_to === profile.id &&
      ["accepted", "in_transit"].includes(transport.status)
    );
  });

  const urgentPendingCount = pendingTransports.filter(
    (transport) => transport.priority === "urgent"
  ).length;

  const highRiskCount = transports.filter(
    (transport) => transport.risk_classification === "high"
  ).length;

  const precautionCount = transports.filter(
    (transport) =>
      transport.precaution_type && transport.precaution_type !== "standard"
  ).length;

  return (
    <DashboardShell
      title="Painel do Maqueiro"
      description="Aceite, acompanhe e atualize transportes em tempo operacional."
      userName={profile.name}
      userRole={profile.role}
    >
      <RealtimeTransportsRefresh hospitalId={profile.hospital_id} />

      <div className="space-y-6">
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

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 shadow-sm">
            Não foi possível carregar os chamados: {error.message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
              Operação em tempo real
            </p>

            <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
              Central de chamados do maqueiro
            </h3>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
              Aceite chamados pendentes, acompanhe seus transportes ativos e
              atualize o andamento com rastreabilidade.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Chamados pendentes"
              value={pendingTransports.length}
              description="Disponíveis para aceite"
              tone="gold"
            />

            <StatCard
              label="Meus ativos"
              value={myActiveTransports.length}
              description="Aceitos ou em trânsito"
              tone="primary"
            />

            <StatCard
              label="Urgentes pendentes"
              value={urgentPendingCount}
              description="Requerem atenção rápida"
              tone="danger"
            />

            <StatCard
              label="Alto risco"
              value={highRiskCount}
              description="Chamados com maior criticidade"
              tone="danger"
            />

            <StatCard
              label="Com precaução"
              value={precautionCount}
              description="Isolamento ou cuidado especial"
              tone="neutral"
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Disponíveis
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                Chamados pendentes
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Chamados disponíveis para aceite.
              </p>
            </div>

            {pendingTransports.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[#009da8]/30 bg-white p-8 text-center shadow-sm">
                <h4 className="text-lg font-black text-slate-950">
                  Nenhum chamado pendente
                </h4>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Quando um enfermeiro criar uma requisição, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTransports.map((transport) => (
                  <TransportCard
                    key={transport.id}
                    transport={transport}
                    profileId={profile.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Em andamento
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                Meus transportes ativos
              </h3>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Transportes aceitos por você.
              </p>
            </div>

            {myActiveTransports.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[#009da8]/30 bg-white p-8 text-center shadow-sm">
                <h4 className="text-lg font-black text-slate-950">
                  Nenhum transporte ativo
                </h4>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Após aceitar um chamado, ele aparecerá nesta lista.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myActiveTransports.map((transport) => (
                  <TransportCard
                    key={transport.id}
                    transport={transport}
                    profileId={profile.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}