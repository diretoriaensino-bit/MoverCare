import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { updateHospitalSlaSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlaSettingsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

type SlaSettings = {
  sla_accept_limit_minutes: number;
  sla_start_limit_minutes: number;
  sla_transport_limit_minutes: number;
};

function getNumberValue(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return fallback;
  }

  return numberValue;
}

function SettingCard({
  title,
  value,
  description
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <p className="mt-2 text-3xl font-bold text-slate-950">
        {value} min
      </p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default async function SlaSettingsPage({
  searchParams
}: SlaSettingsPageProps) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_hospital_sla_settings_admin"
  );

  const settings = (data ?? {}) as Partial<SlaSettings>;

  const acceptLimit = getNumberValue(
    settings.sla_accept_limit_minutes,
    10
  );

  const startLimit = getNumberValue(
    settings.sla_start_limit_minutes,
    15
  );

  const transportLimit = getNumberValue(
    settings.sla_transport_limit_minutes,
    60
  );

  return (
    <DashboardShell
      title="Configurações de SLA"
      description="Defina os limites de tempo usados nos alertas de atraso."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Configurações de SLA do hospital
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Estes limites serão usados para identificar chamados pendentes,
              aceitos ou em transporte fora do tempo esperado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/sla-alerts"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Ver alertas de SLA
            </Link>

            <Link
              href="/settings"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
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

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Erro ao carregar configurações de SLA: {error.message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <SettingCard
            title="Limite para aceite"
            value={acceptLimit}
            description="Chamado pendente aguardando maqueiro."
          />

          <SettingCard
            title="Limite para iniciar"
            value={startLimit}
            description="Chamado aceito, mas ainda não iniciado."
          />

          <SettingCard
            title="Limite em transporte"
            value={transportLimit}
            description="Transporte iniciado, mas ainda não concluído."
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Alterar limites de SLA
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Informe os tempos em minutos. Use valores compatíveis com a rotina
            operacional do hospital.
          </p>

          <form
            action={updateHospitalSlaSettingsAction}
            className="mt-6 grid gap-5 md:grid-cols-3"
          >
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Tempo máximo para aceite
              </label>

              <input
                name="accept_limit"
                type="number"
                min="1"
                defaultValue={acceptLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                Exemplo: se colocar 10, chamados pendentes acima de 10 minutos
                geram alerta.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Tempo máximo para iniciar
              </label>

              <input
                name="start_limit"
                type="number"
                min="1"
                defaultValue={startLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                Usado quando o maqueiro aceitou o chamado, mas ainda não iniciou
                o transporte.
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Tempo máximo em transporte
              </label>

              <input
                name="transport_limit"
                type="number"
                min="1"
                defaultValue={transportLimit}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                Usado quando o transporte foi iniciado, mas ainda não foi
                concluído.
              </p>
            </div>

            <div className="md:col-span-3">
              <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700">
                Salvar configurações de SLA
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-blue-950">
            Como esses limites são usados?
          </h2>

          <div className="mt-3 space-y-2 text-sm text-blue-800">
            <p>
              <strong>Pendente:</strong> compara o horário de solicitação com o
              limite para aceite.
            </p>

            <p>
              <strong>Aceito:</strong> compara o horário de aceite com o limite
              para iniciar.
            </p>

            <p>
              <strong>Em transporte:</strong> compara o horário de início com o
              limite máximo em transporte.
            </p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}