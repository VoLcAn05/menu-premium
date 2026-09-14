import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141110",
        charcoal: "#1c1917",
        gold: {
          DEFAULT: "#c9a15a",
          light: "#e4c98a",
          dark: "#9c7a3f",
        },
        cream: "#f6f1e7",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
      boxShadow: {
        premium: "0 20px 60px -20px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
