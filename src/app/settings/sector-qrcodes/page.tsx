import Link from "next/link";
import DashboardShell from "@/components/dashboard-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { SectorQRCodesClient } from "@/components/settings/sector-qrcodes-client";
import { generateMissingSectorQRCodesAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SectorQRCodesPageProps = {
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
};

export default async function SectorQRCodesPage({
  searchParams
}: SectorQRCodesPageProps) {
  const params = await searchParams;

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: sectorsData, error } = await supabase
    .from("sectors")
    .select("id, name, floor, qr_code")
    .eq("hospital_id", profile.hospital_id)
    .order("name", { ascending: true });

  const sectors = (sectorsData ?? []) as Sector[];
  const missingCount = sectors.filter(
    (sector) => !sector.qr_code || sector.qr_code.trim() === ""
  ).length;

  return (
    <DashboardShell
      title="QR Codes dos setores"
      description="Gere e imprima os QR Codes usados na validação de origem e destino."
      userName={profile.name}
      userRole={profile.role}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
          <Link
            href="/settings"
            className="w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Voltar para configurações
          </Link>

          <form action={generateMissingSectorQRCodesAction}>
            <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">
              Gerar QR Codes faltantes ({missingCount})
            </button>
          </form>
        </div>

        {params?.success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 print:hidden">
            {params.success}
          </div>
        ) : null}

        {params?.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 print:hidden">
            {params.error}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 print:hidden">
            Erro ao carregar setores: {error.message}
          </div>
        ) : null}

        <SectorQRCodesClient sectors={sectors} />
      </div>
    </DashboardShell>
  );
}