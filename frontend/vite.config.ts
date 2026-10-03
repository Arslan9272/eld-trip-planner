import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl is a single ~1 MB chunk by itself; it is already split from the app code.
  build: { chunkSizeWarningLimit: 1100 },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
