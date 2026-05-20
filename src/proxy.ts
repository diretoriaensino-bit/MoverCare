import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};

//so para testar o proxy, nao precisa disso, mas se quiser usar o proxy para outras coisas, pode usar esse middleware para atualizar a sessão do supabase em todas as rotas, exceto as que estao na lista de excecoes acima.