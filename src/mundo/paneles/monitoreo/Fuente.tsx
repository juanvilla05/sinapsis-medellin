import { fechaHoraColombia } from "./formato";

/**
 * Pie de fuente obligatorio en toda tarjeta de datos: nombre, licencia (o "no declarada") y fecha de corte.
 * `lectura` es el ISO de la última actualización del dato; `consultado`, el de la consulta.
 */
export default function Fuente({
  nombre,
  licencia = "no declarada",
  lectura,
  consultado,
  enlace,
  nota,
}: {
  nombre: string;
  licencia?: string;
  lectura?: string | null;
  consultado?: string | null;
  enlace?: string;
  nota?: string;
}) {
  return (
    <p className="m-0 font-mono text-[11.5px] leading-relaxed text-[#475569]">
      Fuente:{" "}
      {enlace ? (
        <a href={enlace} target="_blank" rel="noreferrer" className="underline decoration-[#C9D6E8] underline-offset-2 hover:text-[#2563EB]">
          {nombre}
        </a>
      ) : (
        nombre
      )}
      {" · "}Licencia: {licencia}
      {" · "}Fecha de corte: {lectura ? fechaHoraColombia(lectura) : "sin dato"}
      {consultado ? ` · Consultado: ${fechaHoraColombia(consultado)}` : ""}
      {nota ? ` · ${nota}` : ""}
    </p>
  );
}
