import Link from "next/link";
import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    priority?: string;
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

type TransportReportRow = {
  id: string;
  patient_code: string;
  status: string;
  priority: string;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  assigned_to: string | null;
  origin: SectorRelation | SectorRelation[] | null;
  destination: SectorRelation | SectorRelation[] | null;
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

function getFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function countByStatus(transports: TransportReportRow[], status: string) {
  return transports.filter((transport) => transport.status === status).length;
}

function calculateCompletionRate(transports: TransportReportRow[]) {
  if (transports.length === 0) {
    return 0;
  }

  const completed = countByStatus(transports, "completed");

  return Math.round((completed / transports.length) * 100);
}

function calculateAverageMinutes(
  transports: TransportReportRow[],
  startField: "requested_at" | "started_at",
  endField: "completed_at"
) {
  const validRows = transports.filter((transport) => {
    return (
      transport.status === "completed" &&
      transport[startField] &&
      transport[endField]
    );
  });

  if (validRows.length === 0) {
    return null;
  }

  const totalMinutes = validRows.reduce((total, transport) => {
    const start = new Date(transport[startField] as string).getTime();
    const end = new Date(transport[endField] as string).getTime();

    const diff = Math.max(0, Math.round((end - start) / 1000 / 60));

    return total + diff;
  }, 0);

  return Math.round(totalMinutes / validRows.length);
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) {
    return "-";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remaining}min`;
}

function groupByStatus(transports: TransportReportRow[]) {
  const statuses = [
    "pending",
    "accepted",
    "in_transit",
    "completed",
    "cancelled",
    "failed"
  ];

  return statuses.map((status) => ({
    key: status,
    label: statusLabels[status] ?? status,
    total: countByStatus(transports, status)
  }));
}

function groupByPriority(transports: TransportReportRow[]) {
  return ["normal", "urgent"].map((priority) => ({
    key: priority,
    label: priorityLabels[priority] ?? priority,
    total: transports.filter((transport) => transport.priority === priority)
      .length
  }));
}

function groupByOriginSector(transports: TransportReportRow[]) {
  const map = new Map<string, number>();

  transports.forEach((transport) => {
    const origin = getFirstRelation(transport.origin);
    const name = origin?.name ?? "Sem origem";

    map.set(name, (map.get(name) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function groupByDestinationSector(transports: TransportReportRow[]) {
  const map = new Map<string, number>();

  transports.forEach((transport) => {
    const destination = getFirstRelation(transport.destination);
    const name = destination?.name ?? "Sem destino";

    map.set(name, (map.get(name) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function groupProductivityByAssignee(transports: TransportReportRow[]) {
  const map = new Map<string, number>();

  transports.forEach((transport) => {
    if (transport.status !== "completed") {
      return;
    }

    const assignee = getFirstRelation(transport.assignee);
    const name = assignee?.name ?? "Sem responsável";

    map.set(name, (map.get(name) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
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

function StatCard({
  title,
  value,
  description,
  tone = "primary"
}: {
  title: string;
  value: string | number;
  description: string;
  tone?: "primary" | "gold" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-white",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
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
          <p className="text-sm font-black text-slate-500">{title}</p>

          <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </h3>
        </div>

        <span className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
      </div>

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function QuickReportCard({
  href,
  title,
  description,
  action,
  tone = "primary"
}: {
  href: string;
  title: string;
  description: string;
  action: string;
  tone?: "primary" | "gold" | "danger" | "neutral";
}) {
  const className = {
    primary:
      "border-[#009da8]/25 bg-white hover:border-[#009da8]/60 hover:bg-[#009da8]/5",
    gold:
      "border-[#f2b709]/50 bg-[#f2b709]/10 hover:border-[#f2b709] hover:bg-[#f2b709]/20",
    danger:
      "border-red-200 bg-red-50/70 hover:border-red-400 hover:bg-red-50",
    neutral:
      "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
  }[tone];

  const actionClass = {
    primary: "text-[#009da8]",
    gold: "text-slate-900",
    danger: "text-red-700",
    neutral: "text-slate-700"
  }[tone];

  return (
    <Link
      href={href}
      className={`rounded-[1.35rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      <h2 className="text-lg font-black text-slate-950">{title}</h2>

      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      <p className={`mt-4 text-sm font-black ${actionClass}`}>{action}</p>
    </Link>
  );
}

function BarList({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: {
    name?: string;
    label?: string;
    total: number;
  }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.total));

  return (
    <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>

      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-6 text-center">
          <p className="text-sm font-semibold text-slate-500">
            Nenhum dado encontrado.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const label = item.label ?? item.name ?? "Sem nome";
            const width = Math.round((item.total / max) * 100);

            return (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-700">{label}</p>

                  <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
                    {item.total}
                  </p>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#009da8]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{title}</h3>

      {description ? (
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      ) : null}

      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const canViewReports = profile.role === "manager" || profile.role === "admin";

  if (!canViewReports) {
    return (
      <DashboardShell
        title="Relatórios"
        description="Análises gerenciais do transporte intra-hospitalar."
        userName={profile.name}
        userRole={profile.role}
      >
        <div className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">
            Acesso restrito
          </h3>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Esta área é destinada a gestores e administradores.
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

  let query = supabase
    .from("transports")
    .select(
      `
        id,
        patient_code,
        status,
        priority,
        requested_at,
        accepted_at,
        started_at,
        completed_at,
        cancelled_at,
        assigned_to,
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
        assignee:assigned_to (
          id,
          name,
          role
        )
      `
    )
    .eq("hospital_id", profile.hospital_id)
    .order("requested_at", { ascending: false });

  if (params.from) {
    query = query.gte("requested_at", `${params.from}T00:00:00.000`);
  }

  if (params.to) {
    query = query.lte("requested_at", `${params.to}T23:59:59.999`);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.priority && params.priority !== "all") {
    query = query.eq("priority", params.priority);
  }

  const { data, error } = await query;

  const transports = (data ?? []) as TransportReportRow[];

  const total = transports.length;
  const completed = countByStatus(transports, "completed");
  const cancelled = countByStatus(transports, "cancelled");
  const failed = countByStatus(transports, "failed");
  const urgent = transports.filter(
    (transport) => transport.priority === "urgent"
  ).length;

  const completionRate = calculateCompletionRate(transports);

  const averageTotalTime = calculateAverageMinutes(
    transports,
    "requested_at",
    "completed_at"
  );

  const averageTransportTime = calculateAverageMinutes(
    transports,
    "started_at",
    "completed_at"
  );

  const statusDistribution = groupByStatus(transports);
  const priorityDistribution = groupByPriority(transports);
  const originSectors = groupByOriginSector(transports);
  const destinationSectors = groupByDestinationSector(transports);
  const productivity = groupProductivityByAssignee(transports);

  const recentCancelledOrFailed = transports
    .filter((transport) => ["cancelled", "failed"].includes(transport.status))
    .slice(0, 8);

  return (
    <DashboardShell
      title="Relatórios"
      description="Análises gerenciais do transporte intra-hospitalar."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Inteligência operacional
                </p>

                <h3 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Relatórios operacionais
                </h3>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Filtre chamados por período, status e prioridade para analisar
                  produtividade, tempos médios, setores, cancelamentos e falhas.
                </p>
              </div>

              <Link
                href="/manager"
                className="inline-flex w-fit rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
              >
                Voltar ao dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <QuickReportCard
              href="/reports/monthly"
              title="Relatórios mensais"
              description="Gere, consulte e exporte relatórios consolidados por mês."
              action="Abrir relatórios mensais →"
              tone="primary"
            />

            <QuickReportCard
              href="/reports/sla-alerts"
              title="Alertas de SLA"
              description="Monitore chamados que ultrapassaram o tempo esperado."
              action="Abrir alertas →"
              tone="danger"
            />

            <QuickReportCard
              href="/reports/sector-time-indicators"
              title="Indicadores por setor"
              description="Analise tempos médios por setor de origem e destino."
              action="Abrir indicadores →"
              tone="gold"
            />

            <QuickReportCard
              href="/reports/transport-audit"
              title="Auditoria dos transportes"
              description="Consulte criação, aceite, início, conclusão e falhas."
              action="Abrir auditoria →"
              tone="neutral"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 shadow-sm">
            Não foi possível carregar os relatórios: {error.message}
          </div>
        ) : null}

        <form className="grid gap-4 rounded-[1.5rem] border border-[#009da8]/20 bg-white p-5 shadow-sm md:grid-cols-5">
          <div>
            <label
              htmlFor="from"
              className="block text-sm font-black text-slate-700"
            >
              Data inicial
            </label>

            <input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            />
          </div>

          <div>
            <label
              htmlFor="to"
              className="block text-sm font-black text-slate-700"
            >
              Data final
            </label>

            <input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
            />
          </div>

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

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="w-full rounded-xl bg-[#009da8] px-4 py-3 text-sm font-black text-white transition hover:brightness-95"
            >
              Filtrar
            </button>

            <Link
              href="/reports"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total de transportes"
            value={total}
            description="Total encontrado dentro dos filtros."
            tone="primary"
          />

          <StatCard
            title="Concluídos"
            value={completed}
            description="Transportes finalizados com sucesso."
            tone="success"
          />

          <StatCard
            title="Taxa de conclusão"
            value={`${completionRate}%`}
            description="Concluídos em relação ao total filtrado."
            tone="gold"
          />

          <StatCard
            title="Tempo médio total"
            value={formatMinutes(averageTotalTime)}
            description="Da solicitação até a conclusão."
            tone="neutral"
          />

          <StatCard
            title="Tempo médio em transporte"
            value={formatMinutes(averageTransportTime)}
            description="Do início do transporte até a conclusão."
            tone="neutral"
          />

          <StatCard
            title="Urgentes"
            value={urgent}
            description="Chamados marcados como urgentes."
            tone="danger"
          />

          <StatCard
            title="Cancelados"
            value={cancelled}
            description="Chamados cancelados no período filtrado."
            tone="danger"
          />

          <StatCard
            title="Falhas"
            value={failed}
            description="Transportes marcados como falha."
            tone="danger"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <BarList
            title="Quantidade por status"
            description="Distribuição dos transportes por situação atual."
            items={statusDistribution}
          />

          <BarList
            title="Quantidade por prioridade"
            description="Comparativo entre chamados normais e urgentes."
            items={priorityDistribution}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <BarList
            title="Transportes por setor de origem"
            description="Setores que mais solicitaram saídas de pacientes."
            items={originSectors}
          />

          <BarList
            title="Transportes por setor de destino"
            description="Setores que mais receberam pacientes."
            items={destinationSectors}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <BarList
            title="Produtividade por maqueiro"
            description="Quantidade de transportes concluídos por responsável."
            items={productivity}
          />

          <SectionCard
            title="Cancelamentos e falhas recentes"
            description="Últimos chamados com status cancelado ou falha."
          >
            {recentCancelledOrFailed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-6 text-center">
                <p className="text-sm font-semibold text-slate-500">
                  Nenhum cancelamento ou falha encontrado.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-[#009da8]/10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black uppercase text-slate-600">
                        Paciente
                      </th>

                      <th className="px-4 py-3 text-xs font-black uppercase text-slate-600">
                        Status
                      </th>

                      <th className="px-4 py-3 text-xs font-black uppercase text-slate-600">
                        Data
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {recentCancelledOrFailed.map((transport) => (
                      <tr key={transport.id}>
                        <td className="px-4 py-3 text-sm font-black text-slate-950">
                          {transport.patient_code}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                          {statusLabels[transport.status] ?? transport.status}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                          {formatDate(
                            transport.cancelled_at ??
                              transport.completed_at ??
                              transport.requested_at
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}