/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#1a56db',
        'accent-light': '#eff4ff',
        'text-primary': '#111928',
        'text-secondary': '#6b7280',
        good: '#059669',
        warn: '#d97706',
        danger: '#dc2626',
        surface: '#ffffff',
        bg: '#f9fafb',
      }
    },
  },
  plugins: [],
}
