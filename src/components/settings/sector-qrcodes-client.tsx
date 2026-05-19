"use client";

import { QRCodeSVG } from "qrcode.react";

type Sector = {
  id: string;
  name: string;
  floor: string | null;
  qr_code: string | null;
};

type SectorQRCodesClientProps = {
  sectors: Sector[];
};

export function SectorQRCodesClient({ sectors }: SectorQRCodesClientProps) {
  function printPage() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            QR Codes dos setores
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Imprima e fixe cada QR Code no setor correspondente.
          </p>
        </div>

        <button
          onClick={printPage}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Imprimir QR Codes
        </button>
      </div>

      {sectors.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Nenhum setor encontrado
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cadastre setores antes de gerar os QR Codes.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
          {sectors.map((sector) => (
            <section
              key={sector.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm print:break-inside-avoid print:shadow-none"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                MoverCare
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {sector.name}
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {sector.floor ?? "Sem andar informado"}
              </p>

              <div className="mt-6 flex justify-center">
                {sector.qr_code ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <QRCodeSVG
                      value={sector.qr_code}
                      size={190}
                      level="H"
                      includeMargin
                    />
                  </div>
                ) : (
                  <div className="flex h-[222px] w-[222px] items-center justify-center rounded-2xl border border-dashed border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">
                    Setor sem QR Code cadastrado
                  </div>
                )}
              </div>

              <p className="mt-5 text-xs font-semibold text-slate-500">
                Código: {sector.qr_code ?? "Não cadastrado"}
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-600">
                Fixar este QR Code na entrada ou ponto de validação do setor.
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}