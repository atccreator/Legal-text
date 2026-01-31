import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.join(__dirname, 'app/renderer'),
  base: './',
  publicDir: path.join(__dirname, 'app/renderer/public'),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  // Force development mode to see full React error messages
  mode: 'development',
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // Disable minification to see readable stack traces
    minify: false,
    sourcemap: true,
  }
})