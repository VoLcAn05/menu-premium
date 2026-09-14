import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { AIAssistant } from "@/components/AIAssistant";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Menú Premium — Demo",
  description:
    "Software base de menú digital interactivo con QR, vista 3D y comanda en vivo para restaurantes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <AIAssistant />
      </body>
    </html>
  );
}
