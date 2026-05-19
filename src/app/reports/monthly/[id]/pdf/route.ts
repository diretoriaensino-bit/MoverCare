import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2
  }).format(value);
}

function getItemLabel(
  item: ReportGroupItem,
  key: "status" | "priority" | "sector_name" | "stretcher_bearer_name"
) {
  return item[key] ?? "Não informado";
}

function translateStatus(status: string) {
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

function translatePriority(priority: string) {
  const labels: Record<string, string> = {
    normal: "Normal",
    urgent: "Urgente"
  };

  return labels[priority] ?? priority;
}

function safeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, "->");
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
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

async function createPdfBytes(report: MonthlyReport, generatedBy: string) {
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function addPageIfNeeded(requiredHeight = 80) {
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
    addPageIfNeeded(30);

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.88, 0.91, 0.95)
    });

    y -= 18;
  }

  function drawMetric(label: string, value: string | number, description: string) {
    addPageIfNeeded(70);

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

  function drawGroup(
    title: string,
    items: ReportGroupItem[] | null,
    labelKey: "status" | "priority" | "sector_name" | "stretcher_bearer_name"
  ) {
    drawSectionTitle(title);

    const list = items ?? [];

    if (list.length === 0) {
      drawText("Sem dados para exibir.", {
        size: 10,
        color: rgb(0.39, 0.45, 0.55)
      });

      return;
    }

    list.slice(0, 12).forEach((item) => {
      let label = getItemLabel(item, labelKey);

      if (labelKey === "status") {
        label = translateStatus(label);
      }

      if (labelKey === "priority") {
        label = translatePriority(label);
      }

      let line = `${label}: ${item.total ?? 0}`;

      if (item.completed !== undefined || item.failed !== undefined) {
        line += ` | Concluídos: ${item.completed ?? 0} | Falhas: ${
          item.failed ?? 0
        }`;
      }

      drawText(`- ${line}`, {
        size: 10,
        color: rgb(0.2, 0.25, 0.33)
      });
    });
  }

  const monthName = monthNames[report.report_month - 1] ?? "Mês";

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

  page.drawText("Relatório mensal de transportes intra-hospitalares", {
    x: margin,
    y: pageHeight - 82,
    size: 13,
    font: regularFont,
    color: rgb(0.9, 0.95, 1)
  });

  page.drawText(`Gerado por: ${safeText(generatedBy)}`, {
    x: margin,
    y: pageHeight - 102,
    size: 9,
    font: regularFont,
    color: rgb(0.9, 0.95, 1)
  });

  y = pageHeight - 150;

  drawText(`${monthName} de ${report.report_year}`, {
    size: 20,
    bold: true,
    color: rgb(0.02, 0.09, 0.22)
  });

  drawText(
    `Período: ${formatDate(report.period_start)} até ${formatDate(
      report.period_end
    )}`,
    {
      size: 10,
      color: rgb(0.39, 0.45, 0.55)
    }
  );

  drawText(`Gerado em: ${formatDateTime(report.generated_at)}`, {
    size: 10,
    color: rgb(0.39, 0.45, 0.55)
  });

  y -= 12;

  drawSectionTitle("Resumo executivo");

  drawMetric(
    "Total de transportes",
    report.total_transports,
    "Solicitações registradas no período"
  );

  drawMetric(
    "Concluídos",
    report.completed_transports,
    "Transportes finalizados com sucesso"
  );

  drawMetric(
    "Taxa de conclusão",
    `${formatNumber(report.completion_rate)}%`,
    "Percentual de chamados concluídos"
  );

  drawMetric(
    "Tempo médio total",
    `${formatNumber(report.average_total_minutes)} min`,
    "Da solicitação até a conclusão"
  );

  drawMetric(
    "Tempo médio em transporte",
    `${formatNumber(report.average_transport_minutes)} min`,
    "Do início até a conclusão"
  );

  drawMetric(
    "Urgentes",
    report.urgent_transports,
    "Chamados classificados como urgentes"
  );

  drawMetric(
    "Cancelados",
    report.cancelled_transports,
    "Solicitações canceladas"
  );

  drawMetric(
    "Falhas",
    report.failed_transports,
    "Transportes marcados com falha"
  );

  drawGroup("Distribuição por status", report.by_status, "status");
  drawGroup("Distribuição por prioridade", report.by_priority, "priority");

  drawGroup(
    "Setores de origem mais utilizados",
    report.by_origin_sector,
    "sector_name"
  );

  drawGroup(
    "Setores de destino mais utilizados",
    report.by_destination_sector,
    "sector_name"
  );

  drawGroup(
    "Produtividade por maqueiro",
    report.by_stretcher_bearer,
    "stretcher_bearer_name"
  );

  y -= 14;

  drawDivider();

  drawText(
    "Documento gerado automaticamente pelo MoverCare. Use este relatório para gestão, auditoria e acompanhamento operacional.",
    {
      size: 8,
      color: rgb(0.39, 0.45, 0.55),
      maxWidth: pageWidth - margin * 2
    }
  );

  return await pdfDoc.save();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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

  const { data: report, error: reportError } = await supabase
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
    .eq("id", id)
    .eq("hospital_id", profile.hospital_id)
    .single();

  if (reportError || !report) {
    return new Response("Relatório não encontrado.", { status: 404 });
  }

  const typedReport = report as MonthlyReport;
  const pdfBytes = await createPdfBytes(typedReport, profile.name);

  const month = String(typedReport.report_month).padStart(2, "0");
  const filename = `movercare-relatorio-${typedReport.report_year}-${month}.pdf`;

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