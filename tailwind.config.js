/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        daymark: {
          ink: '#1d2724',
          paper: '#f8faf7',
          green: '#2b6654',
          coral: '#e47d61'
        }
      }
    }
  },
  plugins: []
};
