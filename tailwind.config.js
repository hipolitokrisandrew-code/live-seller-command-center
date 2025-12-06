/** @type {import('tailwindcss').Config} */
export default {
  // ⬅ VERY IMPORTANT: tells Tailwind to use the `dark` class, not OS preference
  darkMode: "class",

  // Tell Tailwind where to look for class names
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      // You can extend colors, spacing, etc. here later if needed
    },
  },

  plugins: [],
};
