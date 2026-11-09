import type { Metadata } from "next";
import PulsoEnVivo from "@/pulso/PulsoEnVivo";

export const metadata: Metadata = {
  title: { absolute: "PULSO · Medellín en vivo · SINAPSIS" },
  description: "Mapa 3D de Medellín con aire de SIATA en vivo, seguridad vial y hurto de MEData por comuna, rutas inteligentes y un asistente que cita sus fuentes.",
};

export default function Inicio() {
  return <PulsoEnVivo />;
}
