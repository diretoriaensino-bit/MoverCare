import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import SectorTimeIndicatorsChart from "@/components/reports/sector-time-indicators-chart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SectorTimeIndicatorsPageProps = {
  searchParams?: Promise<{
    period?: string;
  }>;
};

type SectorTimeIndicator = {
  sector_id: string;
  sector_name: string;
  sector_floor: string | null;
  completed_count: number;
  avg_accept_minutes: number | null;
  avg_start_minutes: number | null;
  avg_transport_minutes: number | null;
  avg_total_minutes: number | null;
};

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" }
];

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

function getPerformanceLabel(value: number | null) {
  if (value === null || value === undefined) {
    return "Sem dados";
  }

  if (value <= 15) {
    return "Excelente";
  }

  if (value <= 30) {
    return "Bom";
  }

  if (value <= 60) {
    return "Atenção";
  }

  return "Crítico";
}

function getPerformanceClass(value: number | null) {
  if (value === null || value === undefined) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  if (value <= 15) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value <= 30) {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  if (value <= 60) {
    return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getPerformanceTone(value: number | null) {
  if (value === null || value === undefined) {
    return "neutral";
  }

  if (value <= 15) {
    return "success";
  }

  if (value <= 30) {
    return "primary";
  }

  if (value <= 60) {
    return "gold";
  }

  return "danger";
}

function getPeriodLabel(period: string) {
  return (
    periodOptions.find((option) => option.value === period)?.label ??
    "Últimos 30 dias"
  );
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

function SectorHighlightCard({
  title,
  sector,
  description,
  tone
}: {
  title: string;
  sector: SectorTimeIndicator | undefined;
  description: string;
  tone: "gold" | "danger" | "success";
}) {
  const toneClass = {
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
    danger: "border-red-200 bg-red-50/70",
    success: "border-emerald-200 bg-emerald-50/70"
  }[tone];

  const textClass = {
    gold: "text-slate-900",
    danger: "text-red-700",
    success: "text-emerald-700"
  }[tone];

  return (
    <section className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}>
      <p className={`text-xs font-black uppercase tracking-[0.2em] ${textClass}`}>
        {title}
      </p>

      {sector ? (
        <>
          <h2 className="mt-3 text-xl font-black text-slate-950">
            {sector.sector_name}
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-600">
            {sector.sector_floor || "Sem andar informado"}
          </p>

          <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
            {description}{" "}
            <strong>{formatMinutes(sector.avg_total_minutes)}</strong>.
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

export default async function SectorTimeIndicatorsPage({
  searchParams
}: SectorTimeIndicatorsPageProps) {
  const params = await searchParams;

  const selectedPeriod = params?.period || "30";
  const periodDays = Number(selectedPeriod);

  const safePeriodDays =
    Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 30;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_sector_time_indicators_admin",
    {
      p_period_days: safePeriodDays
    }
  );

  const indicators = (data ?? []) as SectorTimeIndicator[];

  const sectorsWithCompleted = indicators.filter(
    (item) => Number(item.completed_count) > 0
  );

  const totalCompleted = indicators.reduce(
    (sum, item) => sum + Number(item.completed_count ?? 0),
    0
  );

  const avgAccept =
    sectorsWithCompleted.length > 0
      ? sectorsWithCompleted.reduce(
          (sum, item) => sum + Number(item.avg_accept_minutes ?? 0),
          0
        ) / sectorsWithCompleted.length
      : null;

  const avgTransport =
    sectorsWithCompleted.length > 0
      ? sectorsWithCompleted.reduce(
          (sum, item) => sum + Number(item.avg_transport_minutes ?? 0),
          0
        ) / sectorsWithCompleted.length
      : null;

  const avgTotal =
    sectorsWithCompleted.length > 0
      ? sectorsWithCompleted.reduce(
          (sum, item) => sum + Number(item.avg_total_minutes ?? 0),
          0
        ) / sectorsWithCompleted.length
      : null;

  const slowestSector = [...sectorsWithCompleted].sort(
    (a, b) => Number(b.avg_total_minutes ?? 0) - Number(a.avg_total_minutes ?? 0)
  )[0];

  const fastestSector = [...sectorsWithCompleted].sort(
    (a, b) => Number(a.avg_total_minutes ?? 0) - Number(b.avg_total_minutes ?? 0)
  )[0];

  const mostActiveSector = [...sectorsWithCompleted].sort(
    (a, b) => Number(b.completed_count ?? 0) - Number(a.completed_count ?? 0)
  )[0];

  const criticalSectors = sectorsWithCompleted.filter(
    (item) => Number(item.avg_total_minutes ?? 0) > 60
  );

  const pdfHref = `/reports/sector-time-indicators/pdf?period=${selectedPeriod}`;

  return (
    <DashboardShell
      title="Indicadores por setor"
      description="Analise o tempo médio dos transportes por setor de origem."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Performance por setor
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Indicadores de tempo médio por setor
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Acompanhe gargalos operacionais por setor de origem,
                  identifique atrasos e compare tempos médios dos transportes
                  concluídos.
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
              label="Setores analisados"
              value={indicators.length}
              description="Setores cadastrados"
              tone="primary"
            />

            <MetricCard
              label="Transportes concluídos"
              value={totalCompleted}
              description={getPeriodLabel(selectedPeriod)}
              tone="gold"
            />

            <MetricCard
              label="Tempo médio de aceite"
              value={formatMinutes(avgAccept)}
              description="Solicitação até aceite"
              tone={getPerformanceTone(avgAccept)}
            />

            <MetricCard
              label="Tempo médio em transporte"
              value={formatMinutes(avgTransport)}
              description="Início até conclusão"
              tone={getPerformanceTone(avgTransport)}
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
            Erro ao carregar indicadores por setor: {error.message}
          </div>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Filtro de período
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Escolha o intervalo usado para calcular os tempos médios.
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
              href="/reports/sector-time-indicators"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </form>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectorHighlightCard
            title="Maior gargalo"
            sector={slowestSector}
            description="Este setor apresenta o maior tempo médio total no período:"
            tone="danger"
          />

          <SectorHighlightCard
            title="Melhor desempenho"
            sector={fastestSector}
            description="Este setor apresenta o menor tempo médio total no período:"
            tone="success"
          />

          <SectorHighlightCard
            title="Maior volume"
            sector={mostActiveSector}
            description={`Este setor concentrou ${mostActiveSector?.completed_count ?? 0} transporte${
              mostActiveSector?.completed_count === 1 ? "" : "s"
            } concluído${mostActiveSector?.completed_count === 1 ? "" : "s"} no período, com tempo médio total de`}
            tone="gold"
          />
        </div>

        {criticalSectors.length > 0 ? (
          <section className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="text-lg font-black text-red-950">
              Atenção: setores com tempo crítico
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-red-800">
              Existem <strong>{criticalSectors.length}</strong> setor
              {criticalSectors.length === 1 ? "" : "es"} com tempo médio total
              acima de 60 minutos. Vale revisar fluxo de solicitação, aceite,
              deslocamento e disponibilidade da equipe.
            </p>
          </section>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
              Visualização gráfica
            </p>

            <h2 className="mt-2 text-lg font-black text-slate-950">
              Comparativo dos tempos por setor
            </h2>

            <p className="mt-1 text-sm font-semibold text-slate-500">
              Gráfico com os tempos médios calculados a partir dos transportes
              concluídos.
            </p>
          </div>

          <SectorTimeIndicatorsChart indicators={indicators} />
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Dados detalhados
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Tabela por setor
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Indicadores calculados com base nos transportes concluídos.
              </p>
            </div>

            <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
              {indicators.length} setor{indicators.length === 1 ? "" : "es"}
            </p>
          </div>

          {indicators.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-semibold text-slate-500">
              Nenhum setor encontrado para análise.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#009da8]/10 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-black">Setor</th>
                    <th className="px-4 py-3 font-black">Concluídos</th>
                    <th className="px-4 py-3 font-black">Aceite</th>
                    <th className="px-4 py-3 font-black">Até iniciar</th>
                    <th className="px-4 py-3 font-black">Em transporte</th>
                    <th className="px-4 py-3 font-black">Total</th>
                    <th className="px-4 py-3 font-black">Classificação</th>
                  </tr>
                </thead>

                <tbody>
                  {indicators.map((item) => (
                    <tr
                      key={item.sector_id}
                      className="border-t border-slate-200 text-slate-700"
                    >
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-950">
                          {item.sector_name}
                        </p>

                        <p className="text-xs font-semibold text-slate-500">
                          {item.sector_floor || "Sem andar informado"}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-black text-slate-950">
                        {item.completed_count}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {formatMinutes(item.avg_accept_minutes)}
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
                          {getPerformanceLabel(item.avg_total_minutes)}
                        </span>
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