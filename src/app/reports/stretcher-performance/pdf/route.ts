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

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;

function toNumber(value: NumericValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function sanitizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}

function formatMinutes(value: NumericValue) {
  if (value === null || value === undefined) {
    return "-";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  if (numberValue < 60) {
    return `${numberValue.toFixed(1)} min`;
  }

  const hours = Math.floor(numberValue / 60);
  const minutes = Math.round(numberValue % 60);

  return `${hours}h ${minutes}min`;
}

function getCompletionRate(completed: NumericValue, assigned: NumericValue) {
  const assignedNumber = toNumber(assigned);
  const completedNumber = toNumber(completed);

  if (assignedNumber <= 0) {
    return "-";
  }

  return `${((completedNumber / assignedNumber) * 100).toFixed(1)}%`;
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

function getPeriodLabel(period: number) {
  const labels: Record<number, string> = {
    7: "Últimos 7 dias",
    30: "Últimos 30 dias",
    90: "Últimos 90 dias",
    180: "Últimos 180 dias"
  };

  return labels[period] ?? `${period} dias`;
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

  page.drawText("MoverCare · Desempenho dos maqueiros", {
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
    x: x + 10,
    y: y + height - 20,
    size: 7.5,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  page.drawText(String(value), {
    x: x + 10,
    y: y + height - 45,
    size: 17,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText(description, {
    x: x + 10,
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
    { label: "Maqueiro", x: 48 },
    { label: "Atrib.", x: 210 },
    { label: "Conc.", x: 265 },
    { label: "Taxa", x: 320 },
    { label: "Falhas", x: 375 },
    { label: "Canc.", x: 430 },
    { label: "Até iniciar", x: 485 },
    { label: "Transporte", x: 575 },
    { label: "Total", x: 675 },
    { label: "Classe", x: 740 }
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
    "get_stretcher_performance_indicators_admin",
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

  const avgTotal =
    professionalsWithAssigned.length > 0
      ? professionalsWithAssigned.reduce(
          (sum, item) => sum + toNumber(item.avg_total_minutes),
          0
        ) / professionalsWithAssigned.length
      : null;

  const bestProfessional = [...professionalsWithAssigned]
    .filter((item) => item.avg_total_minutes !== null)
    .sort(
      (a, b) => toNumber(a.avg_total_minutes) - toNumber(b.avg_total_minutes)
    )[0];

  const mostCompletedProfessional = [...professionalsWithAssigned].sort(
    (a, b) => toNumber(b.completed_count) - toNumber(a.completed_count)
  )[0];

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

  page.drawText("Indicadores de Desempenho dos Maqueiros", {
    x: MARGIN,
    y: PAGE_HEIGHT - 72,
    size: 22,
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
  const cardWidth = 118;
  const cardHeight = 62;
  const cardGap = 10;

  const cards = [
    {
      title: "MAQUEIROS",
      value: indicators.length,
      description: "Profissionais"
    },
    {
      title: "ATRIBUÍDOS",
      value: totalAssigned,
      description: "No período"
    },
    {
      title: "CONCLUÍDOS",
      value: totalCompleted,
      description: "Finalizados"
    },
    {
      title: "FALHAS",
      value: totalFailed,
      description: "Registradas"
    },
    {
      title: "CANCELADOS",
      value: totalCancelled,
      description: "Cancelamentos"
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

  if (mostCompletedProfessional || bestProfessional) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 70,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 66,
      color: rgb(0.96, 0.98, 1),
      borderColor: rgb(0.85, 0.9, 1),
      borderWidth: 1
    });

    if (mostCompletedProfessional) {
      const text = `Maior volume: ${
        mostCompletedProfessional.professional_name
      } · ${toNumber(mostCompletedProfessional.completed_count)} concluído(s).`;

      page.drawText(sanitizeText(text), {
        x: MARGIN + 14,
        y: y - 25,
        size: 10,
        font: boldFont,
        color: rgb(0.03, 0.12, 0.28)
      });
    }

    if (bestProfessional) {
      const text = `Menor tempo médio total: ${
        bestProfessional.professional_name
      } · ${formatMinutes(bestProfessional.avg_total_minutes)}.`;

      page.drawText(sanitizeText(text), {
        x: MARGIN + 14,
        y: y - 48,
        size: 10,
        font: boldFont,
        color: rgb(0.03, 0.12, 0.28)
      });
    }

    y -= 92;
  }

  page.drawText("Tabela de desempenho por maqueiro", {
    x: MARGIN,
    y,
    size: 15,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText("Indicadores calculados com base nos transportes atribuídos.", {
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

    page.drawText("Nenhum maqueiro encontrado para análise.", {
      x: MARGIN + 14,
      y: y - 24,
      size: 10,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });
  }

  for (const item of indicators) {
    const nameLines = wrapText({
      text: `${item.professional_name} · ${item.professional_email}`,
      maxWidth: 145,
      font: boldFont,
      fontSize: 7.5
    }).slice(0, 2);

    const rowHeight = Math.max(42, nameLines.length * 10 + 22);

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

      page.drawText("MoverCare · Desempenho dos maqueiros", {
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

    nameLines.forEach((line, index) => {
      page.drawText(line, {
        x: 48,
        y: y - 10 - index * 10,
        size: 7.5,
        font: index === 0 ? boldFont : regularFont,
        color: rgb(0.05, 0.09, 0.16)
      });
    });

    page.drawText(String(toNumber(item.total_assigned_count)), {
      x: 210,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(String(toNumber(item.completed_count)), {
      x: 265,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(
      getCompletionRate(item.completed_count, item.total_assigned_count),
      {
        x: 320,
        y: y - 10,
        size: 8,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.33)
      }
    );

    page.drawText(String(toNumber(item.failed_count)), {
      x: 375,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(String(toNumber(item.cancelled_count)), {
      x: 430,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_start_minutes), {
      x: 485,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_transport_minutes), {
      x: 575,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(item.avg_total_minutes), {
      x: 675,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });

    page.drawText(getPerformanceLabel(item.avg_total_minutes), {
      x: 740,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.12, 0.31, 0.63)
    });

    y -= rowHeight;
  }

  drawFooter({ page, pageNumber, font: regularFont });

  const pdfBytes = await pdfDoc.save();

  const fileName = `desempenho-maqueiros-movercare-${new Date()
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