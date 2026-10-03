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
          cta: "#ff6b2c",
          ctaHover: "#ff8247",
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
      keyframes: {
        "seal-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        draw: { "0%": { strokeDashoffset: "30" }, "100%": { strokeDashoffset: "0" } },
        arm: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "seal-ring": "seal-ring 1.8s ease-out 2",
        draw: "draw 0.6s ease-out 0.4s both",
        arm: "arm 0.5s ease-out both",
        "spin-slow": "spin-slow 28s linear infinite",
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
