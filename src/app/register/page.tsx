import Link from "next/link";
import { requestAccessAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RegisterPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
        <section className="bg-blue-700 p-8 text-white md:p-12">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-100">
                MoverCare
              </p>

              <h1 className="mt-6 text-4xl font-black leading-tight">
                Solicite acesso ao sistema de transporte intra-hospitalar.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                Preencha seus dados para solicitar acesso. Sua conta ficará
                pendente até a aprovação de um gestor ou administrador do
                hospital.
              </p>
            </div>

            <div className="mt-10 rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-bold text-white">
                Segurança do processo
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-100">
                O cadastro não libera acesso automaticamente. A entrada no
                sistema só acontece depois da validação interna do hospital.
              </p>
            </div>
          </div>
        </section>

        <section className="p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-950">
              Solicitar acesso
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Informe seus dados e o código de convite fornecido pelo hospital.
            </p>
          </div>

          {params?.success ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {params.success}
            </div>
          ) : null}

          {params?.error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {params.error}
            </div>
          ) : null}

          <form action={requestAccessAction} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Nome completo
              </label>

              <input
                name="full_name"
                placeholder="Ex: Maria Oliveira"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                E-mail
              </label>

              <input
                name="email"
                type="email"
                placeholder="seuemail@hospital.com"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Senha
              </label>

              <input
                name="password"
                type="password"
                placeholder="Mínimo de 6 caracteres"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Função solicitada
              </label>

              <select
                name="requested_role"
                defaultValue=""
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              >
                <option value="" disabled>
                  Selecione uma função
                </option>
                <option value="nurse">Enfermeiro</option>
                <option value="stretcher_bearer">Maqueiro</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Código de convite do hospital
              </label>

              <input
                name="access_code"
                placeholder="Ex: MC-8A7B2C1D"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-600"
              />

              <p className="mt-2 text-xs text-slate-500">
                Esse código é fornecido pelo gestor do hospital.
              </p>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Mensagem opcional
              </label>

              <textarea
                name="request_message"
                rows={4}
                placeholder="Ex: Trabalho no setor de internação, turno da manhã."
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              />
            </div>

            <button className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-800">
              Enviar solicitação
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-bold text-blue-700 hover:text-blue-900"
            >
              Já tenho acesso ao MoverCare
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}