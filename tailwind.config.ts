import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep forest green — primary brand color.
        forest: {
          50: "#EEF3EF",
          100: "#D6E2D9",
          200: "#AFC5B5",
          300: "#84A68D",
          400: "#5C8768",
          500: "#3E6B4B",
          600: "#2E5539",
          700: "#23422C",
          800: "#183020",
          900: "#0F2117",
          950: "#0A1810",
        },
        // Muted, warm gold — accent only, used sparingly.
        gold: {
          50: "#FBF6EB",
          100: "#F4E7C9",
          200: "#E8D19D",
          300: "#DAB86D",
          400: "#C9A24E",
          500: "#B08B3D",
          600: "#8F6F30",
          700: "#6E5526",
          800: "#4E3C1B",
        },
        // Warm off-white — page background.
        cream: {
          50: "#FDFBF6",
          100: "#F8F3E9",
          200: "#F1E9D8",
          300: "#E7DBBF",
        },
        // Charcoal — primary text color, warm-toned rather than pure black.
        charcoal: {
          DEFAULT: "#292722",
          700: "#3D3A33",
          500: "#615C51",
          // Darkened from #847E70 for accessibility — the original hit
          // only ~3.9:1 against the cream-50 page background, below the
          // WCAG AA 4.5:1 minimum for normal-size text, and this color
          // is used everywhere as secondary/hint/timestamp text at
          // regular sizes. #767164 keeps the same warm gray-brown hue
          // while reaching ~4.7:1.
          400: "#767164",
        },
      },
      fontFamily: {
        // The wordmark's own display face (src/components/ui/logo.tsx
        // only) — see the next/font/google setup in src/app/layout.tsx.
        // Falls back to the system serif stack below if the variable
        // isn't set for some reason (e.g. an isolated test render).
        wordmark: ["var(--font-wordmark)", "Georgia", "serif"],
        serif: [
          "Iowan Old Style",
          "Palatino Linotype",
          "URW Palladio L",
          "P052",
          "Georgia",
          "serif",
        ],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 33, 23, 0.06), 0 8px 24px -12px rgba(15, 33, 23, 0.18)",
        "card-hover": "0 2px 4px rgba(15, 33, 23, 0.08), 0 16px 32px -12px rgba(15, 33, 23, 0.24)",
      },
      backgroundImage: {
        "contour-lines":
          "repeating-radial-gradient(circle at 20% 20%, transparent 0, transparent 42px, rgba(255,255,255,0.035) 43px, transparent 44px)",
      },
      maxWidth: {
        content: "72rem",
      },
      letterSpacing: {
        tightish: "-0.015em",
      },
    },
  },
  plugins: [],
};

export default config;
