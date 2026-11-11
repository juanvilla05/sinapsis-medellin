/**
 * Intérprete de preguntas sin modelo de lenguaje: reconoce la intención por palabras clave y arma la llamada a la
 * herramienta correcta. Lo usa PulsoBot cuando no hay IA (sin clave, cuota agotada o red caída), para que una
 * pregunta libre —escrita o hablada— se responda igual con datos y cita. No calcula nada: solo elige herramienta y
 * argumentos; las cifras siempre salen de la herramienta.
 * Archivo puro (sin servidor): lo importan el panel y las pruebas.
 */
import { COMUNAS_MEDELLIN, MUNICIPIOS_AMVA } from "@/lib/territorio";
import type { NombreHerramienta } from "./sugeridas";

export interface Intencion {
  herramienta: NombreHerramienta;
  args: Record<string, unknown>;
}

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const limpiar = (t: string) =>
  sinTildes(t)
    .replace(/[¿?¡!.,;:"“”«»()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const MODALIDADES = ["Atraco", "Descuido", "Cosquilleo", "Raponazo", "Engaño", "Escopolamina", "Halado", "Rompimiento"];
const SECRETARIAS = ["Movilidad", "Salud", "Educación", "Seguridad", "Planeación", "Hacienda", "Cultura", "Inclusión Social", "Desarrollo Económico", "Medio Ambiente", "Infraestructura", "Gobierno"];
const SECCIONES: [RegExp, string][] = [
  [/\b(alpujarra|calidad de (los )?datos|agencia|oficina|panel|tablero)\b/, "alpujarra"],
  [/\b(laboratorio|limpieza)\b/, "laboratorio"],
  [/\b(frescura|reloj)\b/, "frescura"],
  [/\b(monitoreo|sala)\b/, "monitoreo"],
  [/\b(inicio|portada|mapa principal)\b/, "inicio"],
];
const CAPAS: [RegExp, string][] = [
  [/\b(incidente|accidente|choque|siniestr)/, "incidentes"],
  [/\b(victima|herid|lesionad)/, "victimas"],
  [/\b(hurto|robo|atraco)/, "hurto"],
  [/\b(comuna|corregimiento|limite|division)/, "comunas"],
  [/\b(aire|pm2|estacion|siata|contaminacion)/, "aire"],
];

function comunaEn(t: string): string | undefined {
  const porNumero = /\bcomuna (\d{1,2})\b/.exec(t);
  if (porNumero) return porNumero[1];
  // nombres más largos primero: "San Antonio de Prado" antes que "San Cristóbal"
  const nombres = [...COMUNAS_MEDELLIN].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const c of nombres) {
    const n = sinTildes(c.nombre).replace(/-/g, " ");
    if (t.replace(/-/g, " ").includes(n)) return c.nombre;
  }
  if (/\bel centro\b|\bcentro de medellin\b/.test(t)) return "La Candelaria";
  if (/\blaureles\b|\bestadio\b/.test(t)) return "Laureles-Estadio";
  if (/\bpoblado\b/.test(t)) return "El Poblado";
  return undefined;
}

const anioEn = (t: string) => {
  const m = /\b(20[0-2]\d)\b/.exec(t);
  return m ? Number(m[1]) : undefined;
};

/** "de X a Y", "desde X hasta Y", "entre X y Y" sobre el texto original (conserva mayúsculas y tildes de los lugares). */
function rutaEn(original: string): { origen: string; destino: string } | null {
  const o = original.replace(/[¿?¡!]/g, " ").replace(/\s+/g, " ").trim();
  const patrones = [/\b(?:de|desde)\s+(.+?)\s+(?:a|al|hasta|hacia|para)\s+(.+)$/i, /\bentre\s+(.+?)\s+y\s+(.+)$/i];
  for (const p of patrones) {
    const m = p.exec(o);
    if (!m) continue;
    const recortar = (x: string) =>
      x
        .replace(/\b(en|por|con)\s+(carro|auto|moto|bici|bicicleta|pie)\b.*$/i, "")
        .replace(/\b(caminando|a pie|por favor|ahora|hoy)\b.*$/i, "")
        .replace(/[.,;]+$/, "")
        .trim();
    const origen = recortar(m[1]!);
    const destino = recortar(m[2]!);
    if (origen.length >= 2 && destino.length >= 2) return { origen, destino };
  }
  return null;
}

/** Devuelve la herramienta y los argumentos para una pregunta libre; null si no reconoce nada útil. */
export function interpretar(pregunta: string): Intencion | null {
  const t = limpiar(pregunta);
  if (!t) return null;
  const comuna = comunaEn(t);
  const anio = anioEn(t);

  // 1) Control de la plataforma
  if (/\b(tema|modo|fondo|pantalla|ponlo|ponla|pon|cambia)\b.*\b(clar[oa]|blanc[oa]|dia)\b/.test(t)) return { herramienta: "controlarApp", args: { accion: "tema", tema: "claro" } };
  if (/\b(tema|modo|fondo|pantalla|ponlo|ponla|pon|cambia)\b.*\b(oscur[oa]|negr[oa]|noche|nocturn[oa])\b/.test(t)) return { herramienta: "controlarApp", args: { accion: "tema", tema: "oscuro" } };
  if (/\b(recorrido|gira|rota|tour|sobrevuel)/.test(t)) return { herramienta: "controlarApp", args: { accion: "recorrido", activo: !/\b(para|deten|quita|apaga|pausa|no)\b/.test(t) } };
  if (/\b(vista inicial|centra|reinicia el mapa|vuelve al inicio|vista general|aleja)/.test(t)) return { herramienta: "controlarApp", args: { accion: "vista-inicial" } };
  if (/\b(limpia|borra|quita)\b.*\bruta/.test(t)) return { herramienta: "controlarApp", args: { accion: "limpiar-rutas" } };
  // vistas del mapa: por comunas, una sola comuna o puntos calientes
  const datoVista = CAPAS.find(([r, c]) => c !== "comunas" && c !== "aire" && r.test(t))?.[1];
  const conDato = datoVista ? { capa: datoVista } : {};
  const pideVer = /\b(muestra|muestrame|mostrar|ver|verlo|veamos|pon|ponme|pinta|colorea|cambia|quiero|vista|mapa|ensena|ensename)\b/.test(t);
  if (/\b(solo|solamente|unicamente|nada mas|enfoca|enfocate|aisla)\b/.test(t) && comuna && pideVer)
    return { herramienta: "controlarApp", args: { accion: "vista", vista: "una-comuna", comuna, ...conDato } };
  if (pideVer && /\b(por comunas?|mapa de comunas|vista de comunas|sin (tantas |las )?(barras|barritas|columnas))\b/.test(t))
    return { herramienta: "controlarApp", args: { accion: "vista", vista: "comunas", ...conDato } };
  if (pideVer && /\b(puntos calientes|por puntos|vista de puntos|en columnas|con columnas|las columnas|las barras)\b/.test(t))
    return { herramienta: "controlarApp", args: { accion: "vista", vista: "puntos", ...conDato } };
  const verbo = /\b(muestra|muestrame|mostrar|activa|prende|enciende|ensena|ver|pon|quiero ver|oculta|esconde|quita|apaga|desactiva)\b/.exec(t);
  if (verbo && /\b(capa|mapa|columnas|puntos|faros)\b|\ben el mapa\b/.test(t)) {
    const capa = CAPAS.find(([r]) => r.test(t));
    if (capa) return { herramienta: "controlarApp", args: { accion: "capa", capa: capa[1], visible: !/^(oculta|esconde|quita|apaga|desactiva)$/.test(verbo[1]!) } };
  }
  if (/\b(abre|abrir|ve a|ir a|llevame a|muestrame|entra a|pasa a)\b/.test(t)) {
    if (/\brutas?\b/.test(t) && !rutaEn(pregunta)) return { herramienta: "controlarApp", args: { accion: "abrir-rutas" } };
    const seccion = SECCIONES.find(([r]) => r.test(t));
    if (seccion) return { herramienta: "controlarApp", args: { accion: "ir-a", seccion: seccion[1] } };
  }

  // 2) Rutas
  if (/\b(ruta|rutas|llegar|llego|ir |voy|vamos|llevame|camino|trayecto|viaje)/.test(t)) {
    const r = rutaEn(pregunta);
    if (r) {
      const modo = /\b(moto|motocicleta)\b/.test(t) ? "TWO_WHEELER" : /\b(bici|bicicleta|cicla)\b/.test(t) ? "BICYCLE" : /\b(a pie|caminando|caminar|andando)\b/.test(t) ? "WALK" : "DRIVE";
      const conCiudad = (x: string) => (/medell|envigado|itagu|bello|sabaneta|estrella|caldas|copacabana|girardota|barbosa/i.test(x) ? x : `${x}, Medellín`);
      return { herramienta: "planearRuta", args: { origen: conCiudad(r.origen), destino: conCiudad(r.destino), modo } };
    }
  }

  // 3) Aire
  if (/\b(aire|pm2|pm 2|contaminacion|respir|calidad del aire|estacion|estaciones|siata|humo|smog)\b/.test(t)) {
    const municipio = MUNICIPIOS_AMVA.find((m) => m !== "Medellín" && t.includes(sinTildes(m)));
    if (municipio) return { herramienta: "consultarAire", args: { municipio } };
    return { herramienta: "consultarAire", args: { ambito: /\b(valle|area metropolitana|aburra|municipios)\b/.test(t) ? "area-metropolitana" : "medellin" } };
  }

  // 4) Muertes viales por año (MEData vs Policía)
  if (/\b(muert|fallecid|mortal|homicidio)/.test(t) && /\b(vial|transito|incidente|accidente|carretera|via|policia|medata)/.test(t)) {
    return { herramienta: "consultarSeguridadVial", args: { tema: "muertes-anio", ...(anio ? { anio } : {}) } };
  }

  // 5) Hurto
  if (/\b(hurto|hurtos|robo|robos|roban|atraco|atracos|raponazo|cosquilleo|escopolamina|halado)\b/.test(t)) {
    const modalidad = MODALIDADES.find((m) => t.includes(sinTildes(m)));
    return { herramienta: "consultarHurtoComuna", args: { ...(comuna ? { comuna } : {}), ...(anio && anio <= 2023 ? { anio } : {}), ...(modalidad ? { modalidad } : {}) } };
  }

  // 6) Seguridad vial
  if (/\b(incidente|incidentes|accidente|accidentes|choque|choques|siniestr\w*|victima|victimas|herid\w*|peaton\w*|motociclista\w*|ciclista\w*|vial|viales|transito)\b/.test(t)) {
    const condicion = /\bpeaton/.test(t) ? "peaton" : /\bmotociclist|\bmotos?\b/.test(t) ? "motociclista" : /\bciclist|\bbici/.test(t) ? "ciclista" : undefined;
    const hora = /\ba las? (\d{1,2})\b/.exec(t);
    const victimas = Boolean(condicion) || /\b(victima|victimas|herid|lesionad)/.test(t);
    return {
      herramienta: "consultarSeguridadVial",
      args: {
        tema: victimas ? "victimas" : "incidentes",
        ...(condicion ? { condicion } : {}),
        ...(comuna ? { comuna } : {}),
        ...(anio && anio >= 2014 ? { anio } : {}),
        ...(!victimas && hora && Number(hora[1]) <= 23 ? { hora: Number(hora[1]) } : {}),
      },
    };
  }

  // 7) Limpieza de un conjunto por identificador
  const id = /\b\d-\d{3}-\d{2}-\d{6}\b/.exec(pregunta);
  if (id && /\b(limpi|calidad|diagnostic|laboratorio|revisa)/.test(t)) return { herramienta: "limpiarConjunto", args: { id: id[0] } };

  // 8) Frescura del catálogo
  if (/\b(atrasad\w*|al dia|frescura|desactualizad\w*|actualizad\w*|actualizan?|secretaria\w*|catalogo|conjuntos?|datasets?|medata)\b/.test(t)) {
    const secretaria = SECRETARIAS.find((s) => t.includes(sinTildes(s)));
    if (/\b(busca|buscar|encuentra|hay (un |algun )?(conjunto|dato))/.test(t) && !secretaria) {
      const texto = pregunta.replace(/^.*?\b(?:de|sobre|con)\s+/i, "").trim() || pregunta;
      return { herramienta: "buscarConjunto", args: { texto: texto.slice(0, 80) } };
    }
    return { herramienta: "consultarFrescura", args: secretaria ? { secretaria } : { limite: 5 } };
  }

  // 9) Sobre la plataforma
  if (/\b(reproduc|replicar|codigo|repositorio|github)\b/.test(t)) return { herramienta: "explicarFuentes", args: { tema: "reproducir" } };
  if (/\b(limite|limitacion|no puedes|no sabes|falla|confiable|privacidad|datos personales)\b/.test(t)) return { herramienta: "explicarFuentes", args: { tema: "limites" } };
  if (/\b(inteligencia artificial|la ia|usas ia|gemini|modelo|inventas|alucin)\b/.test(t)) return { herramienta: "explicarFuentes", args: { tema: "ia" } };
  if (/\b(fuente|fuentes|de donde|origen|quien publica|licencia)\b/.test(t)) return { herramienta: "explicarFuentes", args: { tema: "fuentes" } };
  if (/\b(hola|buenas|buenos dias|ayuda|que puedes|que haces|que sabes|como funciona|como te uso|quien eres|que eres|para que sirve|que es pulso|gracias)\b/.test(t))
    return { herramienta: "explicarFuentes", args: { tema: "como-usar" } };

  // 10) Solo una comuna: lo más pedido es seguridad vial ahí
  if (comuna) return { herramienta: "consultarSeguridadVial", args: { tema: "incidentes", comuna } };

  return null;
}
