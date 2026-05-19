import { NextRequest } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SectorRelation = {
  id: string;
  name: string;
  floor: string | null;
};

type ProfileRelation = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
};

type TransportDetails = {
  id: string;
  patient_code: string;
  bed_number: string | null;
  priority: string;
  status: string;
  equipment_required: string[] | null;
  notes: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  requested_by: string;
  assigned_to: string | null;

  transport_reason: string | null;
  risk_classification: string | null;
  precaution_type: string | null;
  required_team: string[] | null;
  required_equipment: string[] | null;
  invasive_devices: string[] | null;
  continuous_medications: string[] | null;
  documents_required: string[] | null;
  destination_contact_confirmed: boolean | null;
  clinical_observations: string | null;

  origin: SectorRelation | SectorRelation[] | null;
  destination: SectorRelation | SectorRelation[] | null;
  requester: ProfileRelation | ProfileRelation[] | null;
  assignee: ProfileRelation | ProfileRelation[] | null;
};

type TransportAuditLog = {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  description: string;
  created_at: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const FOOTER_SAFE_Y = 58;

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

const transportReasonLabels: Record<string, string> = {
  exam: "Realização de exame",
  procedure: "Procedimento terapêutico",
  surgery: "Procedimento cirúrgico",
  bed_transfer: "Transferência de leito",
  interclinic_transfer: "Transferência interclínica",
  hospital_discharge: "Alta hospitalar",
  external_activity: "Atividade externa",
  other: "Outro"
};

const riskClassificationLabels: Record<string, string> = {
  low: "Baixo risco",
  medium: "Médio risco",
  high: "Alto risco"
};

const precautionTypeLabels: Record<string, string> = {
  standard: "Padrão",
  contact: "Contato",
  droplet: "Gotículas",
  aerosol: "Aerossóis / respiratório",
  reverse: "Reverso"
};

const requiredTeamLabels: Record<string, string> = {
  nursing_technician: "Técnico de enfermagem",
  nurse: "Enfermeiro",
  physician: "Médico",
  physiotherapist: "Fisioterapeuta",
  stretcher_bearer: "Maqueiro",
  cleaning_team: "Higienização / limpeza",
  destination_team: "Equipe do setor de destino"
};

const equipmentLabels: Record<string, string> = {
  wheelchair: "Cadeira de rodas",
  stretcher: "Maca",
  oxygen: "Oxigênio",
  oxygen_cylinder: "Cilindro de oxigênio cheio",
  monitor: "Monitor cardíaco / multiparamétrico",
  pulse_oximeter: "Oxímetro de pulso",
  infusion_pump: "Bomba de infusão contínua",
  transport_ventilator: "Ventilador de transporte",
  transport_kit: "Maleta / kit de transporte",
  suction: "Aspirador / sonda de aspiração",
  ppe: "EPIs conforme precaução",
  isolation: "Isolamento",
  other: "Outros"
};

const invasiveDeviceLabels: Record<string, string> = {
  sng: "SNG",
  sne: "SNE",
  svd: "SVD",
  dpt: "DPT",
  tot_tqt: "TOT / TQT",
  khr: "KHR",
  drain: "Dreno",
  dve: "DVE",
  pai: "PAI",
  central_venous_access: "Acesso venoso central",
  peripheral_venous_access: "Acesso venoso periférico",
  dialysis_catheter: "Cateter para diálise",
  other: "Outro"
};

const continuousMedicationLabels: Record<string, string> = {
  vasoactive_drug: "Droga vasoativa",
  sedation: "Sedação contínua",
  insulin: "Insulina contínua",
  antibiotic: "Antibiótico em infusão",
  other: "Outra infusão contínua"
};

const documentLabels: Record<string, string> = {
  medical_record: "Prontuário",
  daily_prescription: "Prescrição do dia",
  laboratory_tests: "Exames laboratoriais",
  ct_scan: "Tomografia / TC",
  surgical_description: "Descrição cirúrgica",
  identification_bracelet: "Pulseira de identificação",
  other: "Outro"
};

const roleLabels: Record<string, string> = {
  nurse: "Enfermeiro",
  stretcher_bearer: "Maqueiro",
  manager: "Gestor",
  admin: "Administrador"
};

const auditActionLabels: Record<string, string> = {
  create_transport: "Transporte criado",
  accept_transport: "Transporte aceito",
  start_transport: "Transporte iniciado",
  complete_transport: "Transporte concluído",
  cancel_transport: "Transporte cancelado",
  fail_transport: "Transporte com falha",
  update_transport: "Transporte atualizado",
  update_transport_status: "Status alterado"
};

function getFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function sanitizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "")
    .trim();
}

function getLabel(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback = "Não informado"
) {
  if (!value) {
    return fallback;
  }

  return labels[value] ?? value;
}

function getStatusLabel(status: string | null) {
  if (!status) {
    return "-";
  }

  return statusLabels[status] ?? status;
}

function getPriorityLabel(priority: string | null) {
  if (!priority) {
    return "-";
  }

  return priorityLabels[priority] ?? priority;
}

function getRoleLabel(role: string | null) {
  if (!role) {
    return "Não informado";
  }

  return roleLabels[role] ?? role;
}

function getActionLabel(action: string) {
  return auditActionLabels[action] ?? action;
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

function formatArray(
  values: string[] | null,
  labels: Record<string, string>,
  emptyText = "Nenhum"
) {
  if (!values || values.length === 0) {
    return emptyText;
  }

  return values.map((item) => labels[item] ?? item).join(", ");
}

function formatEquipment(equipment: string[] | null) {
  return formatArray(equipment, equipmentLabels, "Nenhum");
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
    start: { x: MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: 34 },
    thickness: 0.5,
    color: rgb(0.86, 0.9, 0.96)
  });

  page.drawText("MoverCare - Relatório individual do transporte", {
    x: MARGIN,
    y: 18,
    size: 8,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });

  page.drawText(`Página ${pageNumber}`, {
    x: PAGE_WIDTH - MARGIN - 48,
    y: 18,
    size: 8,
    font,
    color: rgb(0.39, 0.45, 0.55)
  });
}

function drawSectionTitle({
  page,
  title,
  y,
  boldFont
}: {
  page: PDFPage;
  title: string;
  y: number;
  boldFont: PDFFont;
}) {
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.05, 0.09, 0.16)
  });

  page.drawLine({
    start: { x: MARGIN, y: y - 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 8 },
    thickness: 0.7,
    color: rgb(0.86, 0.9, 0.96)
  });
}

function drawInfoRow({
  page,
  label,
  value,
  x,
  y,
  width,
  boldFont
}: {
  page: PDFPage;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  boldFont: PDFFont;
}) {
  page.drawRectangle({
    x,
    y: y - 44,
    width,
    height: 44,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.88, 0.91, 0.96),
    borderWidth: 0.6
  });

  page.drawText(label, {
    x: x + 10,
    y: y - 16,
    size: 8,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  const lines = wrapText({
    text: value,
    maxWidth: width - 20,
    font: boldFont,
    fontSize: 9
  }).slice(0, 2);

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + 10,
      y: y - 31 - index * 10,
      size: 9,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });
  });
}

function drawTextBlock({
  page,
  title,
  text,
  x,
  y,
  width,
  font,
  boldFont,
  maxLines = 10
}: {
  page: PDFPage;
  title: string;
  text: string;
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  boldFont: PDFFont;
  maxLines?: number;
}) {
  const lines = wrapText({
    text,
    maxWidth: width - 24,
    font,
    fontSize: 9
  }).slice(0, maxLines);

  const height = Math.max(58, 36 + lines.length * 12);

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.88, 0.91, 0.96),
    borderWidth: 0.6
  });

  page.drawText(title, {
    x: x + 12,
    y: y - 18,
    size: 8,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55)
  });

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + 12,
      y: y - 34 - index * 12,
      size: 9,
      font,
      color: rgb(0.05, 0.09, 0.16)
    });
  });

  return height;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("name")
    .eq("id", profile.hospital_id)
    .single();

  const { data: transportData, error: transportError } = await supabase
    .from("transports")
    .select(
      `
        id,
        patient_code,
        bed_number,
        priority,
        status,
        equipment_required,
        notes,
        requested_at,
        accepted_at,
        started_at,
        completed_at,
        cancelled_at,
        created_at,
        updated_at,
        requested_by,
        assigned_to,
        transport_reason,
        risk_classification,
        precaution_type,
        required_team,
        required_equipment,
        invasive_devices,
        continuous_medications,
        documents_required,
        destination_contact_confirmed,
        clinical_observations,
        origin:origin_sector_id (
          id,
          name,
          floor
        ),
        destination:destination_sector_id (
          id,
          name,
          floor
        ),
        requester:requested_by (
          id,
          name,
          email,
          role
        ),
        assignee:assigned_to (
          id,
          name,
          email,
          role
        )
      `
    )
    .eq("id", id)
    .eq("hospital_id", profile.hospital_id)
    .single();

  if (transportError || !transportData) {
    notFound();
  }

  const transport = transportData as TransportDetails;

  const { data: auditLogsData } = await supabase
    .from("transport_audit_logs")
    .select(
      `
        id,
        action,
        old_status,
        new_status,
        description,
        created_at,
        actor_name,
        actor_email,
        actor_role
      `
    )
    .eq("transport_id", transport.id)
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: true });

  const auditLogs = (auditLogsData ?? []) as TransportAuditLog[];

  const origin = getFirstRelation(transport.origin);
  const destination = getFirstRelation(transport.destination);
  const requester = getFirstRelation(transport.requester);
  const assignee = getFirstRelation(transport.assignee);

  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageNumber = 1;
  let y = PAGE_HEIGHT - 150;

  function addPage(title?: string) {
    drawFooter({ page, pageNumber, font: regularFont });

    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    y = PAGE_HEIGHT - 58;

    if (title) {
      drawSectionTitle({
        page,
        title,
        y,
        boldFont
      });

      y -= 26;
    }
  }

  function ensureSpace(requiredHeight: number, title?: string) {
    if (y - requiredHeight < FOOTER_SAFE_Y) {
      addPage(title);
    }
  }

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 118,
    width: PAGE_WIDTH,
    height: 118,
    color: rgb(0.03, 0.12, 0.28)
  });

  page.drawText("MoverCare", {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 13,
    font: boldFont,
    color: rgb(0.75, 0.86, 1)
  });

  page.drawText("Relatório Individual do Transporte", {
    x: MARGIN,
    y: PAGE_HEIGHT - 73,
    size: 22,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  page.drawText(sanitizeText(hospitalData?.name ?? "Hospital não encontrado"), {
    x: MARGIN,
    y: PAGE_HEIGHT - 95,
    size: 10,
    font: regularFont,
    color: rgb(0.82, 0.88, 0.96)
  });

  page.drawText(`Emitido em ${formatNow()}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 110,
    size: 8,
    font: regularFont,
    color: rgb(0.82, 0.88, 0.96)
  });

  drawSectionTitle({
    page,
    title: "Identificação do chamado",
    y,
    boldFont
  });

  y -= 24;

  const colGap = 12;
  const colWidth = (PAGE_WIDTH - MARGIN * 2 - colGap) / 2;

  drawInfoRow({
    page,
    label: "Código do paciente",
    value: transport.patient_code,
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Status atual",
    value: getStatusLabel(transport.status),
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 56;

  drawInfoRow({
    page,
    label: "Prioridade",
    value: getPriorityLabel(transport.priority),
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Leito",
    value: transport.bed_number || "-",
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 56;

  drawInfoRow({
    page,
    label: "Origem",
    value: `${origin?.name ?? "-"} ${origin?.floor ? `- ${origin.floor}` : ""}`,
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Destino",
    value: `${destination?.name ?? "-"} ${
      destination?.floor ? `- ${destination.floor}` : ""
    }`,
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 56;

  drawInfoRow({
    page,
    label: "Solicitado por",
    value: requester?.name ?? "-",
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Responsável pelo transporte",
    value: assignee?.name ?? "Sem responsável",
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 70;

  ensureSpace(220, "Horários do chamado");

  drawSectionTitle({
    page,
    title: "Horários do chamado",
    y,
    boldFont
  });

  y -= 24;

  const timeRows = [
    ["Solicitado em", formatDate(transport.requested_at)],
    ["Aceito em", formatDate(transport.accepted_at)],
    ["Iniciado em", formatDate(transport.started_at)],
    ["Concluído em", formatDate(transport.completed_at)],
    ["Cancelado em", formatDate(transport.cancelled_at)],
    ["Atualizado em", formatDate(transport.updated_at)]
  ];

  for (let index = 0; index < timeRows.length; index += 2) {
    const first = timeRows[index];
    const second = timeRows[index + 1];

    drawInfoRow({
      page,
      label: first[0],
      value: first[1],
      x: MARGIN,
      y,
      width: colWidth,
      boldFont
    });

    if (second) {
      drawInfoRow({
        page,
        label: second[0],
        value: second[1],
        x: MARGIN + colWidth + colGap,
        y,
        width: colWidth,
        boldFont
      });
    }

    y -= 56;
  }

  y -= 12;

  ensureSpace(360, "Planejamento seguro do transporte");

  drawSectionTitle({
    page,
    title: "Planejamento seguro do transporte",
    y,
    boldFont
  });

  y -= 24;

  drawInfoRow({
    page,
    label: "Motivo do transporte",
    value: getLabel(transportReasonLabels, transport.transport_reason),
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Classificação de risco",
    value: getLabel(riskClassificationLabels, transport.risk_classification),
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 56;

  drawInfoRow({
    page,
    label: "Precaução / isolamento",
    value: getLabel(precautionTypeLabels, transport.precaution_type),
    x: MARGIN,
    y,
    width: colWidth,
    boldFont
  });

  drawInfoRow({
    page,
    label: "Setor de destino avisado",
    value: transport.destination_contact_confirmed ? "Confirmado" : "Não confirmado",
    x: MARGIN + colWidth + colGap,
    y,
    width: colWidth,
    boldFont
  });

  y -= 60;

  const planningBlocks = [
    {
      title: "Equipe multidisciplinar necessária",
      text: formatArray(transport.required_team, requiredTeamLabels, "Não informado")
    },
    {
      title: "Equipamentos obrigatórios",
      text: formatArray(transport.required_equipment, equipmentLabels, "Não informado")
    },
    {
      title: "Dispositivos invasivos",
      text: formatArray(transport.invasive_devices, invasiveDeviceLabels, "Nenhum informado")
    },
    {
      title: "Medicações / infusões contínuas",
      text: formatArray(
        transport.continuous_medications,
        continuousMedicationLabels,
        "Nenhuma informada"
      )
    },
    {
      title: "Documentos necessários",
      text: formatArray(transport.documents_required, documentLabels, "Nenhum informado")
    }
  ];

  for (const block of planningBlocks) {
    const estimatedLines = wrapText({
      text: block.text,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 24,
      font: regularFont,
      fontSize: 9
    }).slice(0, 8);

    const estimatedHeight = Math.max(58, 36 + estimatedLines.length * 12);

    ensureSpace(estimatedHeight + 10, "Planejamento seguro do transporte - continuação");

    const blockHeight = drawTextBlock({
      page,
      title: block.title,
      text: block.text,
      x: MARGIN,
      y,
      width: PAGE_WIDTH - MARGIN * 2,
      font: regularFont,
      boldFont,
      maxLines: 8
    });

    y -= blockHeight + 10;
  }

  ensureSpace(100, "Planejamento seguro do transporte - continuação");

  const clinicalHeight = drawTextBlock({
    page,
    title: "Observações clínicas e operacionais",
    text:
      transport.clinical_observations ||
      "Nenhuma observação clínica ou operacional registrada.",
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    font: regularFont,
    boldFont,
    maxLines: 10
  });

  y -= clinicalHeight + 18;

  ensureSpace(110, "Informações operacionais");

  drawSectionTitle({
    page,
    title: "Informações operacionais",
    y,
    boldFont
  });

  y -= 26;

  const operationalEquipmentHeight = drawTextBlock({
    page,
    title: "Equipamentos operacionais legados",
    text: formatEquipment(transport.equipment_required),
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    font: regularFont,
    boldFont,
    maxLines: 6
  });

  y -= operationalEquipmentHeight + 10;

  ensureSpace(100, "Informações operacionais - continuação");

  const notesHeight = drawTextBlock({
    page,
    title: "Observações para o maqueiro",
    text: transport.notes || "Nenhuma observação registrada.",
    x: MARGIN,
    y,
    width: PAGE_WIDTH - MARGIN * 2,
    font: regularFont,
    boldFont,
    maxLines: 10
  });

  y -= notesHeight + 22;

  ensureSpace(120, "Rastreabilidade e auditoria");

  drawSectionTitle({
    page,
    title: "Rastreabilidade e auditoria",
    y,
    boldFont
  });

  y -= 26;

  if (auditLogs.length === 0) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 44,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 44,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.88, 0.91, 0.96),
      borderWidth: 0.6
    });

    page.drawText("Nenhum evento de auditoria encontrado para este transporte.", {
      x: MARGIN + 12,
      y: y - 26,
      size: 10,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });

    y -= 60;
  }

  for (const log of auditLogs) {
    const descriptionLines = wrapText({
      text: log.description,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 34,
      font: regularFont,
      fontSize: 9
    }).slice(0, 4);

    const rowHeight = Math.max(68, 54 + descriptionLines.length * 11);

    ensureSpace(rowHeight + 10, "Rastreabilidade e auditoria - continuação");

    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: PAGE_WIDTH - MARGIN * 2,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.91, 0.96),
      borderWidth: 0.6
    });

    page.drawCircle({
      x: MARGIN + 14,
      y: y - 22,
      size: 5,
      color: rgb(0.15, 0.39, 0.92)
    });

    page.drawText(getActionLabel(log.action), {
      x: MARGIN + 30,
      y: y - 18,
      size: 10,
      font: boldFont,
      color: rgb(0.05, 0.09, 0.16)
    });

    page.drawText(formatDate(log.created_at), {
      x: PAGE_WIDTH - MARGIN - 110,
      y: y - 18,
      size: 8,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55)
    });

    page.drawText(
      `Responsável: ${sanitizeText(log.actor_name ?? "Sistema")} - ${getRoleLabel(
        log.actor_role
      )}`,
      {
        x: MARGIN + 30,
        y: y - 33,
        size: 8,
        font: regularFont,
        color: rgb(0.39, 0.45, 0.55)
      }
    );

    page.drawText(
      `Status: ${getStatusLabel(log.old_status)} -> ${getStatusLabel(
        log.new_status
      )}`,
      {
        x: MARGIN + 30,
        y: y - 47,
        size: 8,
        font: boldFont,
        color: rgb(0.2, 0.25, 0.33)
      }
    );

    descriptionLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + 30,
        y: y - 62 - index * 11,
        size: 9,
        font: regularFont,
        color: rgb(0.2, 0.25, 0.33)
      });
    });

    y -= rowHeight + 10;
  }

  drawFooter({ page, pageNumber, font: regularFont });

  const pdfBytes = await pdfDoc.save();

  const fileName = `chamado-${sanitizeText(transport.patient_code).replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  )}-movercare.pdf`;

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