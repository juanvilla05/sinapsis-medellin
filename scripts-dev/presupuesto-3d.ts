/**
 * Gate de la Medellín 3D de datos: construye en Node (three sin WebGL) las MISMAS geometrías que
 * `src/mundo/paneles/monitoreo/Comunas3D.ts` con el GeoJSON y las rejillas reales del repo, y cuenta
 * llamadas de dibujo (objetos) y triángulos por capa frente al presupuesto (≤ 40 llamadas, ≤ 60 k triángulos).
 * `renderer.info` en el navegador imprime los mismos números al primer render (consola: "[comunas3d]").
 *
 *   npx tsx scripts-dev/presupuesto-3d.ts
 */
import { readFileSync } from "node:fs";
import * as three from "three";
import type { FeatureComuna } from "@/lib/monitoreo/fuentes";
import { geometriaCelda, geometriaComuna, proyectarPoligonos, triangulosDe } from "@/mundo/paneles/monitoreo/Comunas3D";
import { bboxDeGeometrias, crearProyeccion } from "@/mundo/paneles/monitoreo/proyeccion";

const raiz = process.cwd();
const LIMITE_LLAMADAS = 40;
const LIMITE_TRIANGULOS = 60_000;

const geo = JSON.parse(readFileSync(`${raiz}/src/lib/monitoreo/fixtures/comunas.geojson`, "utf8")) as { features: FeatureComuna[] };
const features = geo.features.filter((f) => /^(0[1-9]|1[0-6]|50|60|70|80|90)$/.test(f.properties.codigo));
const proy = crearProyeccion(bboxDeGeometrias(features.map((f) => f.geometry)));
let triComunas = 0;
for (const f of features) triComunas += triangulosDe(geometriaComuna(three, proyectarPoligonos(f, proy)));
const radio = ((0.00225 * 111_320 * proy.escala) / 2) * 0.98;
const triCelda = triangulosDe(geometriaCelda(three, radio));
const triFaro = triangulosDe(new three.SphereGeometry(0.75, 10, 7));
const triSuelo = triangulosDe(new three.PlaneGeometry(1, 1));
const faros = (JSON.parse(readFileSync(`${raiz}/src/lib/fixtures/siata-602.json`, "utf8")) as { feature_vector?: unknown[] }).feature_vector?.length ?? 0;

console.log(`ciudad proyectada: ${proy.ancho.toFixed(1)} × ${proy.alto.toFixed(1)} unidades (1 unidad = ${Math.round(1 / proy.escala)} m)`);
console.log(`comunas: ${features.length} mallas · ${triComunas} triángulos · faros (fixture 602): ${faros}`);
let fuera = false;
for (const capa of ["incidentes", "victimas", "hurto"]) {
  const r = JSON.parse(readFileSync(`${raiz}/src/lib/monitoreo/datos/rejilla-${capa}.json`, "utf8")) as { celdas: unknown[] };
  const n = r.celdas.length;
  const llamadas = 1 /* suelo */ + features.length + 1 /* celdas InstancedMesh */ + 1 /* faros InstancedMesh */;
  const tri = triSuelo + triComunas + n * triCelda + faros * triFaro;
  const ok = llamadas <= LIMITE_LLAMADAS && tri <= LIMITE_TRIANGULOS;
  if (!ok) fuera = true;
  console.log(`capa ${capa}: ${n} celdas × ${triCelda} tri + ${faros} faros × ${triFaro} tri → ${llamadas} llamadas de dibujo · ${tri} triángulos ${ok ? "OK" : "FUERA DE PRESUPUESTO"}`);
}
process.exit(fuera ? 1 : 0);
