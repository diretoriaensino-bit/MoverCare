import Link from "next/link";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

function isPendingApprovalMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("aguardando aprovação") ||
    normalizedMessage.includes("ainda não está liberado") ||
    normalizedMessage.includes("cadastro foi recebido")
  );
}

function isRejectedMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("recusada") ||
    normalizedMessage.includes("recusado")
  );
}

function LoginFeedbackCard({ message }: { message: string }) {
  const isPending = isPendingApprovalMessage(message);
  const isRejected = isRejectedMessage(message);

  if (isPending) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-40" />
            <span className="relative text-xl">⏳</span>
          </div>

          <div>
            <h2 className="text-base font-black text-amber-900">
              Acesso aguardando aprovação
            </h2>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              {message}
            </p>

            <p className="mt-3 text-xs leading-5 text-amber-700">
              Assim que o gestor aprovar sua solicitação, você poderá entrar
              normalmente com este e-mail e senha.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-xl">
            ✕
          </div>

          <div>
            <h2 className="text-base font-black text-red-900">
              Solicitação recusada
            </h2>

            <p className="mt-1 text-sm leading-6 text-red-800">
              {message}
            </p>

            <p className="mt-3 text-xs leading-5 text-red-700">
              Em caso de dúvida, procure o gestor responsável pelo MoverCare no
              hospital.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
      {message}
    </div>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
        <section className="bg-blue-700 p-8 text-white md:p-12">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-100">
                MoverCare
              </p>

              <h1 className="mt-6 text-4xl font-black leading-tight">
                Transporte intra-hospitalar com segurança, rastreabilidade e
                eficiência.
              </h1>

              <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                Acesse o painel conforme seu perfil: enfermagem, maqueiro,
                gestor ou administrador.
              </p>
            </div>

            <div className="mt-10 rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-bold text-white">
                Acesso protegido
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-100">
                Usuários novos só entram após aprovação do gestor ou
                administrador do hospital.
              </p>
            </div>
          </div>
        </section>

        <section className="p-8 md:p-12">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Entrar no MoverCare
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Informe seu e-mail e senha para acessar o sistema.
            </p>
          </div>

          {params?.success ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {params.success}
            </div>
          ) : null}

          {params?.error ? (
            <LoginFeedbackCard message={params.error} />
          ) : null}

          <form action={loginAction} className="mt-6 space-y-4">
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
                placeholder="Digite sua senha"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600"
              />
            </div>

            <button className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-800">
              Entrar
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Ainda não tem acesso ao MoverCare?
            </p>

            <Link
              href="/register"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-blue-600 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              Solicitar acesso ao MoverCare
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}