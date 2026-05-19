import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditPageProps = {
  searchParams?: Promise<{
    action?: string;
    actor?: string;
    period?: string;
  }>;
};

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

const actionOptions = [
  { value: "all", label: "Todas as ações" },
  { value: "approve_access_request", label: "Aprovação de acesso" },
  { value: "reject_access_request", label: "Recusa de acesso" },
  { value: "regenerate_hospital_access_code", label: "Novo código de convite" },
  { value: "update_user_role", label: "Alteração de perfil" },
  { value: "activate_user", label: "Usuário ativado" },
  { value: "deactivate_user", label: "Usuário inativado" },
  { value: "create_sector", label: "Setor cadastrado" },
  { value: "update_sector", label: "Setor editado" },
  { value: "activate_sector", label: "Setor ativado" },
  { value: "deactivate_sector", label: "Setor inativado" },
  { value: "regenerate_sector_qrcode", label: "Novo QR Code de setor" }
];

const periodOptions = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" }
];

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

function getEntityTypeLabel(entityType: string) {
  const labels: Record<string, string> = {
    access_request: "Solicitação de acesso",
    profile: "Usuário",
    user: "Usuário",
    hospital: "Hospital",
    sector: "Setor",
    sector_qrcode: "QR Code do setor"
  };

  return labels[entityType] ?? entityType;
}

function getActionBadgeClass(action: string) {
  if (
    action === "approve_access_request" ||
    action === "activate_user" ||
    action === "activate_sector" ||
    action === "create_sector"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    action === "reject_access_request" ||
    action === "deactivate_user" ||
    action === "deactivate_sector"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    action === "regenerate_hospital_access_code" ||
    action === "regenerate_sector_qrcode"
  ) {
    return "border-[#f2b709]/50 bg-[#f2b709]/15 text-slate-900";
  }

  if (action === "update_user_role" || action === "update_sector") {
    return "border-[#009da8]/30 bg-[#009da8]/10 text-[#007983]";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
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

function MetricCard({
  label,
  value,
  description,
  tone = "primary"
}: {
  label: string;
  value: string | number;
  description: string;
  tone?: "primary" | "gold" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    primary: "border-[#009da8]/25 bg-white",
    gold: "border-[#f2b709]/50 bg-[#f2b709]/10",
    success: "border-emerald-200 bg-emerald-50/70",
    danger: "border-red-200 bg-red-50/70",
    neutral: "border-slate-200 bg-white"
  }[tone];

  const dotClass = {
    primary: "bg-[#009da8]",
    gold: "bg-[#f2b709]",
    success: "bg-emerald-500",
    danger: "bg-red-500",
    neutral: "bg-slate-400"
  }[tone];

  return (
    <div
      className={`rounded-[1.35rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>

          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <span className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
      </div>

      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;

  const selectedAction = params?.action || "all";
  const selectedPeriod = params?.period || "30d";
  const actorSearch = String(params?.actor || "").trim();

  const profile = await getCurrentProfile();
  const supabase = await createClient();

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

  const sensitiveActions = rejections + userChanges + inviteCodeChanges;

  const pdfParams = new URLSearchParams();

  pdfParams.set("action", selectedAction);
  pdfParams.set("period", selectedPeriod);

  if (actorSearch) {
    pdfParams.set("actor", actorSearch);
  }

  const pdfHref = `/settings/audit/pdf?${pdfParams.toString()}`;
  const csvHref = `/settings/audit/csv?${pdfParams.toString()}`;

  return (
    <DashboardShell
      title="Auditoria administrativa"
      description="Acompanhe ações sensíveis realizadas por gestores e administradores."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Segurança administrativa
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Auditoria administrativa
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Acompanhe aprovações, recusas, alterações de usuários,
                  setores, QR Codes e códigos de convite realizados no
                  MoverCare.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={pdfHref}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#009da8] shadow-sm transition hover:bg-slate-50"
                >
                  Exportar PDF
                </Link>

                <Link
                  href={csvHref}
                  className="rounded-2xl bg-[#f2b709] px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:brightness-95"
                >
                  Exportar CSV
                </Link>

                <Link
                  href="/settings"
                  className="rounded-2xl border border-white/40 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Configurações
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Registros"
              value={logs.length}
              description="Eventos filtrados"
              tone="primary"
            />

            <MetricCard
              label="Aprovações"
              value={approvals}
              description="Solicitações aprovadas"
              tone="success"
            />

            <MetricCard
              label="Recusas"
              value={rejections}
              description="Solicitações recusadas"
              tone={rejections > 0 ? "danger" : "neutral"}
            />

            <MetricCard
              label="Usuários"
              value={userChanges}
              description="Perfis, ativações e inativações"
              tone="gold"
            />

            <MetricCard
              label="Setores"
              value={sectorChanges}
              description="Cadastro, edição e QR Codes"
              tone="primary"
            />

            <MetricCard
              label="Convites"
              value={inviteCodeChanges}
              description="Códigos de convite gerados"
              tone="gold"
            />
          </div>
        </section>

        {logsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            Erro ao carregar auditoria: {logsError.message}
          </div>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Filtros da auditoria
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Use os filtros para localizar rapidamente uma ação administrativa.
          </p>

          <form className="mt-5 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="text-sm font-black text-slate-700">
                Tipo de ação
              </label>

              <select
                name="action"
                defaultValue={selectedAction}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              >
                {actionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">
                Responsável
              </label>

              <input
                name="actor"
                defaultValue={actorSearch}
                placeholder="Nome ou e-mail"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">
                Período
              </label>

              <select
                name="period"
                defaultValue={selectedPeriod}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button className="flex-1 rounded-xl bg-[#009da8] px-4 py-3 text-sm font-black text-white transition hover:brightness-95">
                Filtrar
              </button>

              <Link
                href="/settings/audit"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Limpar
              </Link>
            </div>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Ação filtrada"
            value={
              actionOptions.find((option) => option.value === selectedAction)
                ?.label ?? "Todas"
            }
            description="Tipo de evento selecionado"
            tone="primary"
          />

          <MetricCard
            label="Período"
            value={
              periodOptions.find((option) => option.value === selectedPeriod)
                ?.label ?? "Últimos 30 dias"
            }
            description="Intervalo da consulta"
            tone="gold"
          />

          <MetricCard
            label="Ações sensíveis"
            value={sensitiveActions}
            description="Recusas, usuários e convites"
            tone={sensitiveActions > 0 ? "danger" : "neutral"}
          />
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Histórico administrativo
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Histórico de ações
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Exibindo até 300 registros conforme os filtros aplicados.
              </p>
            </div>

            <p className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#009da8]">
              {logs.length} registro{logs.length === 1 ? "" : "s"}
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-semibold text-slate-500">
              Nenhum registro encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead className="bg-[#009da8]/10 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-black">Data</th>
                    <th className="px-4 py-3 font-black">Responsável</th>
                    <th className="px-4 py-3 font-black">Ação</th>
                    <th className="px-4 py-3 font-black">Descrição</th>
                    <th className="px-4 py-3 font-black">Entidade</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-slate-200 align-top text-slate-700"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                        {formatDate(log.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black text-slate-950">
                          {log.actor_name ?? "Usuário não informado"}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {log.actor_email ?? "E-mail não informado"}
                        </p>

                        <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {getRoleLabel(log.actor_role)}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {getActionLabel(log.action)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="max-w-xl font-semibold leading-6 text-slate-700">
                          {log.description}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="inline-flex rounded-full border border-[#009da8]/20 bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#007983]">
                          {getEntityTypeLabel(log.entity_type)}
                        </p>

                        {log.entity_id ? (
                          <p className="mt-2 max-w-[220px] break-all font-mono text-[11px] font-semibold text-slate-400">
                            {log.entity_id}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}