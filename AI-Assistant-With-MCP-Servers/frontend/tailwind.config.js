/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Linear-minimal dark — cool-neutral near-black, bright ink, orange accent used sparingly
        bg: {
          DEFAULT: "#0A0B0D",
          elev:    "#111214",
          raised:  "#18191C",
          hover:   "#212327",
        },
        ink: {
          DEFAULT: "#E6E7EA",
          strong:  "#FFFFFF",
          muted:   "#9AA0A6",
          subtle:  "#6B7178",
          faint:   "#3E4248",
        },
        line: {
          DEFAULT: "#1E2024",
          strong:  "#292B30",
        },
        accent: {
          DEFAULT: "#E27644",
          hover:   "#F08A55",
          soft:    "#241510",
          ink:     "#F5B788",
        },
        success: { DEFAULT: "#88B04B", soft: "#121A0E" },
        warning: { DEFAULT: "#D2A14E", soft: "#1F170A" },
        danger:  { DEFAULT: "#D85E45", soft: "#1F120E" },
      },
      fontFamily: {
        sans:    ["'General Sans'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'General Sans'", "Georgia", "ui-serif", "serif"],
        mono:    ["'JetBrains Mono'", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        widelabel: "0.12em",
      },
      boxShadow: {
        card:   "0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.6)",
        canvas: "0 24px 60px -32px rgba(0,0,0,0.7), 0 2px 0 rgba(255,255,255,0.03) inset",
        focus:  "0 0 0 3px rgba(226, 118, 68, 0.25)",
      },
    },
  },
  plugins: [],
};
