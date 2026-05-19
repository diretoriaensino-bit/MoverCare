import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/theme-toggle";

type DashboardShellProps = {
  title: string;
  description: string;
  userName: string;
  userRole: string;
  children: ReactNode;
};

type SlaAlert = {
  transport_id: string;
  alert_level: string;
};

type MenuItem = {
  label: string;
  href: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: "Operação",
    items: [
      {
        label: "Dashboard",
        href: "/manager"
      },
      {
        label: "Nova Requisição",
        href: "/nurse/new-request"
      },
      {
        label: "Painel Enfermeiro",
        href: "/nurse"
      },
      {
        label: "Chamados",
        href: "/transports"
      },
      {
        label: "Painel Maqueiro",
        href: "/stretcher-bearer"
      }
    ]
  },
  {
    title: "Indicadores",
    items: [
      {
        label: "Relatórios",
        href: "/reports"
      },
      {
        label: "Relatórios Mensais",
        href: "/reports/monthly"
      },
      {
        label: "Indicadores por Setor",
        href: "/reports/sector-time-indicators"
      },
      {
        label: "Desempenho dos Maqueiros",
        href: "/reports/stretcher-performance"
      },
      {
        label: "Alertas de SLA",
        href: "/reports/sla-alerts"
      },
      {
        label: "Auditoria dos Transportes",
        href: "/reports/transport-audit"
      }
    ]
  },
  {
    title: "Administração",
    items: [
      {
        label: "Configurações",
        href: "/settings"
      },
      {
        label: "Configurações de SLA",
        href: "/settings/sla"
      },
      {
        label: "Gerenciar Usuários",
        href: "/settings/users"
      },
      {
        label: "QR Codes dos Setores",
        href: "/settings/sector-qrcodes"
      },
      {
        label: "Auditoria Administrativa",
        href: "/settings/audit"
      }
    ]
  }
];

function getRoleLabel(role: string) {
  switch (role) {
    case "nurse":
      return "Enfermeiro";

    case "stretcher_bearer":
      return "Maqueiro";

    case "manager":
      return "Gestor";

    case "admin":
      return "Administrador";

    default:
      return "Usuário";
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) {
    return "MC";
  }

  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return `${first}${last}`.toUpperCase();
}

async function getSlaAlertCount(userRole: string) {
  if (userRole !== "manager" && userRole !== "admin") {
    return {
      total: 0,
      critical: 0
    };
  }

  try {
    const supabase = await createClient();

    const { data: settingsData } = await supabase.rpc(
      "get_hospital_sla_settings_admin"
    );

    const settings = settingsData as
      | {
          sla_accept_limit_minutes?: number;
          sla_start_limit_minutes?: number;
          sla_transport_limit_minutes?: number;
        }
      | null;

    const acceptLimit = Number(settings?.sla_accept_limit_minutes ?? 10);
    const startLimit = Number(settings?.sla_start_limit_minutes ?? 15);
    const transportLimit = Number(settings?.sla_transport_limit_minutes ?? 60);

    const { data, error } = await supabase.rpc(
      "get_transport_sla_alerts_admin",
      {
        p_accept_limit_minutes: acceptLimit,
        p_start_limit_minutes: startLimit,
        p_transport_limit_minutes: transportLimit
      }
    );

    if (error) {
      return {
        total: 0,
        critical: 0
      };
    }

    const alerts = (data ?? []) as SlaAlert[];

    return {
      total: alerts.length,
      critical: alerts.filter((alert) => alert.alert_level === "critical")
        .length
    };
  } catch {
    return {
      total: 0,
      critical: 0
    };
  }
}

function MenuLink({
  item,
  showSlaBadge,
  slaTotal,
  hasCritical
}: {
  item: MenuItem;
  showSlaBadge: boolean;
  slaTotal: number;
  hasCritical: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-[#f2b709]/40 hover:bg-white/10 hover:text-white"
    >
      <span className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#009da8] transition group-hover:bg-[#f2b709]" />
        {item.label}
      </span>

      {showSlaBadge ? (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-black text-white ${
            hasCritical ? "bg-red-600" : "bg-[#f2b709]"
          }`}
        >
          {slaTotal}
        </span>
      ) : null}
    </Link>
  );
}

async function DashboardShell({
  title,
  description,
  userName,
  userRole,
  children
}: DashboardShellProps) {
  const slaAlerts = await getSlaAlertCount(userRole);
  const roleLabel = getRoleLabel(userRole);

  return (
    <main className="min-h-screen bg-[#f3f8f8]">
      <div className="flex min-h-screen">
        <aside className="hidden w-80 border-r border-[#009da8]/20 bg-slate-950 text-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-5 py-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20">
              <div className="rounded-3xl bg-black p-4">
                <Image
                  src="/images/logo-husf.png"
                  alt="Hospital Universitário Sagrada Família"
                  width={260}
                  height={120}
                  className="h-auto w-full object-contain"
                  priority
                />
              </div>

              <div className="mt-4 rounded-2xl bg-[#009da8]/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f2b709]">
                  MoverCare
                </p>

                <h1 className="mt-2 text-2xl font-black text-white">
                  Painel Web
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Transporte intra-hospitalar com segurança, rastreabilidade e
                  apoio à decisão.
                </p>
              </div>
            </div>

            <nav className="mt-6 space-y-6 pb-6">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 px-3 text-xs font-black uppercase tracking-[0.2em] text-[#f2b709]">
                    {section.title}
                  </p>

                  <div className="space-y-2">
                    {section.items.map((item) => {
                      const shouldShowSlaBadge =
                        item.href === "/reports/sla-alerts" &&
                        slaAlerts.total > 0;

                      return (
                        <MenuLink
                          key={item.href}
                          item={item}
                          showSlaBadge={shouldShowSlaBadge}
                          slaTotal={slaAlerts.total}
                          hasCritical={slaAlerts.critical > 0}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-auto rounded-3xl border border-[#009da8]/30 bg-[#009da8]/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f2b709]">
                Usuário conectado
              </p>

              <p className="mt-2 text-sm font-bold text-white">{userName}</p>

              <p className="mt-1 text-xs font-semibold text-slate-300">
                {roleLabel}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <header className="border-b border-[#009da8]/15 bg-white/90 px-5 py-5 shadow-sm backdrop-blur md:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#009da8]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#009da8]">
                    {roleLabel}
                  </span>

                  <span className="rounded-full bg-[#f2b709]/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-800">
                    Hospital Universitário Sagrada Família
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                  {title}
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ThemeToggle />

                {slaAlerts.total > 0 ? (
                  <Link
                    href="/reports/sla-alerts"
                    className={`rounded-2xl px-4 py-3 text-sm font-black text-white shadow-sm transition ${
                      slaAlerts.critical > 0
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-[#f2b709] hover:brightness-95"
                    }`}
                  >
                    {slaAlerts.total} alerta(s) de SLA
                  </Link>
                ) : null}

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#009da8] text-sm font-black text-white">
                    {getInitials(userName)}
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {userName}
                    </p>

                    <p className="text-xs font-semibold text-slate-500">
                      {roleLabel}
                    </p>
                  </div>
                </div>

                <Link
                  href="/logout"
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
                >
                  Sair
                </Link>
              </div>
            </div>
          </header>

          <div className="flex-1 px-5 py-6 md:px-8">
            <div className="mx-auto max-w-[1500px]">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export { DashboardShell };
export default DashboardShell;