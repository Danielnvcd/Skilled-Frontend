import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // TEMPORAL — sello del build para verificar que los clientes reciben la
  // versión nueva tras un deploy (ver el badge en PortadaAlmacenes.jsx).
  // Para quitarlo: borrar este `define` y el badge que lo usa.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'logo.png', 'icons/*.png'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // El backend vive en otro origen (app.skilledmx.cloud), así que /api/*
        // NUNCA se sirve desde este host. No interceptar requests /api/* en el
        // SW evita problemas de CORS con responses cacheadas cross-origin.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Sin runtimeCaching: el SW solo precachea los assets estáticos del
        // build y sirve el fallback de navegación para rutas SPA. Las requests
        // cross-origin (API y fonts) las maneja el browser sin intervención
        // del SW — evita el bug donde al cambiar de pestaña el SW servía
        // responses cacheadas opacas que fallan el CORS check.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Nota: NO proxiamos /socket.io. El proxy WS de Vite v8 está bugueado
      // (chunks `ECONNABORTED` en cada handshake). En dev local define
      // VITE_API_URL=http://localhost:5000/api en `.env.local` para que el
      // socket vaya directo al backend sin pasar por este proxy.
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
  oxc: {
    // Elimina debugger statements y console.log/info/debug del bundle de
    // producción. Vite v8 reemplazó esbuild por oxc, así que la opción se
    // movió aquí — antes era `esbuild: { drop, pure }`. Mitiga fugas
    // accidentales de tokens / IDs / payloads si algún console.log queda
    // en el código. console.error / console.warn se conservan porque son
    // útiles para reportes de Sentry/LogRocket.
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
})
