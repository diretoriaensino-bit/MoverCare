import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createTransportRequest } from "./actions";
import { NewTransportRequestWizard } from "@/components/nurse/new-transport-request-wizard";

type NewRequestPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type Sector = {
  id: string;
  name: string;
  floor: string | null;
  qr_code: string | null;
  active: boolean;
};

export default async function NewRequestPage({
  searchParams
}: NewRequestPageProps) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: sectorsData, error: sectorsError } = await supabase
    .from("sectors")
    .select("id, name, floor, qr_code, active")
    .eq("hospital_id", profile.hospital_id)
    .eq("active", true)
    .order("name", { ascending: true });

  const sectors = (sectorsData ?? []) as Sector[];

  return (
    <DashboardShell
      title="Nova Requisição"
      description="Solicite um transporte intra-hospitalar de paciente."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Criar chamado de transporte
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Fluxo guiado para solicitar transporte com segurança, equipe
              adequada e equipamentos obrigatórios.
            </p>
          </div>

          <Link
            href="/nurse"
            className="w-fit rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </Link>
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        ) : null}

        {params.success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {params.success}
          </div>
        ) : null}

        {sectorsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            Erro ao carregar setores: {sectorsError.message}
          </div>
        ) : null}

        {!sectors || sectors.length < 2 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">
              Cadastre pelo menos dois setores
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Para criar uma requisição, o sistema precisa de um setor de origem
              e um setor de destino ativos.
            </p>
          </div>
        ) : (
          <NewTransportRequestWizard
            sectors={sectors}
            action={createTransportRequest}
            initialOpen={Boolean(params.error)}
          />
        )}
      </div>
    </DashboardShell>
  );
}