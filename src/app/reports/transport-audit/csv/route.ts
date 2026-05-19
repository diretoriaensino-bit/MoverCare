import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TransportAuditLog = {
  id: string;
  transport_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  description: string;
  created_at: string;
};

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    create_transport: "Transporte criado",
    accept_transport: "Transporte aceito",
    start_transport: "Transporte iniciado",
    complete_transport: "Transporte concluído",
    cancel_transport: "Transporte cancelado",
    fail_transport: "Transporte com falha",
    update_transport: "Transporte atualizado",
    update_transport_status: "Status alterado"
  };

  return labels[action] ?? action;
}

function getStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    accepted: "Aceito",
    in_transit: "Em transporte",
    completed: "Concluído",
    cancelled: "Cancelado",
    failed: "Falha"
  };

  if (!status) {
    return "Não informado";
  }

  return labels[status] ?? status;
}

function getRoleLabel(role: string | null) {
  const labels: Record<string, string> = {
    nurse: "Enfermeiro",
    stretcher_bearer: "Maqueiro",
    manager: "Gestor",
    admin: "Administrador"
  };

  if (!role) {
    return "Não informado";
  }

  return labels[role] ?? role;
}

function getPeriodStartDate(period: string) {
  if (period === "all") {
    return null;
  }

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

function cleanCsvValue(value: string | null | undefined) {
  const text = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const searchParams = request.nextUrl.searchParams;

  const selectedAction = searchParams.get("action") || "all";
  const selectedStatus = searchParams.get("status") || "all";
  const selectedPeriod = searchParams.get("period") || "30d";
  const actorSearch = String(searchParams.get("actor") || "").trim();

  let auditQuery = supabase
    .from("transport_audit_logs")
    .select(
      "id, transport_id, actor_name, actor_email, actor_role, action, old_status, new_status, description, created_at"
    )
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (selectedAction !== "all") {
    auditQuery = auditQuery.eq("action", selectedAction);
  }

  if (selectedStatus !== "all") {
    auditQuery = auditQuery.eq("new_status", selectedStatus);
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

  const rawLogs = (logsData ?? []) as TransportAuditLog[];

  const logs = actorSearch
    ? rawLogs.filter((log) => {
        const actorName = log.actor_name?.toLowerCase() ?? "";
        const actorEmail = log.actor_email?.toLowerCase() ?? "";
        const search = actorSearch.toLowerCase();

        return actorName.includes(search) || actorEmail.includes(search);
      })
    : rawLogs;

  const rows = [
    [
      "Data",
      "Responsável",
      "E-mail do responsável",
      "Perfil do responsável",
      "Ação",
      "Status anterior",
      "Novo status",
      "Descrição",
      "ID do transporte"
    ],
    ...logs.map((log) => [
      formatDate(log.created_at),
      log.actor_name ?? "Usuário não informado",
      log.actor_email ?? "E-mail não informado",
      getRoleLabel(log.actor_role),
      getActionLabel(log.action),
      getStatusLabel(log.old_status),
      getStatusLabel(log.new_status),
      log.description,
      log.transport_id
    ])
  ];

  const csvContent =
    "\uFEFFsep=;\n" +
    rows
      .map((row) => row.map((cell) => cleanCsvValue(cell)).join(";"))
      .join("\n");

  const fileName = `auditoria-transportes-movercare-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}