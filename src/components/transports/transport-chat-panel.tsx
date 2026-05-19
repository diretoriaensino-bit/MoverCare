"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const HUSF_PRIMARY = "#009da8";
const HUSF_GOLD = "#f2b709";

type SenderProfile = {
  id: string;
  name: string;
  role: string;
};

type TransportMessage = {
  id: string;
  hospital_id: string;
  transport_id: string;
  sender_profile_id: string;
  message: string;
  created_at: string;
  deleted_at: string | null;
  sender: SenderProfile | SenderProfile[] | null;
};

type TransportChatPanelProps = {
  transportId: string;
  hospitalId: string;
  currentProfileId: string;
};

function getFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "stretcher_bearer":
      return "Maqueiro";
    case "nurse":
      return "Enfermeiro";
    case "manager":
      return "Gestor";
    case "admin":
      return "Administrador";
    default:
      return "Profissional";
  }
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function TransportChatPanel({
  transportId,
  hospitalId,
  currentProfileId
}: TransportChatPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<TransportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState("");
  const [pushStatus, setPushStatus] = useState("");

  const trimmedMessage = newMessage.trim();

  const loadMessages = useCallback(async () => {
    if (!transportId || !hospitalId) {
      return;
    }

    setError("");
    setLoadingMessages(true);

    const { data, error: messagesError } = await supabase
      .from("transport_messages")
      .select(
        `
        id,
        hospital_id,
        transport_id,
        sender_profile_id,
        message,
        created_at,
        deleted_at,
        sender:sender_profile_id(id, name, role)
      `
      )
      .eq("hospital_id", hospitalId)
      .eq("transport_id", transportId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) {
      setError(`Erro ao carregar mensagens: ${messagesError.message}`);
      setMessages([]);
    } else {
      setMessages((data ?? []) as TransportMessage[]);
    }

    setLoadingMessages(false);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [hospitalId, supabase, transportId]);

  async function sendMessage() {
    setPushStatus("Botão clicado. Preparando envio...");

    if (!trimmedMessage || sendingMessage) {
      setPushStatus("Mensagem vazia ou envio já em andamento.");
      return;
    }

    if (trimmedMessage.length > 1000) {
      setError("A mensagem deve ter no máximo 1000 caracteres.");
      setPushStatus("");
      return;
    }

    setError("");
    setSendingMessage(true);

    try {
      setPushStatus("Salvando mensagem no chat...");

      const { error: insertError } = await supabase
        .from("transport_messages")
        .insert({
          hospital_id: hospitalId,
          transport_id: transportId,
          sender_profile_id: currentProfileId,
          message: trimmedMessage
        });

      if (insertError) {
        setError(`Erro ao enviar mensagem: ${insertError.message}`);
        setPushStatus("Erro ao salvar mensagem no chat.");
        return;
      }

      setPushStatus("Mensagem salva. Chamando notificação push...");

      const { data: pushData, error: pushError } =
        await supabase.functions.invoke("send-transport-message-push", {
          body: {
            transportId,
            hospitalId,
            senderProfileId: currentProfileId,
            message: trimmedMessage
          }
        });

      if (pushError) {
        setError(`Mensagem enviada, mas o push falhou: ${pushError.message}`);
        setPushStatus(`Push falhou: ${pushError.message}`);
      } else {
        setPushStatus(`Push chamado com sucesso: ${JSON.stringify(pushData)}`);
      }

      setNewMessage("");
      await loadMessages();
    } finally {
      setSendingMessage(false);
    }
  }
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!transportId) {
      return;
    }

    const channelName = `web-transport-chat-${transportId}-${Date.now()}`;

    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transport_messages",
        filter: `transport_id=eq.${transportId}`
      },
      () => {
        loadMessages();
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadMessages, supabase, transportId]);

  return (
    <section className="rounded-[2rem] border border-[#009da8]/15 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#009da8]">
            ComunicaÃ§Ã£o do chamado
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Chat do chamado
          </h2>

          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            Use este espaÃ§o para alinhar atrasos, preparo do paciente,
            indisponibilidade do setor, orientaÃ§Ãµes e intercorrÃªncias durante o
            transporte.
          </p>
        </div>

        <div className="rounded-2xl bg-[#009da8]/10 px-4 py-3 text-sm font-black text-[#009da8]">
          Tempo real
        </div>
      </div>

      <div className="mt-5 max-h-[420px] min-h-[220px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {loadingMessages ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <p className="text-sm font-bold text-slate-500">
              Carregando mensagens...
            </p>
          </div>
        ) : null}

        {!loadingMessages && messages.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#009da8]/10 text-2xl">
              ðŸ’¬
            </div>

            <p className="mt-3 text-base font-black text-slate-900">
              Nenhuma mensagem ainda
            </p>

            <p className="mt-1 max-w-md text-sm font-medium text-slate-500">
              Quando o enfermeiro ou maqueiro enviar uma mensagem, ela aparecerÃ¡
              aqui.
            </p>
          </div>
        ) : null}

        {messages.length > 0 ? (
          <div className="flex flex-col gap-3">
            {messages.map((item) => {
              const sender = getFirstRelation(item.sender);
              const isMine = item.sender_profile_id === currentProfileId;

              return (
                <div
                  key={item.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[82%]">
                    <div
                      className={`rounded-3xl px-4 py-3 shadow-sm ${
                        isMine
                          ? "rounded-tr-md bg-[#009da8] text-white"
                          : "rounded-tl-md border border-[#009da8]/15 bg-white text-slate-900"
                      }`}
                    >
                      <p className="text-sm font-semibold leading-6">
                        {item.message}
                      </p>
                    </div>

                    <p
                      className={`mt-1 text-xs font-bold text-slate-500 ${
                        isMine ? "text-right" : "text-left"
                      }`}
                    >
                      {isMine
                        ? "VocÃª"
                        : `${sender?.name ?? "Profissional"} Â· ${getRoleLabel(
                            sender?.role
                          )}`}{" "}
                      Â· {formatMessageTime(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <textarea
          value={newMessage}
          onChange={(event) => setNewMessage(event.target.value)}
          placeholder="Digite uma mensagem para a equipe do chamado..."
          maxLength={1000}
          className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#009da8] focus:ring-4 focus:ring-[#009da8]/10"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-400">
            {trimmedMessage.length}/1000 caracteres
          </p>

          <button
            type="button"
            onClick={sendMessage}
            disabled={!trimmedMessage || sendingMessage}
            className="rounded-2xl px-6 py-3 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-70"
            style={{
              backgroundColor:
                !trimmedMessage || sendingMessage ? undefined : HUSF_PRIMARY
            }}
          >
            {sendingMessage ? "Enviando..." : "Enviar mensagem"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#f2b709]/30 bg-[#f2b709]/10 px-4 py-3">
        <p className="text-sm font-bold text-slate-800">
          Dica: registre aqui situaÃ§Ãµes como paciente em preparo, atraso no
          exame, setor ocupado, necessidade de aguardar liberaÃ§Ã£o ou mudanÃ§a de
          orientaÃ§Ã£o.
        </p>
      </div>
    </section>
  );
}
