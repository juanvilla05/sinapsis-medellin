import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretar } from "./interprete";

const de = (p: string) => interpretar(p);

describe("intérprete sin IA", () => {
  it("aire", () => {
    assert.deepEqual(de("¿Cómo está el aire en Medellín ahora?"), { herramienta: "consultarAire", args: { ambito: "medellin" } });
    assert.deepEqual(de("cómo está la contaminación en Envigado"), { herramienta: "consultarAire", args: { municipio: "Envigado" } });
  });
  it("rutas", () => {
    assert.deepEqual(de("¿Cuál es la ruta con mejor aire de La Alpujarra al Parque Lleras?"), {
      herramienta: "planearRuta",
      args: { origen: "La Alpujarra, Medellín", destino: "Parque Lleras, Medellín", modo: "DRIVE" },
    });
    assert.equal(de("llévame desde el Estadio hasta Plaza Botero en moto")?.args.modo, "TWO_WHEELER");
    assert.equal(de("quiero ir de Laureles a Envigado caminando")?.args.destino, "Envigado");
  });
  it("hurto y seguridad vial", () => {
    assert.deepEqual(de("hurtos en El Poblado en 2022"), { herramienta: "consultarHurtoComuna", args: { comuna: "El Poblado", anio: 2022 } });
    assert.deepEqual(de("¿Qué comunas tienen más incidentes viales?"), { herramienta: "consultarSeguridadVial", args: { tema: "incidentes" } });
    assert.deepEqual(de("víctimas motociclistas en Castilla"), { herramienta: "consultarSeguridadVial", args: { tema: "victimas", condicion: "motociclista", comuna: "Castilla" } });
    assert.deepEqual(de("¿Cuántas muertes viales hubo en 2023 según MEData y la Policía?"), { herramienta: "consultarSeguridadVial", args: { tema: "muertes-anio", anio: 2023 } });
  });
  it("control de la plataforma", () => {
    assert.deepEqual(de("pon el tema claro"), { herramienta: "controlarApp", args: { accion: "tema", tema: "claro" } });
    assert.deepEqual(de("muéstrame los hurtos en el mapa"), { herramienta: "controlarApp", args: { accion: "capa", capa: "hurto", visible: true } });
    assert.deepEqual(de("oculta la capa de incidentes"), { herramienta: "controlarApp", args: { accion: "capa", capa: "incidentes", visible: false } });
    assert.deepEqual(de("abre el laboratorio"), { herramienta: "controlarApp", args: { accion: "ir-a", seccion: "laboratorio" } });
    assert.deepEqual(de("inicia el recorrido"), { herramienta: "controlarApp", args: { accion: "recorrido", activo: true } });
  });
  it("vistas del mapa", () => {
    assert.deepEqual(de("muéstrame Medellín por comunas"), { herramienta: "controlarApp", args: { accion: "vista", vista: "comunas" } });
    assert.deepEqual(de("quiero ver los hurtos por comunas, sin tantas barras"), { herramienta: "controlarApp", args: { accion: "vista", vista: "comunas", capa: "hurto" } });
    assert.deepEqual(de("muéstrame solo Belén"), { herramienta: "controlarApp", args: { accion: "vista", vista: "una-comuna", comuna: "Belén" } });
    assert.deepEqual(de("enfócate en la comuna 14 y muestra las víctimas"), { herramienta: "controlarApp", args: { accion: "vista", vista: "una-comuna", comuna: "14", capa: "victimas" } });
    assert.deepEqual(de("vuelve a mostrar los puntos calientes"), { herramienta: "controlarApp", args: { accion: "vista", vista: "puntos" } });
    // preguntar por un dato "por comuna" sigue siendo una consulta, no un cambio de vista
    assert.equal(de("hurtos por comuna en 2022")?.herramienta, "consultarHurtoComuna");
    assert.equal(de("¿Qué comunas tienen más incidentes viales?")?.herramienta, "consultarSeguridadVial");
  });
  it("catálogo, ayuda y desconocido", () => {
    assert.deepEqual(de("¿Qué secretaría tiene más conjuntos atrasados?"), { herramienta: "consultarFrescura", args: { limite: 5 } });
    assert.deepEqual(de("¿Cuántos conjuntos de Movilidad están al día?"), { herramienta: "consultarFrescura", args: { secretaria: "Movilidad" } });
    assert.equal(de("hola, ¿qué puedes hacer?")?.herramienta, "explicarFuentes");
    assert.equal(de("xyz qwerty"), null);
  });
});
