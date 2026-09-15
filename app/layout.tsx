import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

/**
 * Dos fuentes, no más: una serif de alto contraste para los nombres de plato
 * y una sans neutra para todo lo demás. Es el patrón que usan los menús de
 * alta cocina, y Cormorant Garamond es prácticamente el estándar del sector.
 */

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fogón Barinés — Carta",
  description:
    "Carta digital con vista 3D, prueba en tu mesa con realidad aumentada y pedido directo a cocina.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
