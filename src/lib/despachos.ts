/** Los despachos (herramientas) del edificio SINAPSIS. */
export interface Despacho {
  id: string;
  nombre: string;
  corto: string;
  descripcion: string;
  ruta: string;
  /** la herramienta ya existe como página */
  listo: boolean;
  /** posición del punto sobre la ilustración (viewBox 1600×900) */
  x: number;
  y: number;
  color: string;
}

export const DESPACHOS: Despacho[] = [
  {
    id: "frescura",
    nombre: "Reloj de Frescura",
    corto: "Frescura",
    descripcion: "Qué tan al día está cada uno de los conjuntos de MEData frente a lo que prometió su secretaría.",
    ruta: "/frescura",
    listo: true,
    x: 380,
    y: 330,
    color: "#f5b942",
  },
  {
    id: "laboratorio",
    nombre: "Laboratorio de Limpieza",
    corto: "Laboratorio",
    descripcion: "Elige un conjunto: lo descargamos en vivo, lo diagnosticamos y te mostramos el antes y el después.",
    ruta: "/laboratorio",
    listo: true,
    x: 560,
    y: 470,
    color: "#3dd6c6",
  },
  {
    id: "ventanilla",
    nombre: "Ventanilla de Apertura",
    corto: "Ventanilla",
    descripcion: "Propuestas concretas de mejora para cada conjunto: qué campo, qué problema y qué pregunta se podría responder.",
    ruta: "/ventanilla",
    listo: true,
    x: 860,
    y: 400,
    color: "#a78bfa",
  },
  {
    id: "analista",
    nombre: "Analista IA",
    corto: "Analista",
    descripcion: "Pregunta en español y obtén la respuesta calculada sobre datos limpios, citando conjunto, campo y fecha de corte.",
    ruta: "/analista",
    listo: true,
    x: 1010,
    y: 520,
    color: "#60a5fa",
  },
  {
    id: "monitoreo",
    nombre: "Sala de Monitoreo · PULSO",
    corto: "Monitoreo",
    descripcion: "PULSO · la ciudad en vivo: el aire de SIATA estación por estación; seguridad vial y hurto por comuna en preparación.",
    ruta: "/monitoreo",
    listo: true,
    x: 1352,
    y: 300,
    color: "#34d399",
  },
];
