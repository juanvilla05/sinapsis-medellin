/**
 * Pruebas de la normalización de cámaras (SIMM y SIATA). Ejecutar: `npx tsx --test src/lib/camaras-fuentes.test.ts`
 * Los casos reproducen lo que entregaban las fuentes el 13 de noviembre de 2026.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { CamaraPulso } from "../pulso/tipos";
import { claveNombre, fotoSimm, nombreSiata, normalizarSiata, normalizarSimm } from "./camaras-fuentes";

const simm = (attributes: Record<string, unknown>) => ({ attributes });

describe("normalizarSimm", () => {
  it("reescribe el enlace a https y /SIMM/ y limpia el nombre", () => {
    const [c] = normalizarSimm({
      features: [simm({ direccion: " Cr 83C Cl 33 ", localizacion: "El Castillo\r\n", link_foto: "http://www.medellin.gov.co/simm/camaras-cctv/imagen77.jpg", latitud: 6.238633, longitud: -75.608014 })],
    });
    assert.deepEqual(c, {
      id: "simm-77",
      fuente: "simm",
      tipo: "via",
      nombre: "El Castillo",
      direccion: "Cr 83C Cl 33",
      lat: 6.238633,
      lng: -75.608014,
      fotos: ["https://www.medellin.gov.co/SIMM/camaras-cctv/imagen77.jpg"],
    });
  });

  it("completa las cámaras sin enlace con la foto identificada por su rótulo", () => {
    const camaras = normalizarSimm({
      features: [
        simm({ direccion: "Cr 50 x Cll 30", localizacion: "Puente Guayaquil ", link_foto: null, latitud: 6.23405621, longitud: -75.57592857 }),
        simm({ direccion: "Cr 63A Cl 38", localizacion: "Estaciom Cisneros", link_foto: "https://www.medellin.gov.co/simm/camaras-cctv/imagen.jpg", latitud: 6.24913212, longitud: -75.57526762 }),
        simm({ direccion: "Carrera 63 No. 111 EE-04", localizacion: "Avenida Paralela\r\nAvenida Paralela", link_foto: null, latitud: 6.30521411, longitud: -75.55797651 }),
      ],
    });
    assert.deepEqual(
      camaras.map((c) => [c.id, c.nombre, c.fotos[0]]),
      [
        ["simm-16", "Puente Guayaquil", fotoSimm(16)],
        ["simm-19", "Estación Cisneros", fotoSimm(19)],
        ["simm-82", "Avenida Paralela", fotoSimm(82)],
      ],
    );
  });

  it("descarta las cámaras sin foto, sin coordenadas válidas o repetidas", () => {
    const camaras = normalizarSimm({
      features: [
        simm({ direccion: "Cr 63A Cl 38", localizacion: "Conquistadores", link_foto: "https://www.medellin.gov.co/simm/camaras-cctv/imagen.jpg", latitud: 6.2413, longitud: -75.5785 }),
        simm({ direccion: "x", localizacion: "Fuera del valle", link_foto: "http://www.medellin.gov.co/simm/camaras-cctv/imagen5.jpg", latitud: 0, longitud: 0 }),
        simm({ direccion: "a", localizacion: "Uno", link_foto: "http://www.medellin.gov.co/simm/camaras-cctv/imagen9.jpg", latitud: 6.25, longitud: -75.57 }),
        simm({ direccion: "b", localizacion: "Uno repetido", link_foto: "http://www.medellin.gov.co/simm/camaras-cctv/imagen9.jpg", latitud: 6.26, longitud: -75.58 }),
      ],
    });
    assert.deepEqual(
      camaras.map((c) => c.id),
      ["simm-9"],
    );
  });

  it("rechaza una respuesta con otra forma", () => {
    assert.throws(() => normalizarSimm({ error: { code: 500 } }));
  });
});

const siata = (nombre: string, lng: number, lat: number, fotos: string[]) => ({
  geometry_text: JSON.stringify({ type: "Point", coordinates: [lng, lat, 0] }),
  atributos: {
    metadato: {
      name: { valor_alfanumerico: nombre },
      description: { valor_alfanumerico: fotos.map((f) => `<img src="http://siata.gov.co/ultimasFotosCamaras/${f}"><img src="http://siata.gov.co/iconos/camaras/camara_verde.png">`).join("") },
    },
  },
});

describe("normalizarSiata", () => {
  it("lee nombre, punto y fotos en https, y no repite una foto entre capas", () => {
    const camaras = normalizarSiata([
      { tipo: "via", crudo: { feature_vector: [siata("Camara deprimido Bulerias", -75.5899, 6.2395, ["ultimacam_dep_bulerias.jpg"])] } },
      { tipo: "agua", crudo: { feature_vector: [siata("Camara rio Medellin - Aula Ambiental CCTV", -75.5724, 6.2642, ["ultimacam_099_NIVEL.jpg"])] } },
      {
        tipo: "panoramica",
        crudo: {
          feature_vector: [
            siata("Torre Siata", -75.5889, 6.2589, ["ultimacam_81_TORRESIATA_oriente.jpg", "ultimacam_FishEye_SIATA.jpg"]),
            siata("Aula Ambiental", -75.5725, 6.2641, ["ultimacam_099_NIVEL.jpg"]),
          ],
        },
      },
    ]);
    assert.deepEqual(
      camaras.map((c) => [c.id, c.tipo, c.nombre, c.fotos.length]),
      [
        ["siata-dep_bulerias", "via", "Deprimido Bulerias", 1],
        ["siata-099_nivel", "agua", "Rio Medellin - Aula Ambiental", 1],
        ["siata-81_torresiata_oriente", "panoramica", "Torre Siata", 2],
      ],
    );
    assert.equal(camaras[0]!.fotos[0], "https://siata.gov.co/ultimasFotosCamaras/ultimacam_dep_bulerias.jpg");
  });

  it("limpia los nombres del visor", () => {
    assert.equal(nombreSiata("Camara Deprimido Los Musicos CCTV"), "Deprimido Los Musicos");
    assert.equal(nombreSiata("Camara - Nivel picacha aguas frias"), "Picacha aguas frias");
    assert.equal(nombreSiata("Camara color Puente de la 33"), "Puente de la 33");
    assert.equal(nombreSiata("Camara  Nivel la raya"), "La raya");
  });
});

describe("copia guardada del listado", () => {
  const copia = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "camaras.json"), "utf8")) as { capturado: string; camaras: CamaraPulso[] };

  it("trae las dos fuentes, sin ids repetidos y solo con fotos https de la fuente", () => {
    assert.ok(copia.camaras.filter((c) => c.fuente === "simm").length >= 70);
    assert.ok(copia.camaras.filter((c) => c.fuente === "siata").length >= 15);
    assert.equal(new Set(copia.camaras.map((c) => c.id)).size, copia.camaras.length);
    for (const c of copia.camaras) {
      assert.ok(c.fotos.length > 0, c.id);
      for (const f of c.fotos) assert.match(f, /^https:\/\/(www\.medellin\.gov\.co\/SIMM\/camaras-cctv\/imagen\d+\.jpg|siata\.gov\.co\/ultimasFotosCamaras\/ultimacam_[\w.-]+\.jpg)$/, c.id);
      assert.ok(c.lat > 5.9 && c.lat < 6.6 && c.lng > -76 && c.lng < -75, c.id);
    }
  });
});

describe("claveNombre", () => {
  it("ignora tildes, signos y mayúsculas", () => {
    assert.equal(claveNombre("Av.Regional paralela Tricentenario Qda. Minitas"), "av regional paralela tricentenario qda minitas");
    assert.equal(claveNombre("  Estación Cisneros "), "estacion cisneros");
  });
});
