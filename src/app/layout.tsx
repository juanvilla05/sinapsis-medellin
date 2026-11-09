import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import Encabezado from "@/components/Encabezado";
import { MARCA } from "@/lib/marca";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${MARCA.nombre} · ${MARCA.subtitulo}`, template: `%s · ${MARCA.nombre}` },
  description:
    "Agentes que auditan, limpian y explican en vivo los datos abiertos de MEData para la ciudad de Medellín.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Encabezado />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/50">
          <p>
            {MARCA.nombre} · {MARCA.evento} · {MARCA.institucion} · {MARCA.equipo.join(" y ")}
          </p>
          <p className="mt-1">{MARCA.aviso}</p>
          <p className="mt-1">
            Datos:{" "}
            <a className="underline hover:text-white" href="https://medata.app.medellin.gov.co/" target="_blank" rel="noreferrer">
              MEData, Alcaldía de Medellín
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
