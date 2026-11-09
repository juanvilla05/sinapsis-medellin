/**
 * Pruebas del ICA (PM2.5, Resolución 2254/2017). Ejecutar: `npx tsx --test src/lib/ica.test.ts`
 * La coherencia con SIATA se prueba sobre la captura real de src/lib/fixtures (9-nov-2026 01:05 COT).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { calcularICA, categoriaDesdeSiata, categoriaICA, esCentinela, TRAMOS_PM25_COLOMBIA, TRAMOS_PM25_EPA_2024 } from "./ica";

interface Lectura {
  codigo: string;
  pm25: number;
  desc: string;
}

/** Lee lo mínimo del fixture: código, ICA_PM25_Valor (concentración) e ICA_PM25_Descripcion. */
function leerFixture(nombre: string): Lectura[] {
  const ruta = path.resolve(process.cwd(), "src/lib/fixtures", nombre);
  const crudo = JSON.parse(readFileSync(ruta, "utf8").trim()) as {
    feature_vector: {
      atributos: { descripcion: Record<string, { valor_alfanumerico?: string } | undefined> };
    }[];
  };
  return crudo.feature_vector.map((f) => {
    const d = f.atributos.descripcion;
    return {
      codigo: d.Codigo?.valor_alfanumerico ?? "",
      pm25: Number(d.ICA_PM25_Valor?.valor_alfanumerico),
      desc: d.ICA_PM25_Descripcion?.valor_alfanumerico ?? "",
    };
  });
}

describe("esCentinela", () => {
  it("reconoce -9999, negativos, null y NaN", () => {
    assert.equal(esCentinela(-9999), true);
    assert.equal(esCentinela(-1), true);
    assert.equal(esCentinela(null), true);
    assert.equal(esCentinela(undefined), true);
    assert.equal(esCentinela(Number.NaN), true);
    assert.equal(esCentinela(0), false);
    assert.equal(esCentinela(21), false);
  });
});

describe("calcularICA (Resolución 2254/2017)", () => {
  it("cortes exactos de cada tramo", () => {
    assert.equal(calcularICA(0), 0);
    assert.equal(calcularICA(12.0), 50);
    assert.equal(calcularICA(12.1), 51);
    assert.equal(calcularICA(37.0), 100);
    assert.equal(calcularICA(37.1), 101);
    assert.equal(calcularICA(55.0), 150);
    assert.equal(calcularICA(55.1), 151);
    assert.equal(calcularICA(150.0), 200);
    assert.equal(calcularICA(150.1), 201);
    assert.equal(calcularICA(250.0), 300);
    assert.equal(calcularICA(250.1), 301);
    assert.equal(calcularICA(500), 500);
  });
  it("interpola dentro del tramo (21 µg/m³ ≈ 69)", () => {
    assert.equal(calcularICA(21), 69);
    assert.equal(calcularICA(26), 78);
    assert.equal(calcularICA(5), 21);
  });
  it("trunca a un decimal y topa en 500", () => {
    assert.equal(calcularICA(12.04), 50);
    assert.equal(calcularICA(12.05), 50); // 12,05 → 12,0
    assert.equal(calcularICA(12.19), 51);
    assert.equal(calcularICA(900), 500);
  });
  it("centinelas → null", () => {
    assert.equal(calcularICA(-9999), null);
    assert.equal(calcularICA(null), null);
    assert.equal(calcularICA(undefined), null);
    assert.equal(calcularICA(-0.5), null);
  });
  it("tramos continuos y crecientes (Colombia y EPA)", () => {
    for (const tramos of [TRAMOS_PM25_COLOMBIA, TRAMOS_PM25_EPA_2024]) {
      for (let i = 1; i < tramos.length; i++) {
        const a = tramos[i - 1]!;
        const b = tramos[i]!;
        assert.ok(Math.abs(b.cMin - a.cMax - 0.1) < 1e-9, `hueco entre ${a.cMax} y ${b.cMin}`);
        assert.equal(b.iMin, a.iMax + 1);
      }
    }
  });
});

describe("categoriaICA", () => {
  it("mapea rangos de la Tabla No. 5", () => {
    assert.equal(categoriaICA(0).clave, "buena");
    assert.equal(categoriaICA(50).clave, "buena");
    assert.equal(categoriaICA(51).clave, "aceptable");
    assert.equal(categoriaICA(100).clave, "aceptable");
    assert.equal(categoriaICA(101).clave, "danina-sensibles");
    assert.equal(categoriaICA(151).clave, "danina");
    assert.equal(categoriaICA(201).clave, "muy-danina");
    assert.equal(categoriaICA(301).clave, "peligrosa");
    assert.equal(categoriaICA(null).clave, "sin-dato");
  });
  it("trae color y texto", () => {
    assert.equal(categoriaICA(10).color, "#16A34A");
    assert.equal(categoriaICA(null).color, "#64748B");
    assert.equal(categoriaICA(60).texto, "Aceptable");
  });
});

describe("categoriaDesdeSiata", () => {
  it("traduce las etiquetas oficiales", () => {
    assert.equal(categoriaDesdeSiata("Buena"), "buena");
    assert.equal(categoriaDesdeSiata("Moderada"), "aceptable");
    assert.equal(categoriaDesdeSiata("Aceptable"), "aceptable");
    assert.equal(categoriaDesdeSiata("Dañina a la salud de grupos sensibles"), "danina-sensibles");
    assert.equal(categoriaDesdeSiata("Dañina a la salud"), "danina");
    assert.equal(categoriaDesdeSiata("Muy dañina a la salud"), "muy-danina");
    assert.equal(categoriaDesdeSiata("Peligrosa"), "peligrosa");
    assert.equal(categoriaDesdeSiata("ND"), "sin-dato");
    assert.equal(categoriaDesdeSiata(""), "sin-dato");
    assert.equal(categoriaDesdeSiata(null), "sin-dato");
  });
});

describe("coherencia con la captura real de SIATA (fixtures 602 + 603)", () => {
  const lecturas = [...leerFixture("siata-602.json"), ...leerFixture("siata-603.json")];

  it("hay 23 estaciones, 22 con lectura y la #87 sin dato", () => {
    assert.equal(lecturas.length, 23);
    const validas = lecturas.filter((l) => !esCentinela(l.pm25));
    assert.equal(validas.length, 22);
    const bello = lecturas.find((l) => l.codigo === "87");
    assert.ok(bello);
    assert.equal(bello.pm25, -9999);
    assert.equal(calcularICA(bello.pm25), null);
    assert.equal(categoriaDesdeSiata(bello.desc), "sin-dato");
  });

  it("la categoría calculada coincide con la etiqueta oficial de SIATA en las 22 válidas", () => {
    for (const l of lecturas) {
      if (esCentinela(l.pm25)) continue;
      const calculada = categoriaICA(calcularICA(l.pm25)).clave;
      const oficial = categoriaDesdeSiata(l.desc);
      assert.equal(calculada, oficial, `estación #${l.codigo}: ${l.pm25} µg/m³ → ${calculada} vs SIATA "${l.desc}"`);
    }
  });
});
