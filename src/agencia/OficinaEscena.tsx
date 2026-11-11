"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { CSS_ESCENA, VB, encuadre, escenaSvg, type DatosEscena, type IdSala } from "./escena";
import type { AspectoAgente, IdEditable } from "./persona";

const VB_TXT = VB.join(" ");
const r1 = (n: number) => Math.round(n * 10) / 10;
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Oficina isométrica de la Agencia. Cada despacho es un botón (clic, Enter o espacio); la Salida lleva a la Ciudad.
 * `foco` encuadra una sala con un zoom de 620 ms (directo con movimiento reducido).
 */
export default function OficinaEscena({
  oscuro,
  foco,
  aspectos,
  datos,
  onAbrir,
}: {
  oscuro: boolean;
  foco: IdSala | "todo";
  aspectos: Record<IdEditable, AspectoAgente>;
  datos: DatosEscena;
  onAbrir(id: IdSala): void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const vbRef = useRef<number[]>([...VB]);
  const raf = useRef(0);
  const primera = useRef(true);
  const montado = useRef(0);
  const [quieto, setQuieto] = useState(false);
  const [vbFinal, setVbFinal] = useState(VB_TXT);

  useEffect(() => {
    montado.current = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia del sistema leída al montar
    setQuieto(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const html = useMemo(() => escenaSvg(oscuro, quieto, aspectos, datos), [oscuro, quieto, aspectos, datos]);

  // resalta la sala enfocada (también después de redibujar la escena)
  useEffect(() => {
    svgRef.current?.querySelectorAll<SVGGElement>(".sala").forEach((g) => g.toggleAttribute("data-hot", g.dataset.id === foco));
  }, [foco, html]);

  // zoom del recorrido
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const destino = encuadre(foco);
    cancelAnimationFrame(raf.current);
    const poner = (v: number[]) => svg.setAttribute("viewBox", v.map(r1).join(" "));
    const final = destino.map(r1).join(" ");
    // al abrir (incluido el encuadre inicial del celular), con movimiento reducido o en una pestaña oculta: salto directo
    const alAbrir = performance.now() - montado.current < 600;
    if (primera.current || quieto || alAbrir || document.visibilityState !== "visible") {
      primera.current = false;
      vbRef.current = [...destino];
      poner(destino);
      setVbFinal(final);
      return;
    }
    const desde = [...vbRef.current];
    const t0 = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - t0) / 620);
      const e = suave(t);
      vbRef.current = desde.map((v, i) => v + (destino[i] - v) * e);
      poner(vbRef.current);
      if (t < 1) raf.current = requestAnimationFrame(paso);
      else setVbFinal(final);
    };
    raf.current = requestAnimationFrame(paso);
    // respaldo: si el navegador no pinta cuadros (vista oculta), el encuadre llega igual
    const respaldo = window.setTimeout(() => {
      cancelAnimationFrame(raf.current);
      vbRef.current = [...destino];
      poner(destino);
      setVbFinal(final);
    }, 700);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(respaldo);
    };
  }, [foco, quieto]);

  const salaDe = (t: EventTarget | null) => (t instanceof Element ? (t.closest(".sala[role=button]") as SVGGElement | null)?.dataset.id : undefined) as IdSala | undefined;
  const clic = (e: MouseEvent) => {
    const id = salaDe(e.target);
    if (id) onAbrir(id);
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = salaDe(e.target);
    if (!id) return;
    e.preventDefault();
    onAbrir(id);
  };

  return (
    <div className="ofi">
      <style>{CSS_ESCENA}</style>
      {/* los botones son las salas (role=button dentro del SVG); el SVG solo delega el clic y el teclado */}
      <svg
        ref={svgRef}
        viewBox={vbFinal}
        role="group"
        aria-label="Oficina isométrica de la Agencia de datos. Cada despacho es un botón."
        onClick={clic}
        onKeyDown={tecla}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
