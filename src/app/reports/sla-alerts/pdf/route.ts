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

type SlaAlert = {
  transport_id: string;
  patient_code: string;
  priority: string;
  status: string;
  origin_name: string | null;
  destination_name: string | null;
  assigned_name: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  elapsed_minutes: NumericValue;
  alert_type: string;
  alert_level: string;
  alert_message: string;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  in_transit: "Em transporte",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falha"
};

const priorityLabels: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgente"
};

const alertTypeLabels: Record<string, string> = {
  pending_acceptance_delay: "Atraso no aceite",
  start_delay: "Atraso para iniciar",
  transport_delay: "Transporte demorado",
  no_alert: "Sem alerta"
};

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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatNow() {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date());
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

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getPriorityLabel(priority: string) {
  return priorityLabels[priority] ?? priority;
}

function getAlertTypeLabel(alertType: string) {
  return alertTypeLabels[alertType] ?? alertType;
}

function getAlertLevelLabel(level: string) {
  if (level === "critical") {
    return "Crítico";
  }

  return "Atenção";
}

function getBaseDate(alert: SlaAlert) {
  if (alert.status === "pending") {
    return alert.requested_at;
  }

  if (alert.status === "accepted") {
    return alert.accepted_at;
  }

  return alert.started_at;
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

  page.drawText("MoverCare · Alertas de SLA", {
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
    size: 18,
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
    { label: "Paciente", x: 48 },
    { label: "Status", x: 120 },
    { label: "Nível", x: 190 },
    { label: "Tipo", x: 250 },
    { label: "Tempo", x: 365 },
    { label: "Origem/Destino", x: 435 },
    { label: "Responsável", x: 590 },
    { label: "Base", x: 710 }
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

const { data: hospitalData } = await supabase
  .from("hospitals")
  .select("name")
  .eq("id", profile.hospital_id)
  .single();

const { data: settingsData } = await supabase.rpc(
  "get_hospital_sla_settings_admin"
);

const settings = settingsData as
  | {
      sla_accept_limit_minutes?: number;
      sla_start_limit_minutes?: number;
      sla_transport_limit_minutes?: number;
    }
  | null;

const savedAcceptLimit = Number(settings?.sla_accept_limit_minutes ?? 10);
const savedStartLimit = Number(settings?.sla_start_limit_minutes ?? 15);
const savedTransportLimit = Number(
  settings?.sla_transport_limit_minutes ?? 60
);

const acceptLimit = searchParams.get("accept")
  ? Number(searchParams.get("accept"))
  : savedAcceptLimit;

const startLimit = searchParams.get("start")
  ? Number(searchParams.get("start"))
  : savedStartLimit;

const transportLimit = searchParams.get("transport")
  ? Number(searchParams.get("transport"))
  : savedTransportLimit;

const safeAcceptLimit = Number.isFinite(acceptLimit)
  ? acceptLimit
  : savedAcceptLimit;

const safeStartLimit = Number.isFinite(startLimit)
  ? startLimit
  : savedStartLimit;

const safeTransportLimit = Number.isFinite(transportLimit)
  ? transportLimit
  : savedTransportLimit;

  const { data, error } = await supabase.rpc("get_transport_sla_alerts_admin", {
    p_accept_limit_minutes: safeAcceptLimit,
    p_start_limit_minutes: safeStartLimit,
    p_transport_limit_minutes: safeTransportLimit
  });

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

  const alerts = (data ?? []) as SlaAlert[];

  const criticalAlerts = alerts.filter(
    (alert) => alert.alert_level === "critical"
  );

  const warningAlerts = alerts.filter(
    (alert) => alert.alert_level !== "critical"
  );

  const urgentAlerts = alerts.filter((alert) => alert.priority === "urgent");
  const pendingAlerts = alerts.filter((alert) => alert.status === "pending");
  const acceptedAlerts = alerts.filter((alert) => alert.status === "accepted");
  const inTransitAlerts = alerts.filter(
    (alert) => alert.status === "in_transit"
  );

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

  page.drawText("Relatório de Alertas de SLA", {
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

  const filterText = `Limites: aceite acima de ${safeAcceptLimit} min · iniciar acima de ${safeStartLimit} min · transporte acima de ${safeTransportLimit} min`;

  page.drawText(sanitizeText(filterText), {
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
      title: "ALERTAS",
      value: alerts.length,
      description: "Fora do SLA"
    },
    {
      title: "CRÍTICOS",
      value: criticalAlerts.length,
      description: "Alta prioridade"
    },
    {
      title: "ATENÇÃO",
      value: warningAlerts.length,
      description: "Atraso moderado"
    },
    {
      title: "URGENTES",
      value: urgentAlerts.length,
      description: "Prioridade urgente"
    },
    {
      title: "PENDENTES",
      value: pendingAlerts.length,
      description: "Aguardando aceite"
    },
    {
      title: "EM TRANSP.",
      value: inTransitAlerts.length,
      description: "Atrasados"
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

  if (alerts.length === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 54,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 50,
      color: rgb(0.94, 0.99, 0.96),
      borderColor: rgb(0.57, 0.86, 0.68),
      borderWidth: 1
    });

    page.drawText("Nenhum alerta ativo no momento.", {
      x: MARGIN + 14,
      y: y - 26,
      size: 11,
      font: boldFont,
      color: rgb(0.04, 0.38, 0.18)
    });

    page.drawText("Todos os transportes ativos estão dentro dos limites configurados.", {
      x: MARGIN + 14,
      y: y - 42,
      size: 9,
      font: regularFont,
      color: rgb(0.04, 0.38, 0.18)
    });

    y -= 76;
  } else if (criticalAlerts.length > 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 54,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 50,
      color: rgb(1, 0.94, 0.94),
      borderColor: rgb(0.96, 0.55, 0.55),
      borderWidth: 1
    });

    page.drawText("Atenção: existem alertas críticos ativos.", {
      x: MARGIN + 14,
      y: y - 26,
      size: 11,
      font: boldFont,
      color: rgb(0.55, 0.04, 0.04)
    });

    page.drawText(
      `${criticalAlerts.length} transporte(s) estão em nível crítico e exigem prioridade de análise.`,
      {
        x: MARGIN + 14,
        y: y - 42,
        size: 9,
        font: regularFont,
        color: rgb(0.55, 0.04, 0.04)
      }
    );

    y -= 76;
  }

  page.drawText("Transportes com alerta de SLA", {
    x: MARGIN,
    y,
    size: 15,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText("Chamados ativos que ultrapassaram os limites configurados.", {
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

  if (alerts.length === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 45,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 44,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.86, 0.9, 0.96),
      borderWidth: 1
    });

    page.drawText("Nenhum transporte fora do SLA encontrado.", {
      x: MARGIN + 14,
      y: y - 24,
      size: 10,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });
  }

  for (const alert of alerts) {
    const originDestination = `${alert.origin_name ?? "-"} -> ${
      alert.destination_name ?? "-"
    }`;

    const messageLines = wrapText({
      text: alert.alert_message,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 34,
      font: regularFont,
      fontSize: 8
    }).slice(0, 2);

    const originLines = wrapText({
      text: originDestination,
      maxWidth: 140,
      font: regularFont,
      fontSize: 7.5
    }).slice(0, 2);

    const assignedLines = wrapText({
      text: alert.assigned_name ?? "Sem responsável",
      maxWidth: 100,
      font: regularFont,
      fontSize: 7.5
    }).slice(0, 2);

    const rowHeight = Math.max(
      54,
      messageLines.length * 10 + 44,
      originLines.length * 10 + 30,
      assignedLines.length * 10 + 30
    );

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

      page.drawText("MoverCare · Alertas de SLA", {
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
      color: alert.alert_level === "critical"
        ? rgb(1, 0.98, 0.98)
        : rgb(1, 0.99, 0.95),
      borderColor: alert.alert_level === "critical"
        ? rgb(0.96, 0.74, 0.74)
        : rgb(0.96, 0.84, 0.55),
      borderWidth: 0.7
    });

    page.drawText(sanitizeText(alert.patient_code).slice(0, 14), {
      x: 48,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });

    page.drawText(getStatusLabel(alert.status), {
      x: 120,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(getAlertLevelLabel(alert.alert_level), {
      x: 190,
      y: y - 10,
      size: 8,
      font: boldFont,
      color:
        alert.alert_level === "critical"
          ? rgb(0.72, 0.06, 0.06)
          : rgb(0.6, 0.35, 0.03)
    });

    page.drawText(getAlertTypeLabel(alert.alert_type), {
      x: 250,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    page.drawText(formatMinutes(alert.elapsed_minutes), {
      x: 365,
      y: y - 10,
      size: 8,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });

    originLines.forEach((line, index) => {
      page.drawText(line, {
        x: 435,
        y: y - 10 - index * 10,
        size: 7.5,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.33)
      });
    });

    assignedLines.forEach((line, index) => {
      page.drawText(line, {
        x: 590,
        y: y - 10 - index * 10,
        size: 7.5,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.33)
      });
    });

    page.drawText(formatDate(getBaseDate(alert)), {
      x: 710,
      y: y - 10,
      size: 7.5,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    messageLines.forEach((line, index) => {
      page.drawText(line, {
        x: 48,
        y: y - 32 - index * 10,
        size: 8,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55)
      });
    });

    y -= rowHeight;
  }

  drawFooter({ page, pageNumber, font: regularFont });

  const pdfBytes = await pdfDoc.save();

  const fileName = `alertas-sla-movercare-${new Date()
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