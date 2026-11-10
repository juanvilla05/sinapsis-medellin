/**
 * Pipeline automático de PULSO (Agencia de datos).
 * Descarga MEData, audita y limpia, y escribe los resultados en src/data/.
 * Uso:  npm run pipeline            (todo)
 *       npm run pipeline catalogo   (solo auditoría del catálogo)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditarCatalogo } from "../src/lib/catalogo";

const SALIDA = path.join(process.cwd(), "src", "data");

async function guardar(nombre: string, datos: unknown) {
  await mkdir(SALIDA, { recursive: true });
  const ruta = path.join(SALIDA, nombre);
  await writeFile(ruta, JSON.stringify(datos, null, 0) + "\n", "utf8");
  console.log(`  ✔ ${path.relative(process.cwd(), ruta)}`);
}

async function pasoCatalogo() {
  console.log("▶ Auditando el catálogo completo de MEData…");
  const { conjuntos, resumen } = await auditarCatalogo();
  await guardar("catalogo.json", conjuntos);
  await guardar("resumen-catalogo.json", resumen);
  console.log(
    `  ${resumen.totalConjuntos} conjuntos · ${resumen.evaluables} evaluables · ${resumen.pctAtrasados}% atrasados`,
  );
}

async function main() {
  const solo = process.argv[2];
  const inicio = Date.now();
  if (!solo || solo === "catalogo") await pasoCatalogo();
  console.log(`✅ Pipeline terminado en ${Math.round((Date.now() - inicio) / 1000)} s`);
}

main().catch((e) => {
  console.error("❌ El pipeline falló:", e);
  process.exit(1);
});
