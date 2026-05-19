import { NextRequest } from "next/server";
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

function formatEquipment(equipment: string[] | null) {
  if (!equipment || equipment.length === 0) {
    return "Nenhum";
  }

  const labels: Record<string, string> = {
    wheelchair: "Cadeira de rodas",
    stretcher: "Maca",
    oxygen: "Oxigênio",
    monitor: "Monitor",
    isolation: "Isolamento"
  };

  return equipment.map((item) => labels[item] ?? item).join(", ");
}

function cleanCsvValue(value: string | null | undefined) {
  const text = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `"${text.replace(/"/g, '""')}"`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
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
    return new Response("Transporte não encontrado.", {
      status: 404
    });
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

  const identificationRows = [
    ["Tipo", "Campo", "Valor"],
    ["Identificação", "Hospital", hospitalData?.name ?? "Hospital não encontrado"],
    ["Identificação", "ID do transporte", transport.id],
    ["Identificação", "Código do paciente", transport.patient_code],
    ["Identificação", "Status atual", getStatusLabel(transport.status)],
    ["Identificação", "Prioridade", getPriorityLabel(transport.priority)],
    ["Identificação", "Leito", transport.bed_number || "-"],
    [
      "Identificação",
      "Origem",
      `${origin?.name ?? "-"} ${origin?.floor ? `- ${origin.floor}` : ""}`
    ],
    [
      "Identificação",
      "Destino",
      `${destination?.name ?? "-"} ${
        destination?.floor ? `- ${destination.floor}` : ""
      }`
    ],
    ["Equipe", "Solicitado por", requester?.name ?? "-"],
    ["Equipe", "E-mail do solicitante", requester?.email ?? "-"],
    ["Equipe", "Responsável pelo transporte", assignee?.name ?? "Sem responsável"],
    ["Equipe", "E-mail do responsável", assignee?.email ?? "-"],
    ["Horários", "Solicitado em", formatDate(transport.requested_at)],
    ["Horários", "Aceito em", formatDate(transport.accepted_at)],
    ["Horários", "Iniciado em", formatDate(transport.started_at)],
    ["Horários", "Concluído em", formatDate(transport.completed_at)],
    ["Horários", "Cancelado em", formatDate(transport.cancelled_at)],
    ["Horários", "Criado em", formatDate(transport.created_at)],
    ["Horários", "Atualizado em", formatDate(transport.updated_at)],
    [
      "Operacional",
      "Equipamentos necessários",
      formatEquipment(transport.equipment_required)
    ],
    ["Operacional", "Observações", transport.notes || "Nenhuma observação registrada."]
  ];

  const auditRows = [
    [],
    ["RASTREABILIDADE E AUDITORIA"],
    [
      "Data",
      "Ação",
      "Status anterior",
      "Novo status",
      "Responsável",
      "E-mail",
      "Perfil",
      "Descrição"
    ],
    ...auditLogs.map((log) => [
      formatDate(log.created_at),
      getActionLabel(log.action),
      getStatusLabel(log.old_status),
      getStatusLabel(log.new_status),
      log.actor_name ?? "Sistema",
      log.actor_email ?? "E-mail não informado",
      getRoleLabel(log.actor_role),
      log.description
    ])
  ];

  const rows = [...identificationRows, ...auditRows];

  const csvContent =
    "\uFEFFsep=;\n" +
    rows
      .map((row) => row.map((cell) => cleanCsvValue(cell)).join(";"))
      .join("\n");

  const fileName = `chamado-${sanitizeFileName(
    transport.patient_code
  )}-movercare.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}