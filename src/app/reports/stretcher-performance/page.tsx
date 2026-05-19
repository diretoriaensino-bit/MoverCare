import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import StretcherPerformanceChart from "@/components/reports/stretcher-performance-chart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StretcherPerformancePageProps = {
  searchParams?: Promise<{
    period?: string;
  }>;
};

type NumericValue = number | string | null;

type StretcherPerformanceIndicator = {
  profile_id: string;
  professional_name: string;
  professional_email: string;
  total_assigned_count: NumericValue;
  completed_count: NumericValue;
  failed_count: NumericValue;
  cancelled_count: NumericValue;
  avg_start_minutes: NumericValue;
  avg_transport_minutes: NumericValue;
  avg_total_minutes: NumericValue;
};

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" }
];

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
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

function getPeriodLabel(period: string) {
  return (
    periodOptions.find((option) => option.value === period)?.label ??
    "Últimos 30 dias"
  );
}

function getPerformanceLabel(value: NumericValue) {
  if (value === null || value === undefined) {
    return "Sem dados";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Sem dados";
  }

  if (numberValue <= 30) {
    return "Excelente";
  }

  if (numberValue <= 60) {
    return "Bom";
  }

  if (numberValue <= 120) {
    return "Atenção";
  }

  return "Crítico";
}

function getPerformanceClass(value: NumericValue) {
  if (value === null || value === undefined) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (numberValue <= 30) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (numberValue <= 60) {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  if (numberValue <= 120) {
    return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getPerformanceTone(value: NumericValue) {
  if (value === null || value === undefined) {
    return "neutral";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "neutral";
  }

  if (numberValue <= 30) {
    return "success";
  }

  if (numberValue <= 60) {
    return "primary";
  }

  if (numberValue <= 120) {
    return "gold";
  }

  return "danger";
}

function getCompletionRate(completed: NumericValue, assigned: NumericValue) {
  const assignedNumber = toNumber(assigned);
  const completedNumber = toNumber(completed);

  if (assignedNumber <= 0) {
    return "-";
  }

  return `${Math.round((completedNumber / assignedNumber) * 100)}%`;
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

function HighlightCard({
  title,
  professional,
  description,
  tone
}: {
  title: string;
  professional: StretcherPerformanceIndicator | undefined;
  description: string;
  tone: "primary" | "gold" | "success" | "danger";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-[#009da8]/5",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
    success: "border-emerald-200 bg-emerald-50/70",
    danger: "border-red-200 bg-red-50/70"
  }[tone];

  const titleClass = {
    primary: "text-[#009da8]",
    gold: "text-slate-900",
    success: "text-emerald-700",
    danger: "text-red-700"
  }[tone];

  return (
    <section className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}>
      <p className={`text-xs font-black uppercase tracking-[0.2em] ${titleClass}`}>
        {title}
      </p>

      {professional ? (
        <>
          <h2 className="mt-3 text-xl font-black text-slate-950">
            {professional.professional_name}
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-600">
            {professional.professional_email}
          </p>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
            {description}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Ainda não há dados suficientes no período selecionado.
        </p>
      )}
    </section>
  );
}

export default async function StretcherPerformancePage({
  searchParams
}: StretcherPerformancePageProps) {
  const params = await searchParams;

  const selectedPeriod = params?.period || "30";
  const periodDays = Number(selectedPeriod);

  const safePeriodDays =
    Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 30;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_stretcher_performance_indicators_admin",
    {
      p_period_days: safePeriodDays
    }
  );

  const indicators = (data ?? []) as StretcherPerformanceIndicator[];

  const professionalsWithAssigned = indicators.filter(
    (item) => toNumber(item.total_assigned_count) > 0
  );

  const totalAssigned = indicators.reduce(
    (sum, item) => sum + toNumber(item.total_assigned_count),
    0
  );

  const totalCompleted = indicators.reduce(
    (sum, item) => sum + toNumber(item.completed_count),
    0
  );

  const totalFailed = indicators.reduce(
    (sum, item) => sum + toNumber(item.failed_count),
    0
  );

  const totalCancelled = indicators.reduce(
    (sum, item) => sum + toNumber(item.cancelled_count),
    0
  );

  const avgStart =
    professionalsWithAssigned.length > 0
      ? professionalsWithAssigned.reduce(
          (sum, item) => sum + toNumber(item.avg_start_minutes),
          0
        ) / professionalsWithAssigned.length
      : null;

  const avgTransport =
    professionalsWithAssigned.length > 0
      ? professionalsWithAssigned.reduce(
          (sum, item) => sum + toNumber(item.avg_transport_minutes),
          0
        ) / professionalsWithAssigned.length
      : null;

  const avgTotal =
    professionalsWithAssigned.length > 0
      ? professionalsWithAssigned.reduce(
          (sum, item) => sum + toNumber(item.avg_total_minutes),
          0
        ) / professionalsWithAssigned.length
      : null;

  const overallCompletionRate =
    totalAssigned > 0 ? `${Math.round((totalCompleted / totalAssigned) * 100)}%` : "-";

  const bestProfessional = [...professionalsWithAssigned]
    .filter((item) => item.avg_total_minutes !== null)
    .sort(
      (a, b) => toNumber(a.avg_total_minutes) - toNumber(b.avg_total_minutes)
    )[0];

  const mostCompletedProfessional = [...professionalsWithAssigned].sort(
    (a, b) => toNumber(b.completed_count) - toNumber(a.completed_count)
  )[0];

  const mostIncidentProfessional = [...professionalsWithAssigned].sort((a, b) => {
    const incidentsA = toNumber(a.failed_count) + toNumber(a.cancelled_count);
    const incidentsB = toNumber(b.failed_count) + toNumber(b.cancelled_count);

    return incidentsB - incidentsA;
  })[0];

  const professionalsWithIncidents = professionalsWithAssigned.filter(
    (item) => toNumber(item.failed_count) + toNumber(item.cancelled_count) > 0
  );

  const criticalPerformanceCount = professionalsWithAssigned.filter(
    (item) => toNumber(item.avg_total_minutes) > 120
  ).length;

  const pdfHref = `/reports/stretcher-performance/pdf?period=${selectedPeriod}`;

  return (
    <DashboardShell
      title="Desempenho dos maqueiros"
      description="Analise produtividade, falhas e tempos médios por profissional."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Performance operacional
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Indicadores de desempenho por maqueiro
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Acompanhe produtividade, volume de transportes, falhas,
                  cancelamentos e tempos médios por profissional.
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

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Maqueiros"
              value={indicators.length}
              description="Profissionais cadastrados"
              tone="primary"
            />

            <MetricCard
              label="Transportes atribuídos"
              value={totalAssigned}
              description={getPeriodLabel(selectedPeriod)}
              tone="gold"
            />

            <MetricCard
              label="Transportes concluídos"
              value={totalCompleted}
              description={`Taxa geral: ${overallCompletionRate}`}
              tone="success"
            />

            <MetricCard
              label="Falhas/cancelamentos"
              value={totalFailed + totalCancelled}
              description="Eventos críticos no período"
              tone={totalFailed + totalCancelled > 0 ? "danger" : "neutral"}
            />

            <MetricCard
              label="Tempo médio total"
              value={formatMinutes(avgTotal)}
              description="Pedido até conclusão"
              tone={getPerformanceTone(avgTotal)}
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            Erro ao carregar desempenho dos maqueiros: {error.message}
          </div>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Filtro de período
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Escolha o período usado para calcular os indicadores de desempenho.
          </p>

          <form className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full md:max-w-xs">
              <label className="text-sm font-black text-slate-700">
                Período analisado
              </label>

              <select
                name="period"
                defaultValue={selectedPeriod}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="rounded-xl bg-[#009da8] px-5 py-3 text-sm font-black text-white transition hover:brightness-95">
              Aplicar filtro
            </button>

            <Link
              href="/reports/stretcher-performance"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Tempo até iniciar"
            value={formatMinutes(avgStart)}
            description="Após aceite até início"
            tone={getPerformanceTone(avgStart)}
          />

          <MetricCard
            label="Tempo em transporte"
            value={formatMinutes(avgTransport)}
            description="Início até conclusão"
            tone={getPerformanceTone(avgTransport)}
          />

          <MetricCard
            label="Profissionais com eventos"
            value={professionalsWithIncidents.length}
            description="Com falha ou cancelamento"
            tone={professionalsWithIncidents.length > 0 ? "danger" : "success"}
          />

          <MetricCard
            label="Tempo crítico"
            value={criticalPerformanceCount}
            description="Média total acima de 2h"
            tone={criticalPerformanceCount > 0 ? "danger" : "neutral"}
          />
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
              Visualização gráfica
            </p>

            <h2 className="mt-2 text-lg font-black text-slate-950">
              Comparativo de desempenho dos maqueiros
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              Gráfico com produtividade, conclusões, falhas, cancelamentos e
              tempos médios por profissional.
            </p>
          </div>

          <StretcherPerformanceChart indicators={indicators} />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <HighlightCard
            title="Maior volume de conclusões"
            professional={mostCompletedProfessional}
            description={
              mostCompletedProfessional
                ? `${mostCompletedProfessional.professional_name} concluiu ${toNumber(
                    mostCompletedProfessional.completed_count
                  )} transporte${
                    toNumber(mostCompletedProfessional.completed_count) === 1
                      ? ""
                      : "s"
                  } no período selecionado.`
                : "Sem dados suficientes."
            }
            tone="success"
          />

          <HighlightCard
            title="Menor tempo médio total"
            professional={bestProfessional}
            description={
              bestProfessional
                ? `${bestProfessional.professional_name} apresentou o menor tempo médio total: ${formatMinutes(
                    bestProfessional.avg_total_minutes
                  )}.`
                : "Sem dados suficientes."
            }
            tone="primary"
          />

          <HighlightCard
            title="Maior atenção"
            professional={mostIncidentProfessional}
            description={
              mostIncidentProfessional
                ? `${mostIncidentProfessional.professional_name} possui ${toNumber(
                    mostIncidentProfessional.failed_count
                  )} falha${
                    toNumber(mostIncidentProfessional.failed_count) === 1
                      ? ""
                      : "s"
                  } e ${toNumber(mostIncidentProfessional.cancelled_count)} cancelamento${
                    toNumber(mostIncidentProfessional.cancelled_count) === 1
                      ? ""
                      : "s"
                  } no período.`
                : "Sem dados suficientes."
            }
            tone={
              mostIncidentProfessional &&
              toNumber(mostIncidentProfessional.failed_count) +
                toNumber(mostIncidentProfessional.cancelled_count) >
                0
                ? "danger"
                : "gold"
            }
          />
        </div>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Dados detalhados
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Tabela por maqueiro
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Indicadores calculados com base nos transportes atribuídos a
                cada profissional.
              </p>
            </div>

            <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
              {indicators.length} profissional
              {indicators.length === 1 ? "" : "is"}
            </p>
          </div>

          {indicators.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-semibold text-slate-500">
              Nenhum maqueiro encontrado para análise.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-[#009da8]/10 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-black">Maqueiro</th>
                    <th className="px-4 py-3 font-black">Atribuídos</th>
                    <th className="px-4 py-3 font-black">Concluídos</th>
                    <th className="px-4 py-3 font-black">Taxa</th>
                    <th className="px-4 py-3 font-black">Falhas</th>
                    <th className="px-4 py-3 font-black">Cancelados</th>
                    <th className="px-4 py-3 font-black">Até iniciar</th>
                    <th className="px-4 py-3 font-black">Em transporte</th>
                    <th className="px-4 py-3 font-black">Total</th>
                    <th className="px-4 py-3 font-black">Classificação</th>
                  </tr>
                </thead>

                <tbody>
                  {indicators.map((item) => {
                    const incidents =
                      toNumber(item.failed_count) + toNumber(item.cancelled_count);

                    return (
                      <tr
                        key={item.profile_id}
                        className="border-t border-slate-200 text-slate-700"
                      >
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-950">
                            {item.professional_name}
                          </p>

                          <p className="text-xs font-semibold text-slate-500">
                            {item.professional_email}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-black text-slate-950">
                          {toNumber(item.total_assigned_count)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {toNumber(item.completed_count)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {getCompletionRate(
                            item.completed_count,
                            item.total_assigned_count
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              toNumber(item.failed_count) > 0
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {toNumber(item.failed_count)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              toNumber(item.cancelled_count) > 0
                                ? "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {toNumber(item.cancelled_count)}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {formatMinutes(item.avg_start_minutes)}
                        </td>

                        <td className="px-4 py-3 font-semibold">
                          {formatMinutes(item.avg_transport_minutes)}
                        </td>

                        <td className="px-4 py-3 font-black text-slate-950">
                          {formatMinutes(item.avg_total_minutes)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${getPerformanceClass(
                              item.avg_total_minutes
                            )}`}
                          >
                            {incidents > 0
                              ? `${getPerformanceLabel(
                                  item.avg_total_minutes
                                )} · ${incidents} evento${
                                  incidents === 1 ? "" : "s"
                                }`
                              : getPerformanceLabel(item.avg_total_minutes)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}