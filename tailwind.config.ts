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
        background: "#FAFAF8",
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "var(--surface-muted)",
          elevated: "var(--surface-elevated)",
        },
        charcoal: {
          DEFAULT: "#1A1A1A",
          surface: "#222222",
          border: "#2E2E2E",
          hover: "#282828",
        },
        emerald: {
          DEFAULT: "#0B5D45",
          hover: "#084936",
          light: "#EDF5F2",
        },
        primary: {
          DEFAULT: "#171717",
          secondary: "#6B6B67",
          muted: "#8B8B86",
        },
        border: {
          DEFAULT: "#E7E5E0",
          subtle: "#F0EFEA",
        },
        accent: {
          DEFAULT: "#0B5D45",
          hover: "#084936",
          light: "#EDF5F2",
          surface: "#F4F7F5",
        },
        status: {
          success: {
            bg: "var(--status-success-bg)",
            text: "var(--status-success-text)",
            border: "var(--status-success-border)",
          },
          warning: {
            bg: "var(--status-warning-bg)",
            text: "var(--status-warning-text)",
            border: "var(--status-warning-border)",
          },
          info: {
            bg: "var(--status-info-bg)",
            text: "var(--status-info-text)",
            border: "var(--status-info-border)",
          },
          critical: {
            bg: "var(--status-critical-bg)",
            text: "var(--status-critical-text)",
            border: "var(--status-critical-border)",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "112": "28rem",
        "128": "32rem",
      },
      borderRadius: {
        subtle: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
