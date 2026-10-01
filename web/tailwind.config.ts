import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          bg: "#0b0b0e",
          surface: "#131318",
          raised: "#1a1a21",
          border: "#232329",
          borderStrong: "#34343d",
          text: "#f5f5f7",
          muted: "#a8a8b3",
          dim: "#6b6b76",
          accent: "#6c63ff",
          accentDim: "#2a2766",
          success: "#34d399",
          successDim: "#163a2c",
          danger: "#f0475c",
          dangerDim: "#4a1620",
          warn: "#e8a23d",
          warnDim: "#4a3815",
        },
      },
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
