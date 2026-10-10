import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#20242C",
        slate: { DEFAULT: "#343A46" },
        steel: "#687386",
        mist: "#E8ECF2",
        canvas: "#F5F7FA",
        primary: { DEFAULT: "#2563EB", foreground: "#FFFFFF" },
        electric: "#3B82F6",
        navy: "#14213D",
        crimson: { DEFAULT: "#DC143C", dark: "#A30F2D" },
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        success: "#15803D",
        warn: "#B45309",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { lg: "12px", xl: "16px", md: "10px" },
      boxShadow: { card: "0 1px 2px rgba(20,33,61,0.05), 0 1px 3px rgba(20,33,61,0.04)", pop: "0 8px 30px rgba(20,33,61,0.14)" },
    },
  },
  plugins: [],
};
export default config;
