/** Formatos de las rutas en español de Colombia (miles con punto, decimales con coma). */
export function duracionLegible(segundos: number) {
  const min = Math.max(1, Math.round(segundos / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")} min`;
}

export function distanciaLegible(metros: number) {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(Math.round(metros / 100) / 10).toFixed(1).replace(".", ",")} km`;
}

export function pm25Legible(v: number | null) {
  return v === null ? "—" : v.toFixed(1).replace(".", ",");
}

export function milesLegible(n: number) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
