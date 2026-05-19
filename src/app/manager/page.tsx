import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { RealtimeTransportsRefresh } from "@/components/realtime/realtime-transports-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransportStatus =
  | "pending"
  | "accepted"
  | "in_transit"
  | "completed"
  | "cancelled"
  | "failed";

type ManagerSlaAlert = {
  transport_id: string;
  patient_code: string;
  priority: string;
  status: string;
  elapsed_minutes: number | string | null;
  alert_level: string;
  alert_message: string;
};

type HospitalSlaSettings = {
  sla_accept_limit_minutes?: number;
  sla_start_limit_minutes?: number;
  sla_transport_limit_minutes?: number;
};

type RecentTransport = {
  id: string;
  patient_code: string;
  priority: string;
  status: string;
  created_at: string | null;
};

const statusLabels: Record<TransportStatus, string> = {
  pending: "Pendentes",
  accepted: "Aceitos",
  in_transit: "Em transporte",
  completed: "Concluídos",
  cancelled: "Cancelados",
  failed: "Falhas"
};

function getStatusLabel(status: string) {
  return statusLabels[status as TransportStatus] ?? status;
}

function getPriorityLabel(priority: string) {
  return priority === "urgent" ? "Urgente" : "Normal";
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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
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
  tone?: "primary" | "gold" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-white",
    gold: "border-[#f2b709]/40 bg-[#f2b709]/10",
    success: "border-emerald-200 bg-emerald-50/70",
    danger: "border-red-200 bg-red-50/70",
    neutral: "border-slate-200 bg-white"
  }[tone];

  const dotClass = {
    primary: "bg-[#009da8]",
    gold: "bg-[#f2b709]",
    success: "bg-emerald-500",
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

function ProgressCard({
  label,
  value,
  total,
  description
}: {
  label: string;
  value: number;
  total: number;
  description: string;
}) {
  const percentage = getPercentage(value, total);

  return (
    <div className="rounded-[1.35rem] border border-[#009da8]/20 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>

          <p className="mt-2 text-2xl font-black text-slate-950">
            {percentage}%
          </p>
        </div>

        <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
          {value}/{total}
        </p>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#009da8]"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

async function countTransportsByStatus({
  supabase,
  hospitalId,
  status
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  hospitalId: string;
  status?: TransportStatus;
}) {
  let query = supabase
    .from("transports")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", hospitalId);

  if (status) {
    query = query.eq("status", status);
  }

  const { count } = await query;

  return count ?? 0;
}

export default async function ManagerDashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [
    totalTransports,
    pendingTransports,
    acceptedTransports,
    inTransitTransports,
    completedTransports,
    cancelledTransports,
    failedTransports,
    pendingAccessResult,
    slaSettingsResult
  ] = await Promise.all([
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "pending"
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "accepted"
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "in_transit"
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "completed"
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "cancelled"
    }),
    countTransportsByStatus({
      supabase,
      hospitalId: profile.hospital_id,
      status: "failed"
    }),
    supabase
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", profile.hospital_id)
      .eq("status", "pending"),
    supabase.rpc("get_hospital_sla_settings_admin")
  ]);

  const pendingRequests = pendingAccessResult.count ?? 0;
  const activeTransports =
    pendingTransports + acceptedTransports + inTransitTransports;

  const slaSettings = (slaSettingsResult.data ?? {}) as HospitalSlaSettings;

  const slaAcceptLimit = Number(slaSettings.sla_accept_limit_minutes ?? 10);
  const slaStartLimit = Number(slaSettings.sla_start_limit_minutes ?? 15);
  const slaTransportLimit = Number(
    slaSettings.sla_transport_limit_minutes ?? 60
  );

  const { data: slaAlertsData } = await supabase.rpc(
    "get_transport_sla_alerts_admin",
    {
      p_accept_limit_minutes: slaAcceptLimit,
      p_start_limit_minutes: slaStartLimit,
      p_transport_limit_minutes: slaTransportLimit
    }
  );

  const slaAlerts = (slaAlertsData ?? []) as ManagerSlaAlert[];

  const criticalSlaAlerts = slaAlerts.filter(
    (alert) => alert.alert_level === "critical"
  );

  const warningSlaAlerts = slaAlerts.filter(
    (alert) => alert.alert_level !== "critical"
  );

  const { data: recentTransportsData } = await supabase
    .from("transports")
    .select("id, patient_code, priority, status, created_at")
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: false })
    .limit(8);

  const recentTransports = (recentTransportsData ?? []) as RecentTransport[];

  return (
    <DashboardShell
      title="Painel Gestor"
      description="Acompanhe indicadores, transportes, alertas de SLA e relatórios do hospital."
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
                  Central de gestão hospitalar
                </p>

                <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Operação de transportes em tempo real
                </h2>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Monitore chamados, SLA, produtividade e rastreabilidade dos
                  transportes intra-hospitalares do HUSF.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex">
                <Link
                  href="/transports"
                  className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-[#009da8] shadow-sm transition hover:bg-slate-50"
                >
                  Ver chamados
                </Link>

                <Link
                  href="/reports"
                  className="rounded-2xl bg-[#f2b709] px-5 py-3 text-center text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
                >
                  Relatórios
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <ProgressCard
              label="Concluídos"
              value={completedTransports}
              total={totalTransports}
              description="Proporção de transportes finalizados."
            />

            <ProgressCard
              label="Ativos"
              value={activeTransports}
              total={totalTransports}
              description="Pendentes, aceitos ou em transporte."
            />

            <ProgressCard
              label="Intercorrências"
              value={failedTransports + cancelledTransports}
              total={totalTransports}
              description="Falhas e cancelamentos registrados."
            />
          </div>
        </section>

        {slaAlerts.length > 0 ? (
          <div
            className={`rounded-[1.5rem] border p-5 shadow-sm ${
              criticalSlaAlerts.length > 0
                ? "border-red-200 bg-red-50"
                : "border-[#f2b709]/50 bg-[#f2b709]/10"
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2
                  className={`text-lg font-black ${
                    criticalSlaAlerts.length > 0
                      ? "text-red-950"
                      : "text-slate-950"
                  }`}
                >
                  Alertas de SLA ativos
                </h2>

                <p
                  className={`mt-1 text-sm font-semibold leading-6 ${
                    criticalSlaAlerts.length > 0
                      ? "text-red-800"
                      : "text-slate-700"
                  }`}
                >
                  Existem <strong>{slaAlerts.length}</strong> transporte
                  {slaAlerts.length === 1 ? "" : "s"} fora do tempo esperado.
                  {criticalSlaAlerts.length > 0 ? (
                    <>
                      {" "}
                      <strong>{criticalSlaAlerts.length}</strong> em nível
                      crítico.
                    </>
                  ) : (
                    <>
                      {" "}
                      <strong>{warningSlaAlerts.length}</strong> em atenção.
                    </>
                  )}
                </p>
              </div>

              <Link
                href="/reports/sla-alerts"
                className={`w-fit rounded-2xl px-5 py-3 text-sm font-black text-white transition ${
                  criticalSlaAlerts.length > 0
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#009da8] hover:brightness-95"
                }`}
              >
                Ver alertas
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-[#009da8]/25 bg-[#009da8]/10 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Nenhum alerta de SLA ativo
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Todos os transportes ativos estão dentro dos limites
                  configurados.
                </p>
              </div>

              <Link
                href="/reports/sla-alerts"
                className="w-fit rounded-2xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95"
              >
                Ver monitoramento
              </Link>
            </div>
          </div>
        )}

        {pendingRequests > 0 ? (
          <div className="rounded-[1.5rem] border border-[#f2b709]/50 bg-[#f2b709]/10 p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  Solicitações de acesso pendentes
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  Existem {pendingRequests} solicitação
                  {pendingRequests === 1 ? "" : "ões"} aguardando aprovação.
                </p>
              </div>

              <Link
                href="/settings/users/requests"
                className="w-fit rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-95"
              >
                Analisar solicitações
              </Link>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total de transportes"
            value={totalTransports}
            description="Todos os registros do hospital"
            tone="primary"
          />

          <MetricCard
            label={statusLabels.pending}
            value={pendingTransports}
            description="Aguardando aceite"
            tone="gold"
          />

          <MetricCard
            label={statusLabels.accepted}
            value={acceptedTransports}
            description="Aceitos por maqueiros"
            tone="primary"
          />

          <MetricCard
            label={statusLabels.in_transit}
            value={inTransitTransports}
            description="Transportes em andamento"
            tone="primary"
          />

          <MetricCard
            label={statusLabels.completed}
            value={completedTransports}
            description="Transportes finalizados"
            tone="success"
          />

          <MetricCard
            label={statusLabels.cancelled}
            value={cancelledTransports}
            description="Chamados cancelados"
            tone="danger"
          />

          <MetricCard
            label={statusLabels.failed}
            value={failedTransports}
            description="Falhas registradas"
            tone="danger"
          />

          <MetricCard
            label="Alertas de SLA"
            value={slaAlerts.length}
            description="Transportes fora do tempo esperado"
            tone={slaAlerts.length > 0 ? "danger" : "success"}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Limite para aceite"
            value={`${slaAcceptLimit} min`}
            description="Chamado pendente aguardando maqueiro"
            tone="neutral"
          />

          <MetricCard
            label="Limite para iniciar"
            value={`${slaStartLimit} min`}
            description="Chamado aceito ainda não iniciado"
            tone="neutral"
          />

          <MetricCard
            label="Limite em transporte"
            value={`${slaTransportLimit} min`}
            description="Transporte iniciado ainda não concluído"
            tone="neutral"
          />
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Gestão rápida
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Acessos rápidos
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Atalhos para relatórios, auditorias e configurações principais.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/transports"
              className="rounded-2xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95"
            >
              Ver chamados
            </Link>

            <Link
              href="/reports/sla-alerts"
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
            >
              Alertas de SLA
            </Link>

            <Link
              href="/reports/sector-time-indicators"
              className="rounded-2xl border border-[#009da8]/30 bg-white px-5 py-3 text-sm font-black text-[#009da8] transition hover:bg-[#009da8]/10"
            >
              Indicadores por setor
            </Link>

            <Link
              href="/reports/stretcher-performance"
              className="rounded-2xl border border-[#f2b709]/50 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-[#f2b709]/10"
            >
              Desempenho dos maqueiros
            </Link>

            <Link
              href="/reports/transport-audit"
              className="rounded-2xl border border-[#009da8]/30 bg-white px-5 py-3 text-sm font-black text-[#009da8] transition hover:bg-[#009da8]/10"
            >
              Auditoria dos transportes
            </Link>

            <Link
              href="/settings/sla"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Configurar SLA
            </Link>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Chamados recentes
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Transportes recentes
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Últimos chamados registrados no hospital.
              </p>
            </div>

            <Link
              href="/transports"
              className="text-sm font-black text-[#009da8] hover:brightness-75"
            >
              Ver todos →
            </Link>
          </div>

          {recentTransports.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              Nenhum transporte encontrado.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#009da8]/10 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-black">Paciente</th>
                    <th className="px-4 py-3 font-black">Prioridade</th>
                    <th className="px-4 py-3 font-black">Status</th>
                    <th className="px-4 py-3 font-black">Criado em</th>
                    <th className="px-4 py-3 font-black">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {recentTransports.map((transport) => (
                    <tr
                      key={transport.id}
                      className="border-t border-slate-200 text-slate-700"
                    >
                      <td className="px-4 py-3 font-black text-slate-950">
                        {transport.patient_code}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            transport.priority === "urgent"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {getPriorityLabel(transport.priority)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusBadgeClass(
                            transport.status
                          )}`}
                        >
                          {getStatusLabel(transport.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {formatDate(transport.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={`/transports/${transport.id}`}
                          className="font-black text-[#009da8] hover:brightness-75"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}