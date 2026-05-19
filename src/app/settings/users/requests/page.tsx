import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  approveAccessRequestAction,
  rejectAccessRequestAction,
  regenerateHospitalAccessCodeAction
} from "./actions";
import InviteAccessCard from "@/components/settings/invite-access-card";


export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccessRequestsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type AccessRequest = {
  id: string;
  full_name: string;
  email: string;
  requested_role: string;
  status: "pending" | "approved" | "rejected";
  request_message: string | null;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    nurse: "Enfermeiro",
    stretcher_bearer: "Maqueiro",
    manager: "Gestor",
    admin: "Administrador"
  };

  return labels[role] ?? role;
}

function getStatusBadge(status: AccessRequest["status"]) {
  const styles: Record<AccessRequest["status"], string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700"
  };

  const labels: Record<AccessRequest["status"], string> = {
    pending: "Pendente",
    approved: "Aprovada",
    rejected: "Recusada"
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  description
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default async function AccessRequestsPage({
  searchParams
}: AccessRequestsPageProps) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: hospitalData } = await supabase
  .from("hospitals")
  .select("id, name, access_code")
  .eq("id", profile.hospital_id)
  .single();

  const { data: requestsData, error: requestsError } = await supabase
    .from("access_requests")
    .select(
      "id, full_name, email, requested_role, status, request_message, reject_reason, created_at, reviewed_at"
    )
    .eq("hospital_id", profile.hospital_id)
    .order("created_at", { ascending: false });

  const requests = (requestsData ?? []) as AccessRequest[];

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  );
  const approvedRequests = requests.filter(
    (request) => request.status === "approved"
  );
  const rejectedRequests = requests.filter(
    (request) => request.status === "rejected"
  );

  return (
    <DashboardShell
      title="Solicitações de acesso"
      description="Aprove ou recuse novos cadastros de funcionários."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Solicitações de acesso
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Analise cadastros enviados pela página pública de solicitação de
              acesso.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings/users"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Voltar para usuários
            </Link>

            <Link
              href="/register"
              className="rounded-xl border border-blue-600 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              Página de cadastro
            </Link>
          </div>
        </div>

        {params?.success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {params.success}
          </div>
        ) : null}

        {params?.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {params.error}
          </div>
        ) : null}

        {requestsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Erro ao carregar solicitações: {requestsError.message}
          </div>
        ) : null}
<InviteAccessCard
  hospitalName={hospitalData?.name ?? "Hospital não encontrado"}
  accessCode={hospitalData?.access_code ?? null}
  regenerateAction={regenerateHospitalAccessCodeAction}
/>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total"
            value={requests.length}
            description="Solicitações recebidas"
          />

          <MetricCard
            label="Pendentes"
            value={pendingRequests.length}
            description="Aguardando análise"
          />

          <MetricCard
            label="Aprovadas"
            value={approvedRequests.length}
            description="Usuários liberados"
          />

          <MetricCard
            label="Recusadas"
            value={rejectedRequests.length}
            description="Solicitações negadas"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Pendentes de análise
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Aprove somente funcionários confirmados pelo hospital.
          </p>

          {pendingRequests.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nenhuma solicitação pendente.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {request.full_name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-600">
                        {request.email}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        Função solicitada:{" "}
                        {getRoleLabel(request.requested_role)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Enviada em {formatDate(request.created_at)}
                      </p>
                    </div>

                    {getStatusBadge(request.status)}
                  </div>

                  {request.request_message ? (
                    <div className="mt-4 rounded-xl bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Mensagem do funcionário
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {request.request_message}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <form action={approveAccessRequestAction}>
                      <input
                        type="hidden"
                        name="request_id"
                        value={request.id}
                      />

                      <button className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                        Aprovar acesso
                      </button>
                    </form>

                    <form action={rejectAccessRequestAction} className="space-y-3">
                      <input
                        type="hidden"
                        name="request_id"
                        value={request.id}
                      />

                      <input
                        name="reason"
                        placeholder="Motivo da recusa opcional"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500"
                      />

                      <button className="w-full rounded-xl border border-red-600 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50">
                        Recusar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Histórico de solicitações
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Lista geral com solicitações aprovadas, recusadas e pendentes.
          </p>

          {requests.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nenhuma solicitação encontrada.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">E-mail</th>
                    <th className="px-4 py-3 font-semibold">Função</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Solicitado em</th>
                    <th className="px-4 py-3 font-semibold">Analisado em</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-t border-slate-200 text-slate-700"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        {request.full_name}
                      </td>

                      <td className="px-4 py-3">{request.email}</td>

                      <td className="px-4 py-3">
                        {getRoleLabel(request.requested_role)}
                      </td>

                      <td className="px-4 py-3">
                        {getStatusBadge(request.status)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(request.created_at)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(request.reviewed_at)}
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