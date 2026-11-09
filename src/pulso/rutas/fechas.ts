const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "9 nov 2026, 10:20 a. m." en hora de Colombia (UTC−5); una fecha solo-día ("2020-09-01") sale sin hora. */
export function fechaCorta(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [a, m, d] = iso.split("-").map(Number);
    return `${d} ${MESES[(m ?? 1) - 1]} ${a}`;
  }
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const b = new Date(t - 5 * 3600_000);
  const h = b.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${b.getUTCDate()} ${MESES[b.getUTCMonth()]} ${b.getUTCFullYear()}, ${h12}:${String(b.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}
