/** Estado "Datos en preparación" para pestañas que otra rama llenará. Sin promesas de fecha. */
export default function EnPreparacion({ titulo, detalle, bloques }: { titulo: string; detalle: string; bloques: string[] }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full border border-[#E3EAF3] bg-[#F4F7FB] px-2.5 py-1 text-xs font-bold text-[#475569]">
          Datos en preparación
        </span>
        <h3 className="m-0 text-lg font-bold leading-snug text-[#1E3A5F]">{titulo}</h3>
        <p className="m-0 max-w-[60ch] text-[13.5px] leading-relaxed text-[#475569]">{detalle}</p>
      </div>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        {bloques.map((b) => (
          <div
            key={b}
            className="flex h-[96px] items-end rounded-[14px] border-[1.5px] border-dashed border-[#C9D6E8] p-3 font-mono text-[11.5px] text-[#475569]"
            style={{ background: "repeating-linear-gradient(135deg,#FFFFFF 0 10px,#F7F9FC 10px 20px)" }}
          >
            {b}
          </div>
        ))}
      </div>
    </div>
  );
}
