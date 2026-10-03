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
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
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
        sheen: { "0%": { transform: "translateX(-120%)" }, "55%,100%": { transform: "translateX(220%)" } },
        flash: { "0%": { opacity: "0" }, "18%": { opacity: "1" }, "100%": { opacity: "0" } },
        scan: { "0%": { top: "0%", opacity: "0" }, "10%": { opacity: "1" }, "100%": { top: "100%", opacity: "0" } },
        burst: {
          "0%": { transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1) rotate(260deg)", opacity: "0" },
        },
      },
      animation: {
        "seal-ring": "seal-ring 1.8s ease-out 2",
        draw: "draw 0.6s ease-out 0.4s both",
        arm: "arm 0.5s ease-out both",
        "spin-slow": "spin-slow 28s linear infinite",
        sheen: "sheen 7s ease-in-out infinite",
        flash: "flash 1.1s ease-out both",
        scan: "scan 1.6s ease-in-out 0.3s both",
        burst: "burst 1.3s cubic-bezier(0.2, 0.8, 0.3, 1) both",
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
