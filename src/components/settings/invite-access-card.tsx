"use client";

import { useEffect, useState } from "react";

type InviteAccessCardProps = {
  hospitalName: string;
  accessCode: string | null;
  regenerateAction: (formData: FormData) => Promise<void>;
};

export default function InviteAccessCard({
  hospitalName,
  accessCode,
  regenerateAction
}: InviteAccessCardProps) {
  const [registerUrl, setRegisterUrl] = useState("/register");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setRegisterUrl(`${window.location.origin}/register`);
  }, []);

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);

    setTimeout(() => {
      setCopied("");
    }, 2500);
  }

  const inviteMessage = `Olá! Para solicitar acesso ao MoverCare, acesse:

${registerUrl}

Código do hospital:
${accessCode || "Código não encontrado"}

Após preencher o cadastro, seu acesso ficará pendente até aprovação do gestor.`;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
            Convite de acesso
          </p>

          <h2 className="mt-2 text-xl font-black text-blue-950">
            Compartilhe o cadastro com funcionários
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-800">
            Envie o link e o código abaixo para o funcionário solicitar acesso.
            O cadastro não libera entrada automática; o usuário fica pendente
            até aprovação do gestor ou administrador.
          </p>
        </div>

        {copied ? (
          <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700">
            {copied} copiado!
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Hospital
          </p>

          <p className="mt-2 text-sm font-bold text-slate-950">
            {hospitalName}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Código de convite
          </p>

          <p className="mt-2 font-mono text-lg font-black text-blue-700">
            {accessCode || "Código não encontrado"}
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Link de cadastro
          </p>

          <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-700">
            {registerUrl}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            copyText(accessCode || "Código não encontrado", "Código")
          }
          className="rounded-xl border border-blue-600 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
        >
          Copiar código
        </button>

        <button
          type="button"
          onClick={() => copyText(registerUrl, "Link")}
          className="rounded-xl border border-blue-600 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
        >
          Copiar link
        </button>

        <button
          type="button"
          onClick={() => copyText(inviteMessage, "Mensagem")}
          className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
        >
          Copiar mensagem pronta
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-amber-900">
              Segurança do código de convite
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              Gere um novo código se o atual foi compartilhado com pessoas
              erradas. O código antigo deixa de funcionar para novos cadastros.
            </p>
          </div>

          <form action={regenerateAction}>
            <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 lg:w-auto">
              Gerar novo código
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}