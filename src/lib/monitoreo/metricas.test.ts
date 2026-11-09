import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { celdaRejilla, comunaAnioGravedad, conteo, incidentesComuna, type ComunaAnioCondicion, type ComunaAnioGravedad, type ComunaHora, type DiaSemanaHora } from "./esquemas";
import {
  aniosDisponibles,
  centroCelda,
  filtrarIncidentes,
  filtrarVictimas,
  matrizDiaHora,
  serieHoras,
  sumarPorComuna,
  valoresRejilla,
  valoresRejillaVictimas,
} from "./metricas";

// Datos sintéticos de prueba: ningún conteo entre 1 y 4 (misma regla que los JSON reales).
const incidentes: ComunaAnioGravedad[] = [
  { c: "10", a: 2015, g: "Con heridos", n: 40 },
  { c: "10", a: 2015, g: "Solo daños", n: 50 },
  { c: "10", a: 2015, g: "Con muertos", n: null },
  { c: "10", a: 2016, g: "Con heridos", n: 30 },
  { c: "14", a: 2015, g: "Con heridos", n: 20 },
  { c: "14", a: 2016, g: "Solo daños", n: 10 },
];

describe("sumarPorComuna", () => {
  it("suma por comuna, ordena por código y calcula total y máximo", () => {
    const r = sumarPorComuna(incidentes);
    assert.deepEqual(
      r.porComuna.map((v) => [v.codigo, v.valor]),
      [
        ["10", 120],
        ["14", 30],
      ],
    );
    assert.equal(r.total, 150);
    assert.equal(r.maximo, 120);
    assert.equal(r.comunasConDato, 2);
  });

  it("marca incompleta la comuna que sumó una celda suprimida y cuenta las suprimidas", () => {
    const r = sumarPorComuna(incidentes);
    const c10 = r.porComuna.find((v) => v.codigo === "10")!;
    assert.equal(c10.incompleto, true);
    assert.equal(c10.suprimidas, 1);
    assert.equal(r.porComuna.find((v) => v.codigo === "14")!.incompleto, false);
    assert.equal(r.suprimidas, 1);
  });

  it("sin filas que pasen el filtro devuelve lista vacía, total 0 y máximo 0 (nunca un cero inventado por comuna)", () => {
    const r = sumarPorComuna(incidentes, (f) => f.a === 1999);
    assert.deepEqual(r.porComuna, []);
    assert.equal(r.total, 0);
    assert.equal(r.maximo, 0);
  });

  it("una comuna cuyas únicas filas están suprimidas queda con valor 0 e incompleto (se muestra como '<5')", () => {
    const r = sumarPorComuna(incidentes, (f) => f.g === "Con muertos");
    assert.deepEqual(r.porComuna, [{ codigo: "10", valor: 0, incompleto: true, suprimidas: 1 }]);
    assert.equal(r.comunasConDato, 0);
  });
});

describe("filtros", () => {
  it("filtrarIncidentes combina año y gravedad", () => {
    assert.equal(filtrarIncidentes(incidentes, { anio: 2015 }).length, 4);
    assert.equal(filtrarIncidentes(incidentes, { anio: 2015, gravedad: "Con heridos" }).length, 2);
    assert.equal(filtrarIncidentes(incidentes).length, incidentes.length);
  });

  it("filtrarVictimas lee el conteo pedido (total, heridos o muertos)", () => {
    const victimas: ComunaAnioCondicion[] = [
      { c: "05", a: 2019, cond: "motociclista", n: 60, heridos: 55, muertos: 5 },
      { c: "05", a: 2019, cond: "peaton", n: 12, heridos: 12, muertos: null },
    ];
    assert.deepEqual(filtrarVictimas(victimas, { condicion: "peaton" }), [{ c: "05", n: 12 }]);
    assert.deepEqual(filtrarVictimas(victimas, { gravedad: "muertos" }), [
      { c: "05", n: 5 },
      { c: "05", n: null },
    ]);
    assert.equal(sumarPorComuna(filtrarVictimas(victimas, { anio: 2019 })).total, 72);
  });

  it("aniosDisponibles devuelve los años únicos ordenados", () => {
    assert.deepEqual(aniosDisponibles(incidentes), [2015, 2016]);
  });
});

describe("series", () => {
  it("serieHoras devuelve 24 puntos, null donde no hay filas, y filtra por comuna", () => {
    const filas: ComunaHora[] = [
      { c: "10", h: 7, n: 100 },
      { c: "14", h: 7, n: 20 },
      { c: "10", h: 3, n: null },
    ];
    const ciudad = serieHoras(filas);
    assert.equal(ciudad.length, 24);
    assert.equal(ciudad[7]!.valor, 120);
    assert.equal(ciudad[0]!.valor, null);
    assert.deepEqual(ciudad[3], { hora: 3, valor: 0, incompleto: true });
    assert.equal(serieHoras(filas, "14")[7]!.valor, 20);
  });

  it("matrizDiaHora arma 7 × 24 con null donde no hay dato", () => {
    const filas: DiaSemanaHora[] = [{ d: 4, h: 18, n: 300 }];
    const m = matrizDiaHora(filas);
    assert.equal(m.length, 7);
    assert.equal(m[4]!.length, 24);
    assert.equal(m[4]![18]!.valor, 300);
    assert.equal(m[0]![0]!.valor, null);
  });
});

describe("rejilla", () => {
  it("valoresRejilla conserva i, j y calcula total y máximo", () => {
    const r = valoresRejilla([
      { i: 2777, j: -33586, n: 700 },
      { i: 2777, j: -33587, n: 300 },
    ]);
    assert.equal(r.total, 1000);
    assert.equal(r.maximo, 700);
    assert.deepEqual(r.celdas[0], { i: 2777, j: -33586, valor: 700 });
  });

  it("valoresRejillaVictimas omite celdas cuyo sub-conteo está suprimido", () => {
    const celdas = [
      { i: 1, j: 1, n: 20, peaton: 10, motociclista: 10, ciclista: 0, otro: 0, heridos: 20, muertos: null },
      { i: 1, j: 2, n: 8, peaton: null, motociclista: 8, ciclista: 0, otro: 0, heridos: 8, muertos: 0 },
    ];
    assert.equal(valoresRejillaVictimas(celdas).celdas.length, 2);
    assert.equal(valoresRejillaVictimas(celdas, { condicion: "peaton" }).celdas.length, 1);
    assert.equal(valoresRejillaVictimas(celdas, { gravedad: "muertos" }).celdas.length, 0);
    assert.equal(valoresRejillaVictimas(celdas, { condicion: "motociclista" }).total, 18);
  });

  it("centroCelda invierte la rejilla de 0.00225°", () => {
    const { lat, lng } = centroCelda(2777, -33586, 0.00225);
    assert.ok(Math.abs(lat - 6.249) < 0.002);
    assert.ok(Math.abs(lng - (-75.567)) < 0.002);
  });
});

describe("esquemas (supresión)", () => {
  it("conteo acepta 0 y ≥5 y rechaza 1–4", () => {
    assert.equal(conteo.safeParse(0).success, true);
    assert.equal(conteo.safeParse(5).success, true);
    for (const n of [1, 2, 3, 4]) assert.equal(conteo.safeParse(n).success, false, `debió rechazar ${n}`);
  });

  it("una celda de rejilla con n<5 se rechaza; una fila por comuna con n null se acepta", () => {
    assert.equal(celdaRejilla.safeParse({ i: 1, j: 1, n: 3 }).success, false);
    assert.equal(comunaAnioGravedad.safeParse({ c: "10", a: 2015, g: "Con muertos", n: null }).success, true);
    assert.equal(comunaAnioGravedad.safeParse({ c: "10", a: 2015, g: "Con muertos", n: 2 }).success, false);
    assert.equal(comunaAnioGravedad.safeParse({ c: "5", a: 2015, g: "Con muertos", n: 20 }).success, false, "código sin zfill");
  });

  it("un archivo completo con una sola celda 1–4 se rechaza entero", () => {
    const base = {
      generado: "2026-11-09T10:00:00Z",
      fuente: {
        nombre: "x",
        id: "1-023-25-000094",
        url: "https://medata.app.medellin.gov.co/dataset/1-023-25-000094",
        archivo: "https://medata.app.medellin.gov.co/a.csv",
        publicador: "MEData",
        licencia: "no declarada",
        modificadoPortal: null,
        fechaCorte: null,
        periodo: { desde: null, hasta: null },
        filasLeidas: 10,
        filasConCoordenadas: 10,
      },
      umbralSupresion: 5,
      notas: [],
      campos: {},
      supresion: { comunaAnioGravedad: { filasTotales: 1, filasSuprimidas: 0 }, comunaHora: { filasTotales: 0, filasSuprimidas: 0 } },
      comunaHora: [],
    };
    assert.equal(incidentesComuna.safeParse({ ...base, comunaAnioGravedad: [{ c: "10", a: 2015, g: "Con heridos", n: 10 }] }).success, true);
    assert.equal(incidentesComuna.safeParse({ ...base, comunaAnioGravedad: [{ c: "10", a: 2015, g: "Con heridos", n: 3 }] }).success, false);
    assert.equal(incidentesComuna.safeParse({ ...base, umbralSupresion: 3, comunaAnioGravedad: [] }).success, false, "umbral menor que 5");
  });
});
