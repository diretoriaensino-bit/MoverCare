import { NextRequest } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;

function sanitizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value < 60) {
    return `${Number(value).toFixed(1)} min`;
  }

  const hours = Math.floor(Number(value) / 60);
  const minutes = Math.round(Number(value) % 60);

  return `${hours}h ${minutes}min`;
}

function getPeriodLabel(period: number) {
  const labels: Record<number, string> = {
    7: "Últimos 7 dias",
    30: "Últimos 30 dias",
    90: "Últimos 90 dias",
    180: "Últimos 180 dias"
  };

  return labels[period] ?? `${period} dias`;
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

function formatNow() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
}

function wrapText({
  text,
  maxWidth,
  font,
  fontSize
}: {
  text: string;
  maxWidth: number;
  font: PDFFont;
  fontSize: number;
}) {
  const words = sanitizeText(text).split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function drawFooter({
  page,
  pageNumber,
  font
}: {
  page: PDFPage;
  pageNumber: number;
  font: PDFFont;
}) {
  page.drawLine({
    start: { x: MARGIN, y: 26 },
    end: { x: PAGE_WIDTH - MARGIN, y: 26 },
    thickness: 0.5,
    color: rgb(0.86, 0.9, 0.96)
  });

  page.drawText("MoverCare · Indicadores de tempo médio por setor", {
    x: MARGIN,
    y: 12,
    size: 8,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });

  page.drawText(`Página ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 48,
    y: 12,
    size: 8,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });
}

function drawMetricCard({
  page,
  x,
  y,
  width,
  height,
  title,
  value,
  description,
  font,
  boldFont
}: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  value: string | number;
  description: string;
  font: PDFFont;
  boldFont: PDFFont;
}) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.86, 0.9, 0.96),
    borderWidth: 1
  });

  page.drawText(title, {
    x: x + 12,
    y: y + height - 20,
    size: 8,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  page.drawText(String(value), {
    x: x + 12,
    y: y + height - 46,
    size: 18,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText(description, {
    x: x + 12,
    y: y + 10,
    size: 7,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });
}

function drawTableHeader({
  page,
  y,
  boldFont
}: {
  page: PDFPage;
  y: number;
  boldFont: PDFFont;
}) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 26,
    color: rgb(0.95, 0.97, 1)
  });

  const headers = [
    { label: "Setor", x: 48 },
    { label: "Concluídos", x: 210 },
    { label: "Aceite", x: 300 },
    { label: "Até iniciar", x: 385 },
    { label: "Transporte", x: 485 },
    { label: "Total", x: 590 },
    { label: "Classificação", x: 680 }
  ];

  headers.forEach((header) => {
    page.drawText(header.label, {
      x: header.x,
      y: y - 12,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.33)
    });
  });
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;

  const selectedPeriod = Number(searchParams.get("period") || "30");
  const safePeriodDays = Number.isFinite(selectedPeriod) ? selectedPeriod : 30;

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("name")
    .eq("id", profile.hospital_id)
    .single();

  const { data, error } = await supabase.rpc(
    "get_sector_time_indicators_admin",
    {
      p_period_days: safePeriodDays
    }
  );

  if (error) {
    return Response.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );
  }

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

  const slowestSector = sectorsWithCompleted[0];

  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 112,
    width: PAGE_WIDTH,
    height: 112,
    color: rgb(0.03, 0.12, 0.28)
  });

  page.drawText("MoverCare", {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 13,
    font: boldFont,
    color: rgb(0.75, 0.86, 1)
  });

  page.drawText("Indicadores de Tempo Médio por Setor", {
    x: MARGIN,
    y: PAGE_HEIGHT - 72,
    size: 23,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  page.drawText(sanitizeText(hospitalData?.name ?? "Hospital não encontrado"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 94,
    size: 10,
    font: regularFont,
    color: rgb(0.82, 0.88, 0.96)
  });

  page.drawText(`Emitido em ${formatNow()}`, {
    x: PAGE_WIDTH - MARGIN - 215,
    y: PAGE_HEIGHT - 42,
    size: 9,
    font: regularFont,
    color: rgb(0.82, 0.88, 0.96)
  });

  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 158,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 34,
    color: rgb(0.96, 0.98, 1),
    borderColor: rgb(0.85, 0.9, 1),
    borderWidth: 1
  });

  page.drawText(`Período analisado: ${getPeriodLabel(safePeriodDays)}`, {
    x: MARGIN + 14,
    y: PAGE_HEIGHT - 146,
    size: 9,
    font: regularFont,
    color: rgb(0.2, 0.25, 0.33)
  });

  const cardTop = PAGE_HEIGHT - 235;
  const cardWidth = 145;
  const cardHeight = 62;
  const cardGap = 10;

  const cards = [
    {
      title: "SETORES",
      value: indicators.length,
      description: "Setores cadastrados"
    },
    {
      title: "CONCLUÍDOS",
      value: totalCompleted,
      description: "Transportes no período"
    },
    {
      title: "ACEITE MÉDIO",
      value: formatMinutes(avgAccept),
      description: "Pedido até aceite"
    },
    {
      title: "EM TRANSPORTE",
      value: formatMinutes(avgTransport),
      description: "Início até conclusão"
    },
    {
      title: "TOTAL MÉDIO",
      value: formatMinutes(avgTotal),
      description: "Pedido até conclusão"
    }
  ];

  cards.forEach((card, index) => {
    drawMetricCard({
      page,
      x: MARGIN + index * (cardWidth + cardGap),
      y: cardTop,
      width: cardWidth,
      height: cardHeight,
      title: card.title,
      value: card.value,
      description: card.description,
      font: regularFont,
      boldFont
    });
  });

  let y = cardTop - 36;

  if (slowestSector) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 54,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 50,
      color: rgb(1, 0.98, 0.9),
      borderColor: rgb(0.96, 0.79, 0.35),
      borderWidth: 1
    });

    const slowestText = `Setor com maior tempo médio total: ${
      slowestSector.sector_name
    }${
      slowestSector.sector_floor ? ` - ${slowestSector.sector_floor}` : ""
    } · ${formatMinutes(slowestSector.avg_total_minutes)}`;

    page.drawText(sanitizeText(slowestText), {
      x: MARGIN + 14,
      y: y - 26,
      size: 10,
      font: boldFont,
      color: rgb(0.5, 0.32, 0.03)
    });

    y -= 78;
  }

  page.drawText("Tabela de indicadores por setor", {
    x: MARGIN,
    y,
    size: 15,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText("Indicadores calculados com base nos transportes concluídos.", {
    x: MARGIN,
    y: y - 18,
    size: 9,
    font: regularFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  y -= 46;

  drawTableHeader({
    page,
    y,
    boldFont
  });

  y -= 34;

  if (indicators.length === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 45,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 44,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.86, 0.9, 0.96),
      borderWidth: 1
    });

    page.drawText("Nenhum setor encontrado para análise.", {
      x: MARGIN + 14,
      y: y - 24,
      size: 10,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });
  }

  for (const item of indicators) {
    const sectorName = item.sector_floor
      ? `${item.sector_name} - ${item.sector_floor}`
      : item.sector_name;

    const sectorLines = wrapText({
      text: sectorName,
      maxWidth: 145,
      font: boldFont,
      fontSize: 8
    }).slice(0, 2);

    const rowHeight = Math.max(40, sectorLines.length * 10 + 22);

    if (y - rowHeight < 42) {
      drawFooter({ page, pageNumber, font: regularFont });

      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNumber += 1;

      page.drawRectangle({
        x: 0,
        y: PAGE_HEIGHT - 54,
        width: PAGE_WIDTH,
        height: 54,
        color: rgb(0.03, 0.12, 0.28)
      });

      page.drawText("MoverCare · Indicadores por setor", {
        x: MARGIN,
        y: PAGE_HEIGHT - 34,
        size: 14,
        font: boldFont,
        color: rgb(1, 1, 1)
      });

      y = PAGE_HEIGHT - 82;

      drawTableHeader({
        page,
        y,
        boldFont
      });

      y -= 34;
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight + 8,
      width: PAGE_WIDTH - MARGIN * 2,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.93, 0.97),
      borderWidth: 0.5
    });

    sectorLines.forEach((line, index) => {
      page.drawText(line, {
        x: 48,
        y: y - 10 - index * 10,
        size: 8,
        font: boldFont,
        color: rgb(0.05, 0.09, 0.16)
      });
    });

    page.drawText(String(item.completed_count), {
      x: 210,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_accept_minutes), {
      x: 300,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_start_minutes), {
      x: 385,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_transport_minutes), {
      x: 485,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_total_minutes), {
      x: 590,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });

    page.drawText(getPerformanceLabel(item.avg_total_minutes), {
      x: 680,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.12, 0.31, 0.63)
    });

    y -= rowHeight;
  }

  drawFooter({ page, pageNumber, font: regularFont });

  const pdfBytes = await pdfDoc.save();

  const fileName = `indicadores-setor-movercare-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  const blob = new Blob([pdfBytes as BlobPart], {
    type: "application/pdf"
  });

  return new Response(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}