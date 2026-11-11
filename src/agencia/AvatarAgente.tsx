import { useId } from "react";
import { botSvg, personaSvg, type AspectoAgente, type IdEditable } from "./persona";

/**
 * Retrato del agente: el mismo dibujo de la oficina, recortado en círculo (fichas) o de cuerpo entero (editor).
 * PulsoBot (analista) es el orbe azul.
 */
export default function AvatarAgente({
  id,
  aspectos,
  fondo = "#EDF4FF",
  entero = false,
  className = "",
}: {
  id: IdEditable | "analista";
  aspectos: Record<IdEditable, AspectoAgente>;
  fondo?: string;
  entero?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const grad = `bot-${uid}`;
  const clip = `clip-${uid}`;
  const fig =
    id === "analista"
      ? `<g transform="translate(0,${entero ? -26 : -40}) scale(${entero ? 1.4 : 0.9})">${botSvg(grad)}</g>`
      : `<g>${personaSvg(aspectos[id])}</g>`;
  const bg = entero
    ? `<rect x="-24" y="-60" width="48" height="64" rx="6" fill="${fondo}"/><ellipse cx="0" cy="0" rx="16" ry="3" fill="rgba(15,23,42,.06)"/>`
    : `<circle cx="0" cy="-40" r="15" fill="${fondo}"/>`;
  const html = `<defs><clipPath id="${clip}"><circle cx="0" cy="-40" r="15"/></clipPath><radialGradient id="${grad}" cx=".35" cy=".3"><stop offset="0" stop-color="#93C5FD"/><stop offset=".6" stop-color="#2563EB"/><stop offset="1" stop-color="#1E3A8A"/></radialGradient></defs>${bg}<g ${entero ? "" : `clip-path="url(#${clip})"`}>${fig}</g>`;
  return (
    <svg
      viewBox={entero ? "-24 -60 48 64" : "-15 -55 30 30"}
      preserveAspectRatio="xMidYMid meet"
      className={`block h-full w-full ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
