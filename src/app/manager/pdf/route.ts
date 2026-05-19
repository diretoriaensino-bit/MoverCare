import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelationValue<T> = T | T[] | null;

type SectorRelation = {
  name: string | null;
};

type ProfileRelation = {
  name: string | null;
};

type TransportRow = {
  id: string;
  status: string;
  priority: string;
  requested_at: string;
  completed_at: string | null;
  started_at: string | null;
  origin: RelationValue<SectorRelation>;
  destination: RelationValue<SectorRelation>;
  stretcher_bearer: RelationValue<ProfileRelation>;
};

type ChartItem = {
  name: string;
  total: number;
};

type PeriodOption = {
  key: string;
  label: string;
  description: string;
  startDate: Date;
};

function getFirstRelation<T>(value: RelationValue<T>): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    accepted: "Aceito",
    in_transit: "Em trânsito",
    completed: "Concluído",
    cancelled: "Cancelado",
    failed: "Falha"
  };

  return labels[status] ?? status;
}

function getPriorityLabel(priority: string) {
  const labels: Record<string, string> = {
    normal: "Normal",
    urgent: "Urgente"
  };

  return labels[priority] ?? priority;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(value);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function safeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, "->");
}

function getPeriodOptions() {
  const now = new Date();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const options: PeriodOption[] = [
    {
      key: "7d",
      label: "Últimos 7 dias",
      description: "Indicadores da última semana",
      startDate: sevenDaysAgo
    },
    {
      key: "30d",
      label: "Últimos 30 dias",
      description: "Visão operacional recente",
      startDate: thirtyDaysAgo
    },
    {
      key: "month",
      label: "Mês atual",
      description: "Do primeiro dia do mês até hoje",
      startDate: currentMonthStart
    },
    {
      key: "90d",
      label: "Últimos 90 dias",
      description: "Visão trimestral aproximada",
      startDate: ninetyDaysAgo
    }
  ];

  return options;
}

function getSelectedPeriod(periodKey: string | null) {
  const options = getPeriodOptions();

  return (
    options.find((option) => option.key === periodKey) ??
    options.find((option) => option.key === "30d") ??
    options[0]
  );
}

function aggregateBy(
  transports: TransportRow[],
  getKey: (transport: TransportRow) => string
): ChartItem[] {
  const map = new Map<string, number>();

  transports.forEach((transport) => {
    const key = getKey(transport);
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function calculateAverageTotalMinutes(transports: TransportRow[]) {
  const completedWithTime = transports.filter(
    (transport) =>
      transport.status === "completed" &&
      transport.requested_at &&
      transport.completed_at
  );

  if (completedWithTime.length === 0) return 0;

  const totalMinutes = completedWithTime.reduce((sum, transport) => {
    const requestedAt = new Date(transport.requested_at).getTime();
    const completedAt = new Date(transport.completed_at as string).getTime();

    return sum + (completedAt - requestedAt) / 1000 / 60;
  }, 0);

  return totalMinutes / completedWithTime.length;
}

function calculateAverageTransportMinutes(transports: TransportRow[]) {
  const completedWithTime = transports.filter(
    (transport) =>
      transport.status === "completed" &&
      transport.started_at &&
      transport.completed_at
  );

  if (completedWithTime.length === 0) return 0;

  const totalMinutes = completedWithTime.reduce((sum, transport) => {
    const startedAt = new Date(transport.started_at as string).getTime();
    const completedAt = new Date(transport.completed_at as string).getTime();

    return sum + (completedAt - startedAt) / 1000 / 60;
  }, 0);

  return totalMinutes / completedWithTime.length;
}

function createTextWrapper(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number
) {
  const words = safeText(text).split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);

  return lines;
}

async function createManagerPdf({
  profileName,
  selectedPeriod,
  transports
}: {
  profileName: string;
  selectedPeriod: PeriodOption;
  transports: TransportRow[];
}) {
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function addPageIfNeeded(requiredHeight = 70) {
    if (y < margin + requiredHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(
    text: string,
    options?: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
      lineHeight?: number;
    }
  ) {
    const x = options?.x ?? margin;
    const size = options?.size ?? 10;
    const font = options?.bold ? boldFont : regularFont;
    const color = options?.color ?? rgb(0.1, 0.12, 0.16);
    const maxWidth = options?.maxWidth ?? pageWidth - margin * 2;
    const lineHeight = options?.lineHeight ?? size + 5;

    const lines = createTextWrapper(text, maxWidth, font, size);

    lines.forEach((line) => {
      addPageIfNeeded(30);

      page.drawText(safeText(line), {
        x,
        y,
        size,
        font,
        color
      });

      y -= lineHeight;
    });
  }

  function drawDivider() {
    addPageIfNeeded(20);

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.95)
    });

    y -= 18;
  }

  function drawSectionTitle(title: string) {
    addPageIfNeeded(60);
    y -= 8;

    drawText(title, {
      size: 15,
      bold: true,
      color: rgb(0.02, 0.09, 0.22)
    });

    drawDivider();
  }

  function drawMetric(label: string, value: string | number, description: string) {
    addPageIfNeeded(65);

    drawText(label, {
      size: 9,
      bold: true,
      color: rgb(0.39, 0.45, 0.55)
    });

    drawText(String(value), {
      size: 18,
      bold: true,
      color: rgb(0.02, 0.09, 0.22)
    });

    drawText(description, {
      size: 8,
      color: rgb(0.39, 0.45, 0.55)
    });

    y -= 8;
  }

  function drawList(title: string, items: ChartItem[]) {
    drawSectionTitle(title);

    if (items.length === 0) {
      drawText("Sem dados para exibir.", {
        size: 10,
        color: rgb(0.39, 0.45, 0.55)
      });
      return;
    }

    items.forEach((item, index) => {
      drawText(`${index + 1}. ${item.name}: ${item.total}`, {
        size: 10,
        color: rgb(0.2, 0.25, 0.33)
      });
    });
  }

  const total = transports.length;
  const pending = transports.filter((t) => t.status === "pending").length;
  const active = transports.filter(
    (t) => t.status === "accepted" || t.status === "in_transit"
  ).length;
  const completed = transports.filter((t) => t.status === "completed").length;
  const failed = transports.filter((t) => t.status === "failed").length;
  const cancelled = transports.filter((t) => t.status === "cancelled").length;
  const urgent = transports.filter((t) => t.priority === "urgent").length;

  const completionRate =
    total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;

  const averageTotalMinutes = calculateAverageTotalMinutes(transports);
  const averageTransportMinutes = calculateAverageTransportMinutes(transports);

  const byStatus = aggregateBy(transports, (transport) =>
    getStatusLabel(transport.status)
  );

  const byPriority = aggregateBy(transports, (transport) =>
    getPriorityLabel(transport.priority)
  );

  const byOriginSector = aggregateBy(transports, (transport) => {
    const origin = getFirstRelation(transport.origin);
    return origin?.name ?? "Sem origem";
  });

  const byDestinationSector = aggregateBy(transports, (transport) => {
    const destination = getFirstRelation(transport.destination);
    return destination?.name ?? "Sem destino";
  });

  const byStretcherBearer = aggregateBy(transports, (transport) => {
    const stretcherBearer = getFirstRelation(transport.stretcher_bearer);
    return stretcherBearer?.name ?? "Sem responsável";
  });

  page.drawRectangle({
    x: 0,
    y: pageHeight - 120,
    width: pageWidth,
    height: 120,
    color: rgb(0.04, 0.36, 1)
  });

  page.drawText("MoverCare", {
    x: margin,
    y: pageHeight - 55,
    size: 28,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  page.drawText("Painel gerencial de transportes intra-hospitalares", {
    x: margin,
    y: pageHeight - 82,
    size: 13,
    font: regularFont,
    color: rgb(0.9, 0.95, 1)
  });

  page.drawText(`Gerado por: ${safeText(profileName)}`, {
    x: margin,
    y: pageHeight - 102,
    size: 9,
    font: regularFont,
    color: rgb(0.9, 0.95, 1)
  });

  y = pageHeight - 150;

  drawText(`Painel do gestor - ${selectedPeriod.label}`, {
    size: 20,
    bold: true,
    color: rgb(0.02, 0.09, 0.22)
  });

  drawText(`Período: a partir de ${formatDate(selectedPeriod.startDate)}`, {
    size: 10,
    color: rgb(0.39, 0.45, 0.55)
  });

  drawText(`Exportado em: ${formatDateTime(new Date())}`, {
    size: 10,
    color: rgb(0.39, 0.45, 0.55)
  });

  y -= 12;

  drawSectionTitle("Resumo executivo");

  drawMetric(
    "Total de transportes",
    total,
    `Transportes solicitados em: ${selectedPeriod.label}`
  );

  drawMetric("Pendentes", pending, "Chamados aguardando aceite");
  drawMetric("Em andamento", active, "Aceitos ou em trânsito");
  drawMetric("Concluídos", completed, "Transportes finalizados com sucesso");

  drawMetric(
    "Taxa de conclusão",
    `${formatNumber(completionRate)}%`,
    "Percentual concluído no período"
  );

  drawMetric("Urgentes", urgent, "Chamados com prioridade alta");
  drawMetric("Falhas", failed, "Transportes marcados com falha");
  drawMetric("Cancelados", cancelled, "Solicitações canceladas");

  drawMetric(
    "Tempo médio total",
    `${formatNumber(averageTotalMinutes)} min`,
    "Da solicitação até a conclusão"
  );

  drawMetric(
    "Tempo médio em transporte",
    `${formatNumber(averageTransportMinutes)} min`,
    "Do início até a conclusão"
  );

  drawList("Transportes por status", byStatus);
  drawList("Transportes por prioridade", byPriority);
  drawList("Setores de origem", byOriginSector);
  drawList("Setores de destino", byDestinationSector);
  drawList("Produtividade por maqueiro", byStretcherBearer);

  y -= 14;
  drawDivider();

  drawText(
    "Documento gerado automaticamente pelo MoverCare com base nos registros reais da tabela de transportes.",
    {
      size: 8,
      color: rgb(0.39, 0.45, 0.55)
    }
  );

  return await pdfDoc.save();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period");

  const selectedPeriod = getSelectedPeriod(period);

  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, hospital_id, name, email, role, active")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || !profile.active) {
    return new Response("Perfil não encontrado ou inativo.", { status: 403 });
  }

  if (profile.role !== "manager" && profile.role !== "admin") {
    return new Response("Acesso negado.", { status: 403 });
  }

  const { data: transportsData, error } = await supabase
    .from("transports")
    .select(
      `
      id,
      status,
      priority,
      requested_at,
      started_at,
      completed_at,
      origin:origin_sector_id(name),
      destination:destination_sector_id(name),
      stretcher_bearer:assigned_to(name)
    `
    )
    .eq("hospital_id", profile.hospital_id)
    .gte("requested_at", selectedPeriod.startDate.toISOString())
    .order("requested_at", { ascending: false })
    .limit(2000);

  if (error) {
    return new Response(`Erro ao carregar dados: ${error.message}`, {
      status: 500
    });
  }

  const transports = (transportsData ?? []) as TransportRow[];

  const pdfBytes = await createManagerPdf({
    profileName: profile.name,
    selectedPeriod,
    transports
  });

  const filename = `movercare-painel-gestor-${selectedPeriod.key}.pdf`;

  const pdfBlob = new Blob([pdfBytes as BlobPart], {
    type: "application/pdf"
  });

  return new Response(pdfBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}