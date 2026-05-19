import Link from "next/link";
import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  cleanupOldRecordsAction,
  generateMonthlyReportAction
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MonthlyReportsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type ReportGroupItem = {
  status?: string;
  priority?: string;
  sector_name?: string;
  stretcher_bearer_name?: string;
  total?: number;
  completed?: number;
  failed?: number;
};

type MonthlyReport = {
  id: string;
  report_year: number;
  report_month: number;
  period_start: string;
  period_end: string;
  total_transports: number;
  completed_transports: number;
  cancelled_transports: number;
  failed_transports: number;
  urgent_transports: number;
  completion_rate: number;
  average_total_minutes: number | null;
  average_transport_minutes: number | null;
  by_status: ReportGroupItem[] | null;
  by_priority: ReportGroupItem[] | null;
  by_origin_sector: ReportGroupItem[] | null;
  by_destination_sector: ReportGroupItem[] | null;
  by_stretcher_bearer: ReportGroupItem[] | null;
  generated_at: string;
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatMinutes(value: number | null | undefined) {
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

function getGroupLabel(
  item: ReportGroupItem,
  labelKey: "status" | "priority" | "sector_name" | "stretcher_bearer_name"
) {
  const rawValue = item[labelKey];

  if (!rawValue) {
    return "Não informado";
  }

  if (labelKey === "status") {
    return statusLabels[rawValue] ?? rawValue;
  }

  if (labelKey === "priority") {
    return priorityLabels[rawValue] ?? rawValue;
  }

  return rawValue;
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

function SectionCard({
  title,
  description,
  children,
  tone = "primary"
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "primary" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-white"
      : "border-[#009da8]/20 bg-white";

  return (
    <section className={`rounded-[1.5rem] border p-6 shadow-sm ${toneClass}`}>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>

      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}

function GroupList({
  title,
  items,
  labelKey
}: {
  title: string;
  items: ReportGroupItem[] | null;
  labelKey: "status" | "priority" | "sector_name" | "stretcher_bearer_name";
}) {
  const list = items ?? [];
  const max = Math.max(1, ...list.map((item) => item.total ?? 0));

  return (
    <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-5 shadow-sm">
      <h3 className="text-base font-black text-slate-950">{title}</h3>

      {list.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-semibold text-slate-500">
          Sem dados para exibir.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {list.slice(0, 8).map((item, index) => {
            const total = item.total ?? 0;
            const width = Math.round((total / max) * 100);

            return (
              <div
                key={`${title}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {getGroupLabel(item, labelKey)}
                    </p>

                    {item.completed !== undefined ||
                    item.failed !== undefined ? (
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Concluídos: {item.completed ?? 0} · Falhas:{" "}
                        {item.failed ?? 0}
                      </p>
                    ) : null}
                  </div>

                  <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
                    {total}
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
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

export default async function MonthlyReportsPage({
  searchParams
}: MonthlyReportsPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();

  const currentDate = new Date();
  const defaultYear = currentDate.getFullYear();
  const defaultMonth = currentDate.getMonth() + 1;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const defaultCleanupDate = sixMonthsAgo.toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: reportsData } = await supabase
    .from("monthly_reports")
    .select(
      `
      id,
      report_year,
      report_month,
      period_start,
      period_end,
      total_transports,
      completed_transports,
      cancelled_transports,
      failed_transports,
      urgent_transports,
      completion_rate,
      average_total_minutes,
      average_transport_minutes,
      by_status,
      by_priority,
      by_origin_sector,
      by_destination_sector,
      by_stretcher_bearer,
      generated_at
    `
    )
    .eq("hospital_id", profile.hospital_id)
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false })
    .limit(24);

  const reports = (reportsData ?? []) as MonthlyReport[];
  const latestReport = reports[0];

  return (
    <DashboardShell
      title="Relatórios mensais"
      description="Gere resumos mensais, baixe PDFs e faça limpeza segura de registros antigos."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Fechamento mensal
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Relatórios mensais do MoverCare
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Consolide os transportes do mês, acompanhe indicadores,
                  gere PDF gerencial e mantenha o banco limpo com segurança.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {latestReport ? (
                  <Link
                    href={`/reports/monthly/${latestReport.id}/pdf`}
                    className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-[#009da8] shadow-sm transition hover:bg-slate-50"
                  >
                    Baixar último PDF
                  </Link>
                ) : null}

                <Link
                  href="/reports"
                  className="rounded-2xl bg-[#f2b709] px-5 py-3 text-center text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
                >
                  Voltar aos relatórios
                </Link>
              </div>
            </div>
          </div>

          {latestReport ? (
            <div className="grid gap-4 p-5 md:grid-cols-4">
              <MetricCard
                label="Último período"
                value={`${monthNames[latestReport.report_month - 1]}/${latestReport.report_year}`}
                description="Relatório mensal mais recente"
                tone="primary"
              />

              <MetricCard
                label="Total"
                value={latestReport.total_transports}
                description="Transportes no último relatório"
                tone="gold"
              />

              <MetricCard
                label="Taxa de conclusão"
                value={`${formatNumber(latestReport.completion_rate)}%`}
                description="Conclusões no período"
                tone="success"
              />

              <MetricCard
                label="Falhas"
                value={latestReport.failed_transports}
                description="Transportes com falha"
                tone={latestReport.failed_transports > 0 ? "danger" : "neutral"}
              />
            </div>
          ) : null}
        </section>

        {params?.success ? (
          <div className="rounded-2xl border border-[#009da8]/25 bg-[#009da8]/10 p-4 text-sm font-bold text-[#007983] shadow-sm">
            {params.success}
          </div>
        ) : null}

        {params?.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            {params.error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Gerar relatório mensal"
            description="Escolha o mês e o ano. Se já existir relatório para o período, ele será atualizado."
          >
            <form action={generateMonthlyReportAction} className="space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">Ano</label>

                <input
                  name="report_year"
                  type="number"
                  min="2020"
                  max="2100"
                  defaultValue={defaultYear}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
                />
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">Mês</label>

                <select
                  name="report_month"
                  defaultValue={defaultMonth}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
                >
                  {monthNames.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              <button className="w-full rounded-xl bg-[#009da8] px-4 py-3 text-sm font-black text-white transition hover:brightness-95">
                Gerar relatório
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Limpeza segura"
            description="Remove somente registros finalizados antigos: concluídos, cancelados e falhas. Chamados ativos nunca são apagados."
            tone="danger"
          >
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              Por segurança, o banco só permite limpar registros com mais de 90
              dias.
            </div>

            <form action={cleanupOldRecordsAction} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">
                  Apagar finalizados antes de
                </label>

                <input
                  name="before_date"
                  type="date"
                  defaultValue={defaultCleanupDate}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">
                  Confirmação
                </label>

                <input
                  name="confirmation"
                  placeholder="Digite CONFIRMAR"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              <button className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700">
                Limpar registros antigos
              </button>
            </form>
          </SectionCard>
        </div>

        {latestReport ? (
          <>
            <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                    Último fechamento
                  </p>

                  <h2 className="mt-2 text-xl font-black text-slate-950">
                    {monthNames[latestReport.report_month - 1]} de{" "}
                    {latestReport.report_year}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Período {formatDate(latestReport.period_start)} até{" "}
                    {formatDate(latestReport.period_end)}
                  </p>
                </div>

                <Link
                  href={`/reports/monthly/${latestReport.id}/pdf`}
                  className="rounded-2xl bg-[#f2b709] px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:brightness-95"
                >
                  Baixar PDF deste relatório
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Total"
                  value={latestReport.total_transports}
                  description="Transportes solicitados no período"
                  tone="primary"
                />

                <MetricCard
                  label="Concluídos"
                  value={latestReport.completed_transports}
                  description="Transportes finalizados com sucesso"
                  tone="success"
                />

                <MetricCard
                  label="Taxa de conclusão"
                  value={`${formatNumber(latestReport.completion_rate)}%`}
                  description="Percentual de transportes concluídos"
                  tone="gold"
                />

                <MetricCard
                  label="Tempo médio total"
                  value={formatMinutes(latestReport.average_total_minutes)}
                  description="Da solicitação até a conclusão"
                  tone="neutral"
                />

                <MetricCard
                  label="Tempo em transporte"
                  value={formatMinutes(latestReport.average_transport_minutes)}
                  description="Do início até a conclusão"
                  tone="neutral"
                />

                <MetricCard
                  label="Urgentes"
                  value={latestReport.urgent_transports}
                  description="Chamados de alta prioridade"
                  tone="danger"
                />

                <MetricCard
                  label="Cancelados"
                  value={latestReport.cancelled_transports}
                  description="Solicitações canceladas"
                  tone="danger"
                />

                <MetricCard
                  label="Falhas"
                  value={latestReport.failed_transports}
                  description="Transportes marcados com falha"
                  tone="danger"
                />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <GroupList
                title="Por status"
                items={latestReport.by_status}
                labelKey="status"
              />

              <GroupList
                title="Por prioridade"
                items={latestReport.by_priority}
                labelKey="priority"
              />

              <GroupList
                title="Setores de origem"
                items={latestReport.by_origin_sector}
                labelKey="sector_name"
              />

              <GroupList
                title="Setores de destino"
                items={latestReport.by_destination_sector}
                labelKey="sector_name"
              />

              <GroupList
                title="Produtividade por maqueiro"
                items={latestReport.by_stretcher_bearer}
                labelKey="stretcher_bearer_name"
              />
            </div>
          </>
        ) : (
          <section className="rounded-[1.5rem] border border-dashed border-[#009da8]/30 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              Nenhum relatório mensal gerado ainda
            </h2>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Gere o primeiro relatório mensal usando o formulário acima.
            </p>
          </section>
        )}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Relatórios gerados
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Histórico dos fechamentos mensais disponíveis para PDF.
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#009da8]/10 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-black">Período</th>
                  <th className="px-4 py-3 font-black">Total</th>
                  <th className="px-4 py-3 font-black">Concluídos</th>
                  <th className="px-4 py-3 font-black">Taxa</th>
                  <th className="px-4 py-3 font-black">Gerado em</th>
                  <th className="px-4 py-3 font-black">PDF</th>
                </tr>
              </thead>

              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 font-semibold text-slate-500"
                      colSpan={6}
                    >
                      Nenhum relatório encontrado.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-t border-slate-200 text-slate-700"
                    >
                      <td className="px-4 py-3 font-black text-slate-950">
                        {monthNames[report.report_month - 1]} /{" "}
                        {report.report_year}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {report.total_transports}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {report.completed_transports}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatNumber(report.completion_rate)}%
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatDate(report.generated_at)}
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={`/reports/monthly/${report.id}/pdf`}
                          className="rounded-xl bg-[#009da8] px-3 py-2 text-xs font-black text-white transition hover:brightness-95"
                        >
                          Baixar
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}