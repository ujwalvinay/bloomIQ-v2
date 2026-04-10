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
        cream: "#F9F8F3",
        olive: {
          DEFAULT: "#6B7A63",
          dark: "#4a5544",
        },
        ink: "#1a1a1a",
        muted: "#6b6b6b",
        input: "#E8E6E0",
        "input-deep": "#E5E4DE",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 25px 50px -12px rgba(0, 0, 0, 0.12)",
        soft: "0 8px 30px rgba(107, 122, 99, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
