import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { toggleUserActiveAction, updateUserRoleAction } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UsersSettingsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

const roleOptions = [
  {
    value: "nurse",
    label: "Enfermeiro"
  },
  {
    value: "stretcher_bearer",
    label: "Maqueiro"
  },
  {
    value: "manager",
    label: "Gestor"
  },
  {
    value: "admin",
    label: "Administrador"
  }
];

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    nurse: "Enfermeiro",
    stretcher_bearer: "Maqueiro",
    manager: "Gestor",
    admin: "Administrador"
  };

  return labels[role] ?? role;
}

function UserStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
          : "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
      }
    >
      {active ? "Usuário ativo" : "Usuário inativo"}
    </span>
  );
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

function canCurrentUserManageTarget({
  currentUserRole,
  targetRole
}: {
  currentUserRole: string;
  targetRole: string;
}) {
  if (currentUserRole === "admin") {
    return true;
  }

  if (currentUserRole === "manager" && targetRole !== "admin") {
    return true;
  }

  return false;
}

export default async function UsersSettingsPage({
  searchParams
}: UsersSettingsPageProps) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: usersData, error: usersError } = await supabase
    .from("profiles")
    .select("id, name, email, role, active")
    .eq("hospital_id", profile.hospital_id)
    .order("name", { ascending: true });

  const { count: pendingAccessRequests } = await supabase
    .from("access_requests")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", profile.hospital_id)
    .eq("status", "pending");

  const users = (usersData ?? []) as UserProfile[];

  const activeUsers = users.filter((user) => user.active).length;
  const inactiveUsers = users.filter((user) => !user.active).length;

  const nurses = users.filter((user) => user.role === "nurse").length;
  const stretcherBearers = users.filter(
    (user) => user.role === "stretcher_bearer"
  ).length;
  const managers = users.filter((user) => user.role === "manager").length;
  const admins = users.filter((user) => user.role === "admin").length;

  const pendingRequests = pendingAccessRequests ?? 0;

  return (
    <DashboardShell
      title="Gerenciar usuários"
      description="Controle perfis de acesso, funções e status dos usuários."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Gerenciamento de usuários
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Ative, inative, aprove solicitações e altere permissões sem apagar
              o histórico do sistema.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/settings/users/requests"
              className={
                pendingRequests > 0
                  ? "w-fit rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
                  : "w-fit rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              }
            >
              Solicitações de acesso
              {pendingRequests > 0 ? ` (${pendingRequests})` : ""}
            </Link>

            <Link
              href="/settings"
              className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Voltar para configurações
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

        {usersError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Erro ao carregar usuários: {usersError.message}
          </div>
        ) : null}

        {pendingRequests > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-amber-900">
                  Existem solicitações aguardando aprovação
                </h2>

                <p className="mt-1 text-sm text-amber-800">
                  Analise os cadastros pendentes antes de liberar acesso ao
                  sistema.
                </p>
              </div>

              <Link
                href="/settings/users/requests"
                className="w-fit rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                Analisar agora
              </Link>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total de usuários"
            value={users.length}
            description="Perfis vinculados ao hospital"
          />

          <MetricCard
            label="Usuários ativos"
            value={activeUsers}
            description="Podem acessar o sistema"
          />

          <MetricCard
            label="Usuários inativos"
            value={inactiveUsers}
            description="Bloqueados para acesso"
          />

          <MetricCard
            label="Solicitações pendentes"
            value={pendingRequests}
            description="Aguardando aprovação"
          />

          <MetricCard
            label="Maqueiros"
            value={stretcherBearers}
            description="Usuários operacionais do app mobile"
          />

          <MetricCard
            label="Enfermeiros"
            value={nurses}
            description="Usuários que criam requisições"
          />

          <MetricCard
            label="Gestores"
            value={managers}
            description="Usuários com acesso gerencial"
          />

          <MetricCard
            label="Administradores"
            value={admins}
            description="Usuários com permissão máxima"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Usuários cadastrados
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Edite o perfil ou bloqueie o acesso de usuários quando necessário.
          </p>

          {users.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {users.map((user) => {
                const isCurrentUser = user.id === profile.id;
                const canManageTarget = canCurrentUserManageTarget({
                  currentUserRole: profile.role,
                  targetRole: user.role
                });

                const availableRoleOptions =
                  profile.role === "admin"
                    ? roleOptions
                    : roleOptions.filter((option) => option.value !== "admin");

                return (
                  <div
                    key={user.id}
                    className={
                      user.active
                        ? "rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        : "rounded-2xl border border-slate-200 bg-slate-100 p-5 opacity-80"
                    }
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-950">
                            {user.name}
                          </h3>

                          {isCurrentUser ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              Você
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {user.email}
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Perfil atual: {getRoleLabel(user.role)}
                        </p>
                      </div>

                      <UserStatusBadge active={user.active} />
                    </div>

                    {!canManageTarget ? (
                      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        Você não pode gerenciar este usuário.
                      </div>
                    ) : (
                      <>
                        <form
                          action={updateUserRoleAction}
                          className="mt-5 space-y-4"
                        >
                          <input
                            type="hidden"
                            name="profile_id"
                            value={user.id}
                          />

                          <div>
                            <label className="text-sm font-semibold text-slate-700">
                              Alterar perfil
                            </label>

                            <select
                              name="role"
                              defaultValue={user.role}
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                            >
                              {availableRoleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700">
                            Salvar perfil
                          </button>
                        </form>

                        <div className="mt-4 rounded-xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Status de acesso
                          </p>

                          <p className="mt-2 text-sm text-slate-600">
                            {user.active
                              ? "Este usuário pode acessar o sistema."
                              : "Este usuário está bloqueado para acesso."}
                          </p>

                          <form
                            action={toggleUserActiveAction}
                            className="mt-3"
                          >
                            <input
                              type="hidden"
                              name="profile_id"
                              value={user.id}
                            />

                            <input
                              type="hidden"
                              name="next_active"
                              value={user.active ? "false" : "true"}
                            />

                            <button
                              disabled={isCurrentUser && user.active}
                              className={
                                isCurrentUser && user.active
                                  ? "w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400"
                                  : user.active
                                    ? "w-full rounded-xl border border-red-600 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
                                    : "w-full rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                              }
                            >
                              {user.active
                                ? isCurrentUser
                                  ? "Não é possível inativar você mesmo"
                                  : "Inativar usuário"
                                : "Reativar usuário"}
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}