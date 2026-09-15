import type { Config } from "tailwindcss";

/**
 * Paleta cálida y oscura, a tono con una cocina de brasa. Ningún valor es
 * negro puro ni blanco puro: el contraste absoluto es justo lo que hace que
 * una interfaz se lea como app genérica en vez de como una carta.
 */

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12100e", // fondo
        charcoal: "#1a1714", // superficie elevada
        ember: "#241f1a", // superficie sobre superficie
        gold: {
          DEFAULT: "#c9a15a",
          light: "#e2c68c",
          dark: "#9c7a3f",
        },
        cream: "#f4efe4",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        seccion: "0.18em",
      },
      boxShadow: {
        premium: "0 24px 70px -24px rgba(0,0,0,0.65)",
      },
    },
  },
  plugins: [],
};
export default config;
