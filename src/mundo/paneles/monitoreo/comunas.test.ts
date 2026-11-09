import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HurtoComuna, IncidentesComuna } from "@/lib/monitoreo/esquemas";
import { construirBrecha } from "./brecha";
import { construirVista, FILTROS_INICIALES, textoValor, totalFranja } from "./capas";
import { alturaCelda, alturaComuna, colorComuna, colorSecuencial, COLOR_SIN_DATO } from "./escala";
import { bboxDeGeometrias, crearProyeccion, rutaSvg } from "./proyeccion";

// Datos sintéticos (ningún conteo entre 1 y 4, como los JSON reales).
const fuente = {
  nombre: "Prueba",
  id: "0-000-00-000000",
  url: "https://medata.app.medellin.gov.co/dataset/x",
  archivo: "https://medata.app.medellin.gov.co/x.csv",
  publicador: "MEData",
  licencia: "https://creativecommons.org/licenses/by-sa/4.0/legalcode",
  modificadoPortal: null,
  fechaCorte: "2020-09-01",
  periodo: { desde: "2014-07-04", hasta: "2020-09-01" },
  filasLeidas: 100,
  filasConCoordenadas: 100,
};

const incidentes: IncidentesComuna = {
  generado: "2026-01-01T00:00:00Z",
  fuente,
  umbralSupresion: 5,
  notas: [],
  campos: {},
  supresion: { comunaAnioGravedad: { filasTotales: 3, filasSuprimidas: 1 }, comunaHora: { filasTotales: 3, filasSuprimidas: 0 } },
  comunaAnioGravedad: [
    { c: "10", a: 2015, g: "Con heridos", n: 40 },
    { c: "10", a: 2015, g: "Con muertos", n: null },
    { c: "14", a: 2016, g: "Solo daños", n: 10 },
  ],
  comunaHora: [
    { c: "10", h: 7, n: 30 },
    { c: "10", h: 18, n: 50 },
    { c: "14", h: 19, n: 20 },
  ],
};

const hurto: HurtoComuna = {
  generado: "2026-01-01T00:00:00Z",
  fuente: { ...fuente, periodo: { desde: "2003-01-01", hasta: "2023-11-30" } },
  umbralSupresion: 5,
  notas: [],
  campos: {},
  modalidades: {},
  supresion: { comunaAnioModalidad: { filasTotales: 2, filasSuprimidas: 0 }, diaSemanaHora: { filasTotales: 2, filasSuprimidas: 0 } },
  comunaAnioModalidad: [
    { c: "10", a: 2019, m: "Atraco", n: 100 },
    { c: "10", a: 2019, m: "Descuido", n: 60 },
  ],
  diaSemanaHora: [
    { d: 0, h: 20, n: 500 },
    { d: 4, h: 2, n: 200 },
  ],
};

describe("capas", () => {
  it("la franja horaria de incidentes cambia a la tabla comuna×hora y lo advierte", () => {
    const v = construirVista({ incidentes, victimas: null, hurto }, { ...FILTROS_INICIALES, capa: "incidentes", franja: "noche" })!;
    assert.deepEqual(
      v.resumen.porComuna.map((c) => [c.codigo, c.valor]),
      [
        ["10", 50],
        ["14", 20],
      ],
    );
    assert.match(v.nota ?? "", /no distingue año ni gravedad/);
  });
  it("sin franja, incidentes por año y gravedad marcan incompleto cuando suman una celda suprimida", () => {
    const v = construirVista({ incidentes, victimas: null, hurto }, { ...FILTROS_INICIALES, capa: "incidentes", anio: 2015 })!;
    const c10 = v.resumen.porComuna.find((c) => c.codigo === "10")!;
    assert.equal(c10.valor, 40);
    assert.equal(c10.incompleto, true);
    assert.equal(textoValor(c10).marca, true);
    assert.equal(textoValor({ codigo: "01", valor: 0, incompleto: true, suprimidas: 1 }).texto, "<5");
    assert.equal(textoValor(undefined).texto, "—");
  });
  it("hurto por modalidad y mapa de calor día×hora; la franja no toca el mapa pero sí el total de la franja", () => {
    const v = construirVista({ incidentes, victimas: null, hurto }, { ...FILTROS_INICIALES, modalidad: "Atraco", franja: "noche" })!;
    assert.equal(v.resumen.total, 100);
    assert.ok(v.diaHora && v.diaHora[0]![20]!.valor === 500);
    assert.equal(totalFranja({ incidentes, victimas: null, hurto }, "hurto", "noche"), 500);
    assert.equal(totalFranja({ incidentes, victimas: null, hurto }, "hurto", "madrugada"), 200);
  });
  it("una capa sin tabla devuelve null (la interfaz muestra 'en preparación')", () => {
    assert.equal(construirVista({ incidentes, victimas: null, hurto }, { ...FILTROS_INICIALES, capa: "victimas" }), null);
  });
});

describe("brecha", () => {
  it("redacta el texto con los años ancla sacados de las series", () => {
    const r = construirBrecha({
      medata: { serie: [{ a: 2019, n: 250 }, { a: 2020, n: 180 }, { a: 2021, n: 200 }], hasta: "2021-09-30" },
      policia: {
        serie: [
          { anio: 2019, victimas: 231 },
          { anio: 2021, victimas: 353 },
          { anio: 2023, victimas: 563 },
          { anio: 2026, victimas: 348 },
        ],
        corte: "2026-09-01T15:24:46-05:00",
      },
    });
    assert.equal(r.ultimoAnioMedata, 2021);
    assert.deepEqual(r.anclasPolicia, [2021, 2023, 2026]);
    assert.equal(r.texto, "MEData deja de publicar en 2021 (200 muertes, con datos hasta septiembre de 2021); la Policía reporta 353 en 2021 → 563 en 2023 → 348 en 2026 (año en curso, parcial), al corte 01-09-2026.");
    assert.equal(r.filas.find((f) => f.anio === 2021)!.diferencia, 153);
    assert.equal(r.maximo, 563);
  });
  it("sin Policía lo dice; sin MEData también", () => {
    assert.match(construirBrecha({ medata: { serie: [{ a: 2016, n: 271 }], hasta: null }, policia: null }).texto, /la Policía no respondió/);
    assert.match(construirBrecha({ medata: null, policia: { serie: [{ anio: 2023, victimas: 563 }], corte: null } }).texto, /MEData no está disponible; la Policía reporta 563 en 2023\./);
  });
});

describe("proyección y escala", () => {
  it("centra la caja y produce una ruta SVG cerrada", () => {
    const g = { type: "Polygon" as const, coordinates: [[[-75.6, 6.2], [-75.5, 6.2], [-75.5, 6.3], [-75.6, 6.3], [-75.6, 6.2]]] };
    const p = crearProyeccion(bboxDeGeometrias([g]));
    const centro = p.proyectar(-75.55, 6.25);
    assert.ok(Math.abs(centro.x) < 1e-9 && Math.abs(centro.y) < 1e-9);
    assert.ok(p.alto > p.ancho, "un grado de latitud mide más que uno de longitud a 6° N");
    const d = rutaSvg(g, p);
    assert.ok(d.startsWith("M") && d.endsWith("Z"));
  });
  it("colores y alturas respetan sus extremos", () => {
    assert.equal(colorSecuencial(0), "#dbeafe");
    assert.equal(colorSecuencial(1), "#1e3a5f");
    assert.equal(colorComuna(null, 10), COLOR_SIN_DATO);
    assert.equal(alturaComuna(10, 10), 8);
    assert.equal(alturaComuna(null, 10), 0.3);
    assert.equal(alturaCelda(100, 100), 6);
    assert.ok(alturaCelda(25, 100) > alturaCelda(0, 100));
  });
});
