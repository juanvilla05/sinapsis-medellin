import "server-only";

/**
 * Límite de peticiones por IP (ventana fija en memoria).
 * En Vercel cada instancia tiene su propia memoria: el límite real es N × instancias activas.
 * Suficiente para una aplicación pública académica; para abuso serio va un WAF delante.
 */
interface Cubo {
  cuenta: number;
  reinicia: number;
}

const cubos = new Map<string, Cubo>();
const VENTANA_MS = 60 * 60 * 1000;

export interface ResultadoLimite {
  ok: boolean;
  limite: number;
  restantes: number;
  reinicia: number; // epoch ms
}

export function limitar(clave: string, limite: number, ahora = Date.now()): ResultadoLimite {
  // limpieza perezosa de cubos vencidos
  if (cubos.size > 5000) for (const [k, c] of cubos) if (c.reinicia <= ahora) cubos.delete(k);
  let c = cubos.get(clave);
  if (!c || c.reinicia <= ahora) {
    c = { cuenta: 0, reinicia: ahora + VENTANA_MS };
    cubos.set(clave, c);
  }
  c.cuenta += 1;
  return { ok: c.cuenta <= limite, limite, restantes: Math.max(0, limite - c.cuenta), reinicia: c.reinicia };
}

export function ipCliente(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "desconocida";
}

export function cabecerasLimite(r: ResultadoLimite): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limite),
    "X-RateLimit-Remaining": String(r.restantes),
    "X-RateLimit-Reset": String(Math.ceil(r.reinicia / 1000)),
  };
  if (!r.ok) h["Retry-After"] = String(Math.max(1, Math.ceil((r.reinicia - Date.now()) / 1000)));
  return h;
}
