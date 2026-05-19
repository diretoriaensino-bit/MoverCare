"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

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

type StretcherPerformanceChartProps = {
  indicators: StretcherPerformanceIndicator[];
};

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toRoundedNumber(value: NumericValue) {
  return Math.round(toNumber(value));
}

function formatMinutes(value: unknown) {
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

function getShortName(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length <= 2) {
    return name;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function StretcherPerformanceChart({
  indicators
}: StretcherPerformanceChartProps) {
  const chartData = indicators
    .filter((item) => toNumber(item.total_assigned_count) > 0)
    .slice(0, 10)
    .map((item) => ({
      professional: getShortName(item.professional_name),
      assigned: toRoundedNumber(item.total_assigned_count),
      completed: toRoundedNumber(item.completed_count),
      failed: toRoundedNumber(item.failed_count),
      cancelled: toRoundedNumber(item.cancelled_count),
      startMinutes: toRoundedNumber(item.avg_start_minutes),
      transportMinutes: toRoundedNumber(item.avg_transport_minutes),
      totalMinutes: toRoundedNumber(item.avg_total_minutes)
    }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-8 text-center">
        <h3 className="text-lg font-black text-slate-950">
          Nenhum dado para o gráfico
        </h3>

        <p className="mt-2 text-sm font-semibold text-slate-500">
          Ainda não há transportes atribuídos para gerar gráficos de desempenho.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
            Volume operacional
          </p>

          <h2 className="mt-2 text-lg font-black text-slate-950">
            Volume por maqueiro
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Comparativo de transportes atribuídos, concluídos, falhas e
            cancelamentos.
          </p>
        </div>

        <div className="mt-6 h-[410px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 24,
                right: 20,
                left: 0,
                bottom: 78
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#dbe7e8"
              />

              <XAxis
                dataKey="professional"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={90}
                tick={{
                  fill: "#334155",
                  fontSize: 12,
                  fontWeight: 700
                }}
              />

              <YAxis
                allowDecimals={false}
                tick={{
                  fill: "#334155",
                  fontSize: 12,
                  fontWeight: 700
                }}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(0, 157, 168, 0.2)",
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)"
                }}
                labelStyle={{
                  color: "#0f172a",
                  fontWeight: 900
                }}
              />

              <Legend
                wrapperStyle={{
                  paddingTop: 12,
                  fontWeight: 700
                }}
              />

              <Bar
                dataKey="assigned"
                name="Atribuídos"
                fill="#009da8"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="completed"
                name="Concluídos"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
              >
                <LabelList
                  dataKey="completed"
                  position="top"
                  fill="#0f172a"
                  fontSize={11}
                  fontWeight={800}
                />
              </Bar>

              <Bar
                dataKey="failed"
                name="Falhas"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="cancelled"
                name="Cancelados"
                fill="#f2b709"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
            Tempo médio
          </p>

          <h2 className="mt-2 text-lg font-black text-slate-950">
            Tempos médios por maqueiro
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Comparativo de tempo até iniciar, tempo em transporte e tempo total.
          </p>
        </div>

        <div className="mt-6 h-[410px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 24,
                right: 20,
                left: 0,
                bottom: 78
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#dbe7e8"
              />

              <XAxis
                dataKey="professional"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={90}
                tick={{
                  fill: "#334155",
                  fontSize: 12,
                  fontWeight: 700
                }}
              />

              <YAxis
                tick={{
                  fill: "#334155",
                  fontSize: 12,
                  fontWeight: 700
                }}
                tickFormatter={(value) => `${value}m`}
              />

              <Tooltip
                formatter={(value) => formatMinutes(value)}
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(0, 157, 168, 0.2)",
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)"
                }}
                labelStyle={{
                  color: "#0f172a",
                  fontWeight: 900
                }}
              />

              <Legend
                wrapperStyle={{
                  paddingTop: 12,
                  fontWeight: 700
                }}
              />

              <Bar
                dataKey="startMinutes"
                name="Até iniciar"
                fill="#009da8"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="transportMinutes"
                name="Em transporte"
                fill="#f2b709"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="totalMinutes"
                name="Total"
                fill="#0f172a"
                radius={[8, 8, 0, 0]}
              >
                <LabelList
                  dataKey="totalMinutes"
                  position="top"
                  formatter={(value: unknown) => formatMinutes(value)}
                  fill="#0f172a"
                  fontSize={11}
                  fontWeight={800}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}