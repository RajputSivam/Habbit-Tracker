/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        grove: {
          50: "#f0f7f2",
          100: "#dceee1",
          500: "#39845a",
          600: "#2c6e49",
          700: "#24583c",
          900: "#173b2a",
        },
      },
      boxShadow: {
        soft: "0 16px 40px -24px rgba(20, 54, 37, 0.22)",
      },
    },
  },
  plugins: [],
};
