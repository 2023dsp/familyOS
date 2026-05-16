import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-4": "var(--ink-4)",
        terracotta: "var(--terracotta)",
        "terracotta-soft": "var(--terracotta-soft)",
        "terracotta-deep": "var(--terracotta-deep)",
        olive: "var(--olive)",
        "olive-soft": "var(--olive-soft)",
        sand: "var(--sand)",
        "sand-soft": "var(--sand-soft)",
        blue: "var(--blue)",
        "blue-soft": "var(--blue-soft)",
        rose: "var(--rose)",
        "rose-soft": "var(--rose-soft)",
        davide: "var(--davide)",
        "davide-soft": "var(--davide-soft)",
        luize: "var(--luize)",
        "luize-soft": "var(--luize-soft)",
        success: "var(--success)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        line: "var(--line)",
        "line-2": "var(--line-2)"
      },
      borderRadius: {
        xs: "8px",
        sm: "12px",
        md: "18px",
        lg: "24px",
        xl: "32px",
        "2xl": "40px"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(80, 60, 40, 0.06)",
        card: "0 2px 12px rgba(80, 60, 40, 0.07), 0 1px 2px rgba(80, 60, 40, 0.04)",
        lg: "0 12px 36px rgba(80, 60, 40, 0.12), 0 4px 10px rgba(80, 60, 40, 0.05)"
      }
    }
  },
  plugins: []
};
export default config;
