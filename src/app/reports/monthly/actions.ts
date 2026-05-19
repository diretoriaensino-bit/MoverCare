"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function redirectWithMessage(type: "success" | "error", message: string) {
  redirect(`/reports/monthly?${type}=${encodeURIComponent(message)}`);
}

export async function generateMonthlyReportAction(formData: FormData) {
  const profile = await getCurrentProfile();

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirectWithMessage(
      "error",
      "Apenas gestor ou administrador pode gerar relatório mensal."
    );
  }

  const reportYear = Number(formData.get("report_year"));
  const reportMonth = Number(formData.get("report_month"));

  if (!reportYear || reportYear < 2020 || reportYear > 2100) {
    redirectWithMessage("error", "Ano inválido.");
  }

  if (!reportMonth || reportMonth < 1 || reportMonth > 12) {
    redirectWithMessage("error", "Mês inválido.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("generate_monthly_report", {
    p_hospital_id: profile.hospital_id,
    p_report_year: reportYear,
    p_report_month: reportMonth
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/reports/monthly");

  redirectWithMessage("success", "Relatório mensal gerado com sucesso.");
}

export async function cleanupOldRecordsAction(formData: FormData) {
  const profile = await getCurrentProfile();

  if (profile.role !== "manager" && profile.role !== "admin") {
    redirectWithMessage(
      "error",
      "Apenas gestor ou administrador pode limpar registros antigos."
    );
  }

  const beforeDate = String(formData.get("before_date") || "");
  const confirmation = String(formData.get("confirmation") || "");

  if (!beforeDate) {
    redirectWithMessage("error", "Informe uma data limite para limpeza.");
  }

  if (confirmation !== "CONFIRMAR") {
    redirectWithMessage(
      "error",
      "Digite CONFIRMAR para executar a limpeza segura."
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cleanup_old_transport_records", {
    p_hospital_id: profile.hospital_id,
    p_before_date: beforeDate
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath("/reports/monthly");

  const deletedTransports = data?.deleted_transports ?? 0;
  const deletedLogs = data?.deleted_logs ?? 0;

  redirectWithMessage(
    "success",
    `Limpeza concluída. Transportes apagados: ${deletedTransports}. Logs apagados: ${deletedLogs}.`
  );
}