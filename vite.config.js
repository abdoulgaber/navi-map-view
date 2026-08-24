import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is needed for GitHub Pages (repo sub-path); keep dev at '/'
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/navi-map-view/' : '/',
  optimizeDeps: {
    // maplibre-gl ships its own web worker; pre-bundling breaks the worker URL
    exclude: ['maplibre-gl'],
  },
}))
