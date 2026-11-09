/** Permite importar la captura GeoJSON como módulo JSON (`with { type: "json" }`). */
declare module "*.geojson" {
  const contenido: unknown;
  export default contenido;
}
