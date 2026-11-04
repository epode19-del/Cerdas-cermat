/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: {
          950: "#0e1f18", // papan tulis tergelap — background utama
          900: "#152b21",
          800: "#1d392c",
          700: "#28503c",
        },
        // "brand" tetap dipakai di seluruh komponen lama, sekarang jadi emas trofi
        brand: {
          50: "#fdf6e3",
          400: "#f0c34a",
          500: "#e0a91f", // aksen utama: emas trofi/papan skor
          600: "#b9860f",
          700: "#8f6608",
        },
        buzz: {
          400: "#ef6a5a",
          500: "#d64a37", // merah tombol buzzer
          600: "#b23726",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
