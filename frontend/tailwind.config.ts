import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        fintech: {
          dark: "#0a0d14",
          card: "#111726",
          border: "#1e293b",
          accent: "#2563eb",
          emerald: "#10b981",
          rose: "#f43f5e",
          amber: "#f59e0b",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
