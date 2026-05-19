import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditLog = {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    approve_access_request: "Aprovação de acesso",
    reject_access_request: "Recusa de acesso",
    regenerate_hospital_access_code: "Novo código de convite",
    update_user_role: "Alteração de perfil",
    activate_user: "Usuário ativado",
    deactivate_user: "Usuário inativado",
    create_sector: "Setor cadastrado",
    update_sector: "Setor editado",
    activate_sector: "Setor ativado",
    deactivate_sector: "Setor inativado",
    regenerate_sector_qrcode: "Novo QR Code de setor"
  };

  return labels[action] ?? action;
}

function getRoleLabel(role: string | null) {
  const labels: Record<string, string> = {
    nurse: "Enfermeiro",
    stretcher_bearer: "Maqueiro",
    manager: "Gestor",
    admin: "Administrador"
  };

  if (!role) return "Não informado";

  return labels[role] ?? role;
}

function getPeriodLabel(period: string) {
  const labels: Record<string, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    all: "Todo o período"
  };

  return labels[period] ?? "Últimos 30 dias";
}

function getPeriodStartDate(period: string) {
  if (period === "all") return null;

  const now = new Date();
  const date = new Date(now);

  if (period === "7d") {
    date.setDate(now.getDate() - 7);
    return date.toISOString();
  }

  if (period === "90d") {
    date.setDate(now.getDate() - 90);
    return date.toISOString();
  }

  date.setDate(now.getDate() - 30);
  return date.toISOString();
}

function formatDate(value: string) {
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

function sanitizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}

function wrapText({
  text,
  maxWidth,
  font,
  fontSize
}: {
  text: string;
  maxWidth: number;
  font: any;
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
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [""];
}

function drawRoundedCard({
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
  page: any;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  value: string | number;
  description: string;
  font: any;
  boldFont: any;
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
    x: x + 14,
    y: y + height - 22,
    size: 9,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  page.drawText(String(value), {
    x: x + 14,
    y: y + height - 50,
    size: 22,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText(description, {
    x: x + 14,
    y: y + 12,
    size: 8,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });
}

function drawFooter({
  page,
  pageNumber,
  font
}: {
  page: any;
  pageNumber: number;
  font: any;
}) {
  page.drawLine({
    start: { x: MARGIN, y: 26 },
    end: { x: PAGE_WIDTH - MARGIN, y: 26 },
    thickness: 0.5,
    color: rgb(0.86, 0.9, 0.96)
  });

  page.drawText("MoverCare · Auditoria administrativa", {
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

function drawTableHeader({
  page,
  y,
  boldFont
}: {
  page: any;
  y: number;
  boldFont: any;
}) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 26,
    color: rgb(0.95, 0.97, 1)
  });

  const headers = [
    { label: "Data", x: 46 },
    { label: "Responsável", x: 122 },
    { label: "Ação", x: 260 },
    { label: "Descrição", x: 390 },
    { label: "Entidade", x: 735 }
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

  const selectedAction = searchParams.get("action") || "all";
  const selectedPeriod = searchParams.get("period") || "30d";
  const actorSearch = String(searchParams.get("actor") || "").trim();

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("name")
    .eq("id", profile.hospital_id)
    .single();

  let auditQuery = supabase
    .from("admin_audit_logs")
    .select(
      "id, actor_name, actor_email, actor_role, action, entity_type, entity_id, description, created_at"
    )
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (selectedAction !== "all") {
    auditQuery = auditQuery.eq("action", selectedAction);
  }

  const periodStartDate = getPeriodStartDate(selectedPeriod);

  if (periodStartDate) {
    auditQuery = auditQuery.gte("created_at", periodStartDate);
  }

  const { data: logsData, error: logsError } = await auditQuery;

  if (logsError) {
    return Response.json(
      {
        error: logsError.message
      },
      {
        status: 500
      }
    );
  }

  const rawLogs = (logsData ?? []) as AuditLog[];

  const logs = actorSearch
    ? rawLogs.filter((log) => {
        const actorName = log.actor_name?.toLowerCase() ?? "";
        const actorEmail = log.actor_email?.toLowerCase() ?? "";
        const search = actorSearch.toLowerCase();

        return actorName.includes(search) || actorEmail.includes(search);
      })
    : rawLogs;

  const approvals = logs.filter(
    (log) => log.action === "approve_access_request"
  ).length;

  const rejections = logs.filter(
    (log) => log.action === "reject_access_request"
  ).length;

  const userChanges = logs.filter(
    (log) =>
      log.action === "update_user_role" ||
      log.action === "activate_user" ||
      log.action === "deactivate_user"
  ).length;

  const sectorChanges = logs.filter(
    (log) =>
      log.action === "create_sector" ||
      log.action === "update_sector" ||
      log.action === "activate_sector" ||
      log.action === "deactivate_sector" ||
      log.action === "regenerate_sector_qrcode"
  ).length;

  const inviteCodeChanges = logs.filter(
    (log) => log.action === "regenerate_hospital_access_code"
  ).length;

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

  page.drawText("Relatório de Auditoria Administrativa", {
    x: MARGIN,
    y: PAGE_HEIGHT - 72,
    size: 23,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  page.drawText(
    sanitizeText(hospitalData?.name ?? "Hospital não encontrado"),
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 94,
      size: 10,
      font: regularFont,
      color: rgb(0.82, 0.88, 0.96)
    }
  );

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

  const filterText = `Filtros: ação = ${
    selectedAction === "all" ? "Todas as ações" : getActionLabel(selectedAction)
  } · responsável = ${
    actorSearch || "Todos"
  } · período = ${getPeriodLabel(selectedPeriod)}`;

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
      title: "REGISTROS",
      value: logs.length,
      description: "Eventos filtrados"
    },
    {
      title: "APROVAÇÕES",
      value: approvals,
      description: "Acessos aprovados"
    },
    {
      title: "RECUSAS",
      value: rejections,
      description: "Acessos recusados"
    },
    {
      title: "USUÁRIOS",
      value: userChanges,
      description: "Perfis e status"
    },
    {
      title: "SETORES",
      value: sectorChanges,
      description: "Setores e QR"
    },
    {
      title: "CONVITES",
      value: inviteCodeChanges,
      description: "Códigos gerados"
    }
  ];

  cards.forEach((card, index) => {
    drawRoundedCard({
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

  page.drawText("Histórico de ações administrativas", {
    x: MARGIN,
    y: cardTop - 34,
    size: 15,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawText("Exibindo até 300 registros conforme os filtros aplicados.", {
    x: MARGIN,
    y: cardTop - 52,
    size: 9,
    font: regularFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  let y = cardTop - 80;

  drawTableHeader({
    page,
    y,
    boldFont
  });

  y -= 34;

  if (logs.length === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 45,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 44,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.86, 0.9, 0.96),
      borderWidth: 1
    });

    page.drawText("Nenhum registro encontrado com os filtros selecionados.", {
      x: MARGIN + 14,
      y: y - 24,
      size: 10,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });
  }

  for (const log of logs) {
    const actorText = `${log.actor_name ?? "Não informado"}\n${
      log.actor_email ?? "E-mail não informado"
    }\n${getRoleLabel(log.actor_role)}`;

    const actionText = getActionLabel(log.action);
    const descriptionLines = wrapText({
      text: log.description,
      maxWidth: 330,
      font: regularFont,
      fontSize: 8
    }).slice(0, 5);

    const actorLines = actorText.split("\n");
    const actionLines = wrapText({
      text: actionText,
      maxWidth: 105,
      font: boldFont,
      fontSize: 8
    }).slice(0, 2);

    const entityLines = wrapText({
      text: log.entity_type,
      maxWidth: 70,
      font: regularFont,
      fontSize: 8
    }).slice(0, 2);

    const rowHeight = Math.max(
      52,
      descriptionLines.length * 11 + 18,
      actorLines.length * 10 + 18
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

      page.drawText("MoverCare · Auditoria administrativa", {
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

    page.drawText(formatDate(log.created_at), {
      x: 46,
      y: y - 10,
      size: 8,
      font: regularFont,
      color: rgb(0.2, 0.25, 0.33)
    });

    actorLines.forEach((line, index) => {
      page.drawText(sanitizeText(line).slice(0, 32), {
        x: 122,
        y: y - 10 - index * 10,
        size: index === 0 ? 8 : 7,
        font: index === 0 ? boldFont : regularFont,
        color: index === 0 ? rgb(0.05, 0.09, 0.16) : rgb(0.39, 0.45, 0.55)
      });
    });

    actionLines.forEach((line, index) => {
      page.drawText(line, {
        x: 260,
        y: y - 10 - index * 10,
        size: 8,
        font: boldFont,
        color: rgb(0.12, 0.31, 0.63)
      });
    });

    descriptionLines.forEach((line, index) => {
      page.drawText(line, {
        x: 390,
        y: y - 10 - index * 11,
        size: 8,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.33)
      });
    });

    entityLines.forEach((line, index) => {
      page.drawText(line, {
        x: 735,
        y: y - 10 - index * 10,
        size: 8,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55)
      });
    });

    y -= rowHeight;
  }

  drawFooter({ page, pageNumber, font: regularFont });

  const pdfBytes = await pdfDoc.save();

  const fileName = `auditoria-movercare-${new Date()
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