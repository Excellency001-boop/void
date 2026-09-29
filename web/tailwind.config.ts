import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          bg: "#08080a",
          surface: "#111114",
          raised: "#17171b",
          border: "#26262c",
          borderStrong: "#38383f",
          text: "#e4e4e7",
          muted: "#8b8b93",
          dim: "#57575f",
          accent: "#3ecf8e",
          accentDim: "#1f5c41",
          danger: "#f2495c",
          dangerDim: "#5c2028",
          warn: "#e8b339",
          warnDim: "#584821",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
