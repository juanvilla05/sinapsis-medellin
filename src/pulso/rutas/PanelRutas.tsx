"use client";

/** STUB — lo reemplaza la rama de rutas inteligentes (Google Routes + SIATA + MEData). */
export default function PanelRutas({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Rutas inteligentes</h2>
        <button type="button" onClick={onCerrar} className="rounded-full px-2 py-1 text-sm text-white/70 hover:bg-white/10" aria-label="Cerrar rutas">
          ✕
        </button>
      </div>
      <p className="text-sm text-white/70">En construcción.</p>
    </div>
  );
}
