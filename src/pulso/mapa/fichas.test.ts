import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jsonHurto from "@/lib/monitoreo/datos/hurto-comuna.json";
import jsonIncidentes from "@/lib/monitoreo/datos/incidentes-comuna.json";
import jsonVictimas from "@/lib/monitoreo/datos/victimas-comuna.json";
import { hurtoComuna, incidentesComuna, victimasComuna } from "@/lib/monitoreo/esquemas";
import { resumirTablas, textoSuma } from "./fichas";

describe("fichas por comuna", () => {
  const r = resumirTablas({ ok: true, incidentes: incidentesComuna.parse(jsonIncidentes), victimas: victimasComuna.parse(jsonVictimas), hurto: hurtoComuna.parse(jsonHurto) });

  it("resume las tres tablas con las 21 comunas y corregimientos como máximo", () => {
    for (const capa of ["incidentes", "victimas", "hurto"] as const) {
      const d = r[capa];
      assert.ok(d, capa);
      assert.ok(d.porComuna.size >= 16 && d.porComuna.size <= 21);
      const suma = [...d.porComuna.values()].reduce((s, c) => s + c.total.n, 0);
      assert.equal(suma, d.total);
      const pct = [...d.porComuna.values()].reduce((s, c) => s + c.pct, 0);
      assert.ok(Math.abs(pct - 100) < 1e-6);
    }
  });

  it("el total de una comuna coincide con la suma de sus años y la rampa va de 0 a 1", () => {
    const d = r.incidentes!;
    for (const c of d.porComuna.values()) {
      assert.equal(c.porAnio.reduce((s, a) => s + a.n, 0), c.total.n);
      assert.ok(c.t >= 0 && c.t <= 1);
      assert.equal(c.porAnio.length, d.anios.length);
    }
    assert.equal(Math.max(...[...d.porComuna.values()].map((c) => c.t)), 1);
  });

  it("nunca publica un conteo entre 1 y 4 y marca lo suprimido", () => {
    for (const capa of ["incidentes", "victimas", "hurto"] as const) {
      for (const c of r[capa]!.porComuna.values()) {
        for (const x of [...c.porAnio, ...c.desglose]) assert.ok(x.n === 0 || x.n >= 5, `${capa} ${c.codigo} ${x.n}`);
      }
    }
    assert.equal(textoSuma({ n: 0, incompleto: true }), "menos de 5");
    assert.equal(textoSuma({ n: 1234, incompleto: true }), "1.234 o más");
    assert.equal(textoSuma({ n: 1234, incompleto: false }), "1.234");
  });

  it("sin tablas no inventa nada", () => {
    assert.deepEqual(resumirTablas(null), { incidentes: null, victimas: null, hurto: null });
  });
});
