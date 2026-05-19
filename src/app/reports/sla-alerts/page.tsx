import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransportsRefresh } from "@/components/realtime/realtime-transports-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlaAlertsPageProps = {
  searchParams?: Promise<{
    accept?: string;
    start?: string;
    transport?: string;
  }>;
};

type NumericValue = number | string | null;

type SlaAlert = {
  transport_id: string;
  patient_code: string;
  priority: string;
  status: string;
  origin_name: string | null;
  destination_name: string | null;
  assigned_name: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  elapsed_minutes: NumericValue;
  alert_type: string;
  alert_level: string;
  alert_message: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  in_transit: "Em transporte",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falha"
};

const priorityLabels: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgente"
};

const alertTypeLabels: Record<string, string> = {
  pending_acceptance_delay: "Atraso no aceite",
  start_delay: "Atraso para iniciar",
  transport_delay: "Transporte demorado",
  no_alert: "Sem alerta"
};

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
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

function formatMinutes(value: NumericValue) {
  if (value === null || value === undefined) {
    return "-";
  }

  const roundedValue = Math.round(Number(value));

  if (!Number.isFinite(roundedValue)) {
    return "-";
  }

  if (roundedValue < 60) {
    return `${roundedValue} min`;
  }

  const hours = Math.floor(roundedValue / 60);
  const minutes = roundedValue % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

function getStatusBadgeClass(status: string) {
  if (status === "pending") {
    return "border-[#f2b709]/40 bg-[#f2b709]/15 text-slate-900";
  }

  if (status === "accepted") {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  if (status === "in_transit") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getPriorityBadgeClass(priority: string) {
  if (priority === "urgent") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[#009da8]/25 bg-[#009da8]/10 text-[#007983]";
}

function getAlertLevelClass(level: string) {
  if (level === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
}

function getAlertCardClass(level: string) {
  if (level === "critical") {
    return "border-red-200 bg-red-50/70";
  }

  return "border-[#f2b709]/50 bg-[#f2b709]/10";
}

function getBaseDateByStatus(alert: SlaAlert) {
  if (alert.status === "pending") {
    return formatDate(alert.requested_at);
  }

  if (alert.status === "accepted") {
    return formatDate(alert.accepted_at);
  }

  return formatDate(alert.started_at);
}

function MetricCard({
  label,
  value,
  description,
  tone = "primary"
}: {
  label: string;
  value: string | number;
  description: string;
  tone?: "primary" | "gold" | "danger" | "success" | "neutral";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-white",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
    danger: "border-red-200 bg-red-50/70",
    success: "border-emerald-200 bg-emerald-50/70",
    neutral: "border-slate-200 bg-white"
  }[tone];

  const dotClass = {
    primary: "bg-[#009da8]",
    gold: "bg-[#f2b709]",
    danger: "bg-red-500",
    success: "bg-emerald-500",
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

function AlertCard({ alert }: { alert: SlaAlert }) {
  const isCritical = alert.alert_level === "critical";

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getAlertCardClass(
        alert.alert_level
      )}`}
    >
      <div className={isCritical ? "h-2 bg-red-500" : "h-2 bg-[#f2b709]"} />

      <div className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${getAlertLevelClass(
                  alert.alert_level
                )}`}
              >
                {isCritical ? "Crítico" : "Atenção"}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusBadgeClass(
                  alert.status
                )}`}
              >
                {statusLabels[alert.status] ?? alert.status}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${getPriorityBadgeClass(
                  alert.priority
                )}`}
              >
                {priorityLabels[alert.priority] ?? alert.priority}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-black text-slate-950">
              Paciente {alert.patient_code}
            </h3>

            <p className="mt-1 text-sm font-black text-slate-700">
              {alertTypeLabels[alert.alert_type] ?? alert.alert_type}
            </p>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {alert.alert_message}
            </p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left lg:min-w-44 lg:text-right">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Tempo decorrido
            </p>

            <p className="mt-1 text-2xl font-black text-slate-950">
              {formatMinutes(alert.elapsed_minutes)}
            </p>

            <Link
              href={`/transports/${alert.transport_id}`}
              className="mt-3 inline-flex rounded-xl bg-[#009da8] px-4 py-2 text-sm font-black text-white transition hover:brightness-95"
            >
              Abrir chamado
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#009da8]/15 bg-white/80 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Origem
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {alert.origin_name ?? "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-[#f2b709]/30 bg-white/80 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Destino
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {alert.destination_name ?? "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Responsável
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {alert.assigned_name ?? "Sem responsável"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Horário base
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {getBaseDateByStatus(alert)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function SlaAlertsPage({
  searchParams
}: SlaAlertsPageProps) {
  const params = await searchParams;

  const acceptLimit = Number(params?.accept || "10");
  const startLimit = Number(params?.start || "15");
  const transportLimit = Number(params?.transport || "60");

  const safeAcceptLimit =
    Number.isFinite(acceptLimit) && acceptLimit > 0 ? acceptLimit : 10;

  const safeStartLimit =
    Number.isFinite(startLimit) && startLimit > 0 ? startLimit : 15;

  const safeTransportLimit =
    Number.isFinite(transportLimit) && transportLimit > 0
      ? transportLimit
      : 60;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_transport_sla_alerts_admin", {
    p_accept_limit_minutes: safeAcceptLimit,
    p_start_limit_minutes: safeStartLimit,
    p_transport_limit_minutes: safeTransportLimit
  });

  const alerts = (data ?? []) as SlaAlert[];

  const criticalAlerts = alerts.filter(
    (alert) => alert.alert_level === "critical"
  );

  const warningAlerts = alerts.filter(
    (alert) => alert.alert_level !== "critical"
  );

  const urgentAlerts = alerts.filter((alert) => alert.priority === "urgent");
  const pendingAlerts = alerts.filter((alert) => alert.status === "pending");
  const acceptedAlerts = alerts.filter((alert) => alert.status === "accepted");

  const inTransitAlerts = alerts.filter(
    (alert) => alert.status === "in_transit"
  );

  const longestAlert = alerts.reduce<SlaAlert | null>((longest, alert) => {
    if (!longest) {
      return alert;
    }

    return toNumber(alert.elapsed_minutes) > toNumber(longest.elapsed_minutes)
      ? alert
      : longest;
  }, null);

  const pdfHref = `/reports/sla-alerts/pdf?accept=${safeAcceptLimit}&start=${safeStartLimit}&transport=${safeTransportLimit}`;

  return (
    <DashboardShell
      title="Alertas de SLA"
      description="Monitore transportes atrasados e chamados fora do tempo esperado."
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
                  Monitoramento de atrasos
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Alertas de atraso e SLA
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Acompanhe chamados pendentes, aceitos ou em transporte que
                  ultrapassaram o tempo esperado e priorize os casos críticos.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={pdfHref}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#009da8] shadow-sm transition hover:bg-slate-50"
                >
                  Exportar PDF
                </Link>

                <Link
                  href="/manager"
                  className="rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
                >
                  Painel gestor
                </Link>

                <Link
                  href="/reports"
                  className="rounded-2xl border border-white/40 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Relatórios
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Alertas ativos"
              value={alerts.length}
              description="Transportes fora do SLA"
              tone={alerts.length > 0 ? "danger" : "success"}
            />

            <MetricCard
              label="Críticos"
              value={criticalAlerts.length}
              description="Urgentes ou muito atrasados"
              tone={criticalAlerts.length > 0 ? "danger" : "neutral"}
            />

            <MetricCard
              label="Atenção"
              value={warningAlerts.length}
              description="Atrasos moderados"
              tone="gold"
            />

            <MetricCard
              label="Maior atraso"
              value={
                longestAlert
                  ? formatMinutes(longestAlert.elapsed_minutes)
                  : "-"
              }
              description="Maior tempo excedido no momento"
              tone={longestAlert ? "danger" : "success"}
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            Erro ao carregar alertas de SLA: {error.message}
          </div>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Configuração dos limites de atraso
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Ajuste os limites para identificar chamados fora do tempo esperado.
          </p>

          <form className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-black text-slate-700">
                Limite para aceite
              </label>

              <input
                name="accept"
                type="number"
                min="1"
                defaultValue={safeAcceptLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Chamado pendente acima desse tempo.
              </p>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">
                Limite para iniciar
              </label>

              <input
                name="start"
                type="number"
                min="1"
                defaultValue={safeStartLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Chamado aceito, mas não iniciado.
              </p>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">
                Limite em transporte
              </label>

              <input
                name="transport"
                type="number"
                min="1"
                defaultValue={safeTransportLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Transporte em andamento acima do esperado.
              </p>
            </div>

            <div className="flex items-end">
              <button className="w-full rounded-xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95">
                Aplicar limites
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Urgentes"
            value={urgentAlerts.length}
            description="Prioridade urgente"
            tone={urgentAlerts.length > 0 ? "danger" : "neutral"}
          />

          <MetricCard
            label="Pendentes"
            value={pendingAlerts.length}
            description="Aguardando aceite"
            tone="gold"
          />

          <MetricCard
            label="Aceitos"
            value={acceptedAlerts.length}
            description="Ainda não iniciados"
            tone="primary"
          />

          <MetricCard
            label="Em transporte"
            value={inTransitAlerts.length}
            description="Em andamento atrasado"
            tone="primary"
          />
        </section>

        {criticalAlerts.length > 0 ? (
          <section className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="text-lg font-black text-red-950">
              Atenção: existem alertas críticos
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-red-800">
              Existem <strong>{criticalAlerts.length}</strong> transporte
              {criticalAlerts.length === 1 ? "" : "s"} com atraso crítico. Dê
              prioridade à análise desses chamados.
            </p>
          </section>
        ) : null}

        {alerts.length === 0 ? (
          <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-lg font-black text-emerald-950">
              Nenhum alerta ativo
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800">
              No momento, nenhum transporte ativo ultrapassou os limites de SLA
              configurados.
            </p>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[1.5rem] border border-red-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">
                    Prioridade máxima
                  </p>

                  <h2 className="mt-2 text-lg font-black text-slate-950">
                    Alertas críticos
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Chamados que precisam de análise imediata.
                  </p>
                </div>

                <p className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                  {criticalAlerts.length} crítico
                  {criticalAlerts.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-5 grid gap-4">
                {criticalAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    Nenhum alerta crítico no momento.
                  </div>
                ) : (
                  criticalAlerts.map((alert) => (
                    <AlertCard key={alert.transport_id} alert={alert} />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[#f2b709]/50 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                    Monitoramento
                  </p>

                  <h2 className="mt-2 text-lg font-black text-slate-950">
                    Alertas em atenção
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Chamados com atraso moderado ou em observação.
                  </p>
                </div>

                <p className="rounded-full bg-[#f2b709]/15 px-3 py-1 text-xs font-black text-slate-900">
                  {warningAlerts.length} alerta
                  {warningAlerts.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-5 grid gap-4">
                {warningAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    Nenhum alerta de atenção no momento.
                  </div>
                ) : (
                  warningAlerts.map((alert) => (
                    <AlertCard key={alert.transport_id} alert={alert} />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}