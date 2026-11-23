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
        ivory: "#F6F7F5",
        ink: "#17211E",
        sage: {
          DEFAULT: "#2B6B59",
          soft: "#E9F3EF",
          dark: "#1E5143",
        },
        ochre: {
          DEFAULT: "#B97335",
          soft: "#FBF1E6",
        },
      },
    },
  },
  plugins: [],
};

export default config;