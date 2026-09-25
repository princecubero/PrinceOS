const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' }
  },
  build: {
    outDir: process.env.VERCEL ? 'public' : 'dist',
    emptyOutDir: process.env.VERCEL ? false : true
  }
});
