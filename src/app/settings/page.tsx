import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createSectorAction,
  regenerateSectorQRCodeAction,
  toggleSectorActiveAction,
  updateSectorAction
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SettingsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type Sector = {
  id: string;
  name: string;
  floor: string | null;
  qr_code: string | null;
  active: boolean;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type Hospital = {
  id: string;
  name: string;
};

function SectorActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
          : "rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"
      }
    >
      {active ? "Setor ativo" : "Setor inativo"}
    </span>
  );
}

function QRStatusBadge({ qrCode }: { qrCode: string | null }) {
  if (qrCode && qrCode.trim() !== "") {
    return (
      <span className="rounded-full border border-[#009da8]/30 bg-[#009da8]/10 px-3 py-1 text-xs font-black text-[#007983]">
        QR cadastrado
      </span>
    );
  }

  return (
    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
      QR faltante
    </span>
  );
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

function ShortcutCard({
  href,
  title,
  description,
  action,
  tone = "primary"
}: {
  href: string;
  title: string;
  description: string;
  action: string;
  tone?: "primary" | "gold" | "success" | "danger" | "neutral";
}) {
  const toneClass = {
    primary:
      "border-[#009da8]/25 bg-white hover:border-[#009da8]/60 hover:bg-[#009da8]/5",
    gold:
      "border-[#f2b709]/50 bg-[#f2b709]/10 hover:border-[#f2b709] hover:bg-[#f2b709]/20",
    success:
      "border-emerald-200 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-50",
    danger:
      "border-red-200 bg-red-50/70 hover:border-red-400 hover:bg-red-50",
    neutral:
      "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
  }[tone];

  const actionClass = {
    primary: "text-[#009da8]",
    gold: "text-slate-900",
    success: "text-emerald-700",
    danger: "text-red-700",
    neutral: "text-slate-700"
  }[tone];

  return (
    <Link
      href={href}
      className={`rounded-[1.35rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
    >
      <h2 className="text-lg font-black text-slate-950">{title}</h2>

      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      <p className={`mt-4 text-sm font-black ${actionClass}`}>{action}</p>
    </Link>
  );
}

export default async function SettingsPage({
  searchParams
}: SettingsPageProps) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("id, name")
    .eq("id", profile.hospital_id)
    .single();

  const { data: sectorsData, error: sectorsError } = await supabase
    .from("sectors")
    .select("id, name, floor, qr_code, active")
    .eq("hospital_id", profile.hospital_id)
    .order("name", { ascending: true });

  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, name, email, role, active")
    .eq("hospital_id", profile.hospital_id)
    .order("name", { ascending: true });

  const hospital = hospitalData as Hospital | null;
  const sectors = (sectorsData ?? []) as Sector[];
  const users = (usersData ?? []) as UserProfile[];

  const activeSectors = sectors.filter((sector) => sector.active).length;
  const inactiveSectors = sectors.filter((sector) => !sector.active).length;

  const sectorsWithoutQr = sectors.filter(
    (sector) => !sector.qr_code || sector.qr_code.trim() === ""
  ).length;

  const activeUsers = users.filter((user) => user.active).length;
  const inactiveUsers = users.filter((user) => !user.active).length;

  return (
    <DashboardShell
      title="Configurações"
      description="Gerencie dados estruturais do hospital, setores, usuários e QR Codes."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.7rem] border border-[#009da8]/20 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#009da8] via-[#009da8] to-[#006c74] p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  Administração do sistema
                </p>

                <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                  Configurações do MoverCare
                </h1>

                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white/85">
                  Organize setores, QR Codes, usuários, auditorias, SLA e
                  relatórios administrativos da unidade hospitalar.
                </p>
              </div>

              <div className="rounded-2xl border border-white/25 bg-white/10 px-5 py-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-[#f2b709]">
                  Hospital vinculado
                </p>

                <p className="mt-1 text-lg font-black text-white">
                  {hospital?.name ?? "Não encontrado"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Setores"
              value={sectors.length}
              description="Total de setores cadastrados"
              tone="primary"
            />

            <MetricCard
              label="Setores ativos"
              value={activeSectors}
              description="Disponíveis para novos transportes"
              tone="success"
            />

            <MetricCard
              label="Setores inativos"
              value={inactiveSectors}
              description="Mantidos apenas no histórico"
              tone="neutral"
            />

            <MetricCard
              label="Usuários"
              value={users.length}
              description={`${activeUsers} ativos · ${inactiveUsers} inativos`}
              tone="gold"
            />

            <MetricCard
              label="QR faltantes"
              value={sectorsWithoutQr}
              description="Setores sem código de validação"
              tone={sectorsWithoutQr > 0 ? "danger" : "success"}
            />

            <MetricCard
              label="Unidade"
              value={hospital ? "Ativa" : "Erro"}
              description={hospital?.name ?? "Hospital não encontrado"}
              tone={hospital ? "primary" : "danger"}
            />
          </div>
        </section>

        {params?.success ? (
          <div className="rounded-2xl border border-[#009da8]/25 bg-[#009da8]/10 p-4 text-sm font-bold text-[#007983] shadow-sm">
            {params.success}
          </div>
        ) : null}

        {params?.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            {params.error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ShortcutCard
            href="/settings/sector-qrcodes"
            title="QR Codes dos setores"
            description="Visualize, gere e imprima QR Codes usados na validação pelo app mobile."
            action="Abrir QR Codes →"
            tone="primary"
          />

          <ShortcutCard
            href="/settings/users"
            title="Gerenciar usuários"
            description="Altere perfis, ative ou inative acessos de usuários do hospital."
            action="Abrir usuários →"
            tone="gold"
          />

          <ShortcutCard
            href="/settings/users/requests"
            title="Solicitações de acesso"
            description="Aprove ou recuse pedidos de entrada feitos por novos profissionais."
            action="Ver solicitações →"
            tone="success"
          />

          <ShortcutCard
            href="/settings/sla"
            title="Configurações de SLA"
            description="Defina os limites de tempo para aceite, início e conclusão dos transportes."
            action="Configurar SLA →"
            tone="danger"
          />

          <ShortcutCard
            href="/settings/audit"
            title="Auditoria administrativa"
            description="Veja ações sensíveis realizadas por gestores e administradores."
            action="Abrir auditoria →"
            tone="gold"
          />

          <ShortcutCard
            href="/reports/monthly"
            title="Relatórios mensais"
            description="Gere relatórios consolidados, PDF mensal e limpeza segura de dados antigos."
            action="Abrir relatórios →"
            tone="success"
          />

          <ShortcutCard
            href="/reports"
            title="Central de relatórios"
            description="Acesse indicadores, auditorias, SLA e análises operacionais."
            action="Abrir relatórios →"
            tone="primary"
          />

          <ShortcutCard
            href="/manager"
            title="Painel gestor"
            description="Acesse indicadores, gráficos reais e exportação em PDF do painel."
            action="Abrir painel →"
            tone="neutral"
          />
        </section>

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Adicionar novo setor
          </h2>

          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Cadastre setores usados como origem ou destino dos transportes. O QR
            Code será gerado automaticamente.
          </p>

          <form
            action={createSectorAction}
            className="mt-5 grid gap-4 md:grid-cols-3"
          >
            <div>
              <label className="text-sm font-black text-slate-700">
                Nome do setor
              </label>

              <input
                name="name"
                placeholder="Ex: Raio-X"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">
                Andar / localização
              </label>

              <input
                name="floor"
                placeholder="Ex: Térreo"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
              />
            </div>

            <div className="flex items-end">
              <button className="w-full rounded-xl bg-[#009da8] px-4 py-3 text-sm font-black text-white transition hover:brightness-95">
                Cadastrar setor
              </button>
            </div>
          </form>
        </section>

        {sectorsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-sm">
            Erro ao carregar setores: {sectorsError.message}
          </div>
        ) : null}

        <section className="rounded-[1.5rem] border border-[#009da8]/20 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#009da8]">
                Estrutura hospitalar
              </p>

              <h2 className="mt-2 text-lg font-black text-slate-950">
                Editar setores cadastrados
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Altere nome, localização, QR Code e status do setor.
              </p>
            </div>

            <Link
              href="/settings/sector-qrcodes"
              className="w-fit rounded-xl bg-[#f2b709] px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-95"
            >
              Ver QR Codes
            </Link>
          </div>

          {sectors.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#009da8]/30 bg-[#009da8]/5 p-5 text-sm font-semibold text-slate-500">
              Nenhum setor encontrado.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {sectors.map((sector) => (
                <div
                  key={sector.id}
                  className={
                    sector.active
                      ? "rounded-[1.35rem] border border-[#009da8]/20 bg-slate-50 p-5 shadow-sm"
                      : "rounded-[1.35rem] border border-slate-200 bg-slate-100 p-5 opacity-85 shadow-sm"
                  }
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">
                        {sector.name}
                      </h3>

                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {sector.floor ?? "Sem localização informada"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SectorActiveBadge active={sector.active} />
                      <QRStatusBadge qrCode={sector.qr_code} />
                    </div>
                  </div>

                  <form action={updateSectorAction} className="mt-5 space-y-4">
                    <input type="hidden" name="sector_id" value={sector.id} />

                    <div>
                      <label className="text-sm font-black text-slate-700">
                        Nome do setor
                      </label>

                      <input
                        name="name"
                        defaultValue={sector.name}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-black text-slate-700">
                        Andar / localização
                      </label>

                      <input
                        name="floor"
                        defaultValue={sector.floor ?? ""}
                        placeholder="Ex: Térreo"
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/15"
                      />
                    </div>

                    <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">
                      Salvar alterações
                    </button>
                  </form>

                  <div className="mt-4 rounded-2xl border border-[#009da8]/15 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[#009da8]">
                      QR Code atual
                    </p>

                    <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs font-semibold text-slate-700">
                      {sector.qr_code ?? "Sem QR Code cadastrado"}
                    </p>

                    <form
                      action={regenerateSectorQRCodeAction}
                      className="mt-3"
                    >
                      <input type="hidden" name="sector_id" value={sector.id} />

                      <button className="w-full rounded-xl border border-[#009da8] bg-white px-4 py-3 text-sm font-black text-[#009da8] transition hover:bg-[#009da8]/10">
                        Gerar novo QR Code
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Status do setor
                    </p>

                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      {sector.active
                        ? "Este setor aparece para novas solicitações de transporte."
                        : "Este setor não aparece para novas solicitações, mas permanece no histórico."}
                    </p>

                    <form action={toggleSectorActiveAction} className="mt-3">
                      <input type="hidden" name="sector_id" value={sector.id} />

                      <input
                        type="hidden"
                        name="next_active"
                        value={sector.active ? "false" : "true"}
                      />

                      <button
                        className={
                          sector.active
                            ? "w-full rounded-xl border border-red-600 bg-white px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-50"
                            : "w-full rounded-xl border border-emerald-600 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                        }
                      >
                        {sector.active ? "Inativar setor" : "Reativar setor"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}