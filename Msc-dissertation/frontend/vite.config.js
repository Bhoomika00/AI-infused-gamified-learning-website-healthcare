// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: 'dist',         //Output path
    emptyOutDir: true,
    assetsDir: '.',                  //Prevents nesting another 'assets' folder
  },
  server: {
    port: 3000,
  },
  // 👇 THIS is the key part
  base: '/',
  // 👇 This tells Vite to fallback to index.html for React Router
  preview: {
    open: true,
  },
  // 👇 Add this for correct behavior when using Flask
  appType: 'spa'

})

