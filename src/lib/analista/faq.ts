import type { ResumenCatalogo } from "@/lib/catalogo";
import { MEDATA_BASE, MEDATA_CATALOGO } from "@/lib/catalogo";
import { decimal, fechaColombia, miles } from "@/mundo/areas";
import type { Cita, Respuesta } from "./herramientas";

export const TEMAS_FAQ = ["fuentes", "reproducir", "limites", "como-usar", "ia"] as const;
export type TemaFaq = (typeof TEMAS_FAQ)[number];

export interface RespuestaFaq {
  tema: TemaFaq;
  titulo: string;
  parrafos: string[];
}

export const URL_SIATA = "https://siata.gov.co/siata_nuevo/";
export const URL_POLICIA_DATOS_GOV = "https://www.datos.gov.co/resource/ha6j-pa2r.json";

/**
 * Plantillas SIN literales numéricos: toda cifra se interpola desde el resumen del pipeline.
 * Las descripciones de fuentes y licencias son cualitativas; los límites salen de los contadores del resumen.
 */
export function explicarFuentes(tema: TemaFaq, resumen: ResumenCatalogo): Respuesta<RespuestaFaq> {
  const atrasados = resumen.porEstado.atrasado + resumen.porEstado.critico;
  const corte = fechaColombia(resumen.generado);
  const citaCatalogo: Cita = {
    conjunto: "Catálogo DKAN MEData",
    campo: "modified · accrualPeriodicity · distribution",
    url: MEDATA_CATALOGO,
    licencia: "no declarada",
    fechaCorte: resumen.generado,
  };
  const citaSiata: Cita = {
    conjunto: "SIATA – AMVA (capas del visor)",
    campo: "ICA_PM25_Valor · ICA_PM25_Descripcion",
    url: URL_SIATA,
    licencia: "no declarada",
    fechaCorte: null,
  };
  const citaPolicia: Cita = {
    conjunto: "Homicidios en accidente de tránsito, Policía Nacional (datos.gov.co ha6j-pa2r)",
    campo: "fecha_hecho · cantidad · codigo_dane",
    url: URL_POLICIA_DATOS_GOV,
    licencia: "no declarada",
    fechaCorte: null,
  };

  const porTema: Record<TemaFaq, { titulo: string; parrafos: string[]; citas: Cita[] }> = {
    fuentes: {
      titulo: "De dónde salen los datos de PULSO Medellín",
      parrafos: [
        `Todo parte del catálogo abierto de MEData, el portal de datos de la Alcaldía de Medellín. El pipeline del proyecto leyó sus ${miles(resumen.totalConjuntos)} conjuntos el ${corte} y guardó, por cada uno, la fecha de modificación, la periodicidad prometida y los archivos publicados.`,
        `La calidad del aire viene de SIATA, el Sistema de Alerta Temprana del Valle de Aburrá, que publica las lecturas de sus estaciones en capas abiertas de su visor. SIATA no declara licencia: lo decimos tal cual y lo usamos con atribución.`,
        `Las muertes en incidentes viales se contrastan con dos fuentes: los conjuntos de la Secretaría de Movilidad en MEData y el conjunto de la Policía Nacional publicado en datos.gov.co, que es el único con años recientes.`,
        `Ninguna cifra está escrita a mano en la interfaz: todas salen de los archivos del pipeline, de copias guardadas con fecha o de las consultas en vivo, y cada tarjeta muestra su fuente, su licencia (o “no declarada”) y su fecha de corte.`,
      ],
      citas: [citaCatalogo, citaSiata, citaPolicia],
    },
    reproducir: {
      titulo: "Cómo reproducir las cifras",
      parrafos: [
        `El catálogo se descarga de la API pública de MEData (metastore DKAN). Para cada conjunto, PULSO Medellín compara los días transcurridos desde la fecha de modificación con la periodicidad declarada: hasta una vez y media el plazo es “al día”, hasta tres veces es “atrasado” y más de eso es “crítico”.`,
        `Con ese criterio, de los ${miles(resumen.evaluables)} conjuntos que declaran una periodicidad comparable, ${miles(atrasados)} están atrasados o críticos (${decimal(resumen.pctAtrasados)} %). El resto del catálogo no declara periodicidad o no se puede evaluar.`,
        `El Laboratorio de Limpieza descarga el inicio y el final de cada archivo CSV directamente desde MEData con peticiones por rango, detecta la codificación, cuenta filas vacías y duplicadas y aplica reglas de limpieza reproducibles. El puntaje de calidad se calcula antes y después.`,
        `El script del pipeline está en el repositorio y vuelve a generar los archivos de datos; la fecha de corte que ves en cada respuesta es la de esa última ejecución.`,
      ],
      citas: [citaCatalogo],
    },
    limites: {
      titulo: "Límites y hallazgos de los datos",
      parrafos: [
        `En el catálogo, ${miles(resumen.fechasIrregulares)} conjuntos publican la fecha de modificación en formato día-mes-año en vez del estándar ISO, ${miles(resumen.sinDiccionario)} no tienen diccionario de datos y ${miles(resumen.soloTablero)} solo publican un tablero sin archivo descargable.`,
        `Varios conjuntos de seguridad vial y de hurto traen coordenadas con coma decimal, códigos de comuna sin ceros a la izquierda, filas vacías de relleno y textos con la codificación rota. El Laboratorio los repara en vivo y deja constancia en su bitácora.`,
        `Por respeto a las personas, PULSO Medellín nunca muestra filas individuales de víctimas ni de hurtos: solo agregados por comuna, hora o año, y suprime cualquier celda con menos de cinco casos. Tampoco califica barrios: decimos “más casos reportados que el promedio”, nunca “inseguro”.`,
        `La fecha de corte de cada fuente es la que ves en la tarjeta; cuando una fuente en vivo no responde, mostramos la copia guardada con su fecha y lo avisamos.`,
      ],
      citas: [citaCatalogo],
    },
    "como-usar": {
      titulo: "Soy PulsoBot, el asistente de PULSO Medellín",
      parrafos: [
        `Puedes escribirme o hablarme. Te cuento cómo está el aire ahora, cuántos incidentes viales o hurtos se han reportado por comuna, cuál es la ruta con mejor aire entre dos lugares y qué tan al día están los datos abiertos de la ciudad.`,
        `También manejo la plataforma por ti: dime “muéstrame los hurtos en el mapa”, “pon el tema claro”, “inicia el recorrido” o “abre el laboratorio”.`,
        `No invento cifras: cada respuesta sale de una fuente abierta (SIATA, MEData, Policía Nacional) y te digo cuál es y de qué fecha.`,
      ],
      citas: [citaCatalogo],
    },
    ia: {
      titulo: "Qué hace y qué no hace la IA",
      parrafos: [
        `El modelo de lenguaje no genera cifras. Solo invoca funciones deterministas que leen los archivos del pipeline, SIATA, MEData y datos.gov.co; lo que escribe es una redacción de lo que esas funciones devolvieron, con sus citas.`,
        `Cada respuesta cita el conjunto, el campo y la fecha de corte, y puedes verificarla con el botón “Ver la misma respuesta sin IA”, que ejecuta la misma función sin el modelo. Si las dos cifras no coinciden, la que vale es la del modo directo.`,
        `Sin clave de IA, PULSO Medellín funciona completo en modo directo. La IA es un complemento declarado, no un requisito.`,
      ],
      citas: [citaCatalogo],
    },
  };

  const t = porTema[tema];
  return {
    ok: true,
    datos: { tema, titulo: t.titulo, parrafos: t.parrafos },
    citas: t.citas,
    nota: `Explicación generada con plantillas del proyecto; las cifras provienen del resumen del catálogo del ${corte}. Portal: ${MEDATA_BASE}`,
  };
}
