/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        paper: "#F5F5F0",
        yellow: "#FFFF00",
        white: "#FFFFFF",
      },
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        brutal3: "3px 3px 0 #000",
        brutal5: "5px 5px 0 #000",
        brutal8: "8px 8px 0 #000",
      },
      borderRadius: {
        DEFAULT: "0",
        none: "0",
      },
    },
  },
};
