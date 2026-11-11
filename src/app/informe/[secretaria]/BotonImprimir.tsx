"use client";

/** Barra superior del informe (no sale en el PDF): guardar como PDF y volver a la Agencia. */
export default function BotonImprimir() {
  return (
    <div className="no-imprimir mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FFF4ED] px-4 py-3">
      <p className="text-[13px] text-[#9A3412]">Para descargarlo, elige «Guardar como PDF» en la ventana de impresión.</p>
      <div className="flex gap-2">
        <a href="/alpujarra" className="rounded-xl border border-[#FDC9A9] bg-white px-3.5 py-2 text-[13px] font-bold text-[#9A3412]">
          ← Volver a la Agencia
        </a>
        <button onClick={() => window.print()} className="rounded-xl bg-[#C2410C] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#9A3412]">
          ↓ Guardar como PDF
        </button>
      </div>
    </div>
  );
}
