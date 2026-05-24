import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Source maps OFF en prod: Vite por defecto NO los genera (sourcemap: false),
    // pero lo dejamos explícito por si algún paquete los activa transitivamente.
    // Si en el futuro necesitas debugger en prod, usa 'hidden' que sube los maps
    // a una ruta separada sin exponerlos públicamente en el bundle.
    sourcemap: false,
    // Minify con esbuild (más rápido que terser, similar resultado).
    minify: 'esbuild',
  },
  esbuild: {
    // Elimina debugger statements y console.log/info/debug del bundle de
    // producción. Mitiga fugas accidentales de tokens / IDs / payloads si
    // algún console.log queda en el código. console.error / console.warn
    // se conservan porque son útiles para reportes de Sentry/LogRocket.
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
})
