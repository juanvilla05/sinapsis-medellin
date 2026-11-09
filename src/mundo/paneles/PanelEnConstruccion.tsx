import type { AreaMundo } from "../areas";

export default function PanelEnConstruccion({ area }: { area: AreaMundo }) {
  return (
    <div className="grid items-center gap-7 px-6 py-7 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex h-[130px] w-[130px] items-center justify-center rounded-[22px] border border-[#E3EAF3] bg-[#EFF6FF] font-mono text-[40px] font-semibold text-[#1E3A5F]">
        {area.num}
      </div>
      <div className="flex flex-col gap-3.5">
        <span className="self-start rounded-full border border-[#E3EAF3] bg-[#F4F7FB] px-2.5 py-1 text-xs font-bold text-[#475569]">
          En construcción
        </span>
        <p className="m-0 text-lg font-semibold leading-snug text-[#1E3A5F]">{area.descripcion}</p>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          {(area.bloques ?? []).map((b, i) => (
            <div
              key={i}
              className="flex h-[110px] items-end rounded-[14px] border-[1.5px] border-dashed border-[#C9D6E8] p-3 font-mono text-[11.5px] text-[#475569]"
              style={{ background: "repeating-linear-gradient(135deg,#FFFFFF 0 10px,#F7F9FC 10px 20px)" }}
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
