"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

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

type SectorTimeIndicatorsChartProps = {
  indicators: SectorTimeIndicator[];
};

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

export default function SectorTimeIndicatorsChart({
  indicators
}: SectorTimeIndicatorsChartProps) {
  const chartData = indicators
    .filter((item) => Number(item.completed_count) > 0)
    .slice(0, 10)
    .map((item) => ({
      setor: item.sector_floor
        ? `${item.sector_name} - ${item.sector_floor}`
        : item.sector_name,
      aceite: formatNumber(item.avg_accept_minutes),
      inicio: formatNumber(item.avg_start_minutes),
      transporte: formatNumber(item.avg_transport_minutes),
      total: formatNumber(item.avg_total_minutes)
    }));

  if (chartData.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          Gráfico de tempos por setor
        </h2>

        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
          Ainda não há transportes concluídos suficientes para gerar o gráfico.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-950">
          Gráfico de tempos por setor
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Comparativo dos principais tempos médios por setor de origem.
        </p>
      </div>

      <div className="mt-6 h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 20,
              left: 0,
              bottom: 80
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="setor"
              angle={-35}
              textAnchor="end"
              interval={0}
              height={95}
              tick={{
                fontSize: 12
              }}
            />

            <YAxis
              tick={{
                fontSize: 12
              }}
              label={{
                value: "Minutos",
                angle: -90,
                position: "insideLeft"
              }}
            />

            <Tooltip
              formatter={(value) => [
                `${Number(value).toFixed(1)} min`,
                ""
              ]}
            />

            <Legend />

            <Bar dataKey="aceite" name="Até aceitar" />
            <Bar dataKey="inicio" name="Até iniciar" />
            <Bar dataKey="transporte" name="Em transporte" />
            <Bar dataKey="total" name="Total" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}