import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CamaraPulso } from "../pulso/tipos";
import { buscarCamara } from "./camaras-buscar";
import copia from "./fixtures/camaras.json";

const camaras = copia.camaras as CamaraPulso[];
const nombre = (texto: string) => buscarCamara(camaras, texto).camara?.nombre ?? null;

describe("buscar una cámara por nombre o dirección", () => {
  it("nombre exacto, sin importar tildes ni mayúsculas", () => {
    assert.equal(nombre("Puente Guayaquil"), "Puente Guayaquil");
    assert.equal(nombre("puente de guayaquil"), "Puente Guayaquil");
    assert.equal(nombre("TUNEL DE OCCIDENTE"), "Túnel de Occidente");
    assert.equal(nombre("la cámara de la Terminal del Norte"), "Terminal del Norte");
  });
  it("entre varias que contienen lo pedido gana la más corta", () => {
    assert.equal(nombre("Aguacatala"), "Aguacatala");
    assert.equal(nombre("virgen de la aguacatala"), "Virgen Aguacatala");
    assert.equal(nombre("La Iguaná"), "La Iguaná");
  });
  it("parte del nombre", () => {
    assert.equal(nombre("Guayaquil"), "Puente Guayaquil");
    assert.equal(nombre("unicentro"), "Éxito Unicentro");
    assert.equal(nombre("el zoológico"), "Zoológico");
  });
  it("dirección, dicha completa o abreviada", () => {
    assert.equal(nombre("carrera 83C con calle 33"), "El Castillo");
    assert.equal(nombre("Cr 89 Cl 44"), "Everest");
  });
  it("sin coincidencia clara no elige ninguna", () => {
    assert.equal(nombre("Torre Eiffel"), null);
    assert.equal(nombre("la"), null);
    assert.equal(nombre(""), null);
    // un número suelto de dirección no basta
    assert.equal(nombre("carrera 999"), null);
  });
  it("propone parecidas cuando solo acierta una parte", () => {
    const r = buscarCamara(camaras, "puente de la avenida oriental con ayacucho y el palo");
    assert.equal(r.camara, null);
    assert.ok(r.parecidas.length > 0 && r.parecidas.length <= 3);
  });
});
