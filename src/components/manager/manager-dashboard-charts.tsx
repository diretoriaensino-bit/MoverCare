"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ChartItem = {
  name: string;
  total: number;
};

type ManagerDashboardChartsProps = {
  byStatus: ChartItem[];
  byPriority: ChartItem[];
  byOriginSector: ChartItem[];
  byDestinationSector: ChartItem[];
  byStretcherBearer: ChartItem[];
};

const colors = [
  "#0b5cff",
  "#10b981",
  "#f97316",
  "#dc2626",
  "#8b5cf6",
  "#14b8a6",
  "#64748b"
];

function EmptyState() {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
      <p className="text-sm font-semibold text-slate-500">
        Ainda não há dados suficientes para exibir este gráfico.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-5 h-64">{children}</div>
    </section>
  );
}

function SimpleBarChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function getPieLabel(entry: unknown) {
  const item = entry as {
    name?: string;
    total?: number;
  };

  return `${item.name ?? "Item"}: ${item.total ?? 0}`;
}

function SimplePieChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={86}
          label={getPieLabel}
        >
          {data.map((item, index) => (
            <Cell key={item.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ManagerDashboardCharts({
  byStatus,
  byPriority,
  byOriginSector,
  byDestinationSector,
  byStretcherBearer
}: ManagerDashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Transportes por status"
        description="Distribuição dos chamados conforme andamento operacional."
      >
        <SimplePieChart data={byStatus} />
      </ChartCard>

      <ChartCard
        title="Transportes por prioridade"
        description="Comparativo entre chamados normais e urgentes."
      >
        <SimplePieChart data={byPriority} />
      </ChartCard>

      <ChartCard
        title="Setores de origem"
        description="Setores que mais solicitam transporte de pacientes."
      >
        <SimpleBarChart data={byOriginSector} />
      </ChartCard>

      <ChartCard
        title="Setores de destino"
        description="Setores que mais recebem pacientes transportados."
      >
        <SimpleBarChart data={byDestinationSector} />
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard
          title="Produtividade por maqueiro"
          description="Quantidade de transportes atribuídos a cada profissional."
        >
          <SimpleBarChart data={byStretcherBearer} />
        </ChartCard>
      </div>
    </div>
  );
}