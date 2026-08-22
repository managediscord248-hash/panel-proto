/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        az: {
          50: "var(--az-50, #f0f7ff)",
          100: "var(--az-100, #dbecff)",
          200: "var(--az-200, #bfdeff)",
          300: "var(--az-300, #93caff)",
          400: "var(--az-400, #60a8fa)",
          500: "var(--az-500, #3b82f6)",
          600: "var(--az-600, #2570e9)",
          700: "var(--az-700, #1d5bd1)",
          800: "var(--az-800, #1e4b9c)",
          900: "var(--az-900, #1e4080)",
          950: "var(--az-950, #172554)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
