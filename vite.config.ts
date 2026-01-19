import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.join(__dirname, 'app/renderer'),
  base: './',
  publicDir: path.join(__dirname, 'app/renderer/public'),
  plugins: [react()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  }
})