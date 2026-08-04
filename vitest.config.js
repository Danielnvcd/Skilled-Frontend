import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config de tests separada de `vite.config.js` a propósito: aquí NO queremos el
// plugin de PWA (generaría un service worker en cada corrida) ni el proxy de
// desarrollo. Solo React + jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    // Huso fijo: los helpers de fecha dependen de él y sin fijarlo un test que
    // pasa en una laptop en México fallaría en el runner de CI (UTC).
    env: { TZ: 'America/Mexico_City' },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**'],
    },
  },
})
