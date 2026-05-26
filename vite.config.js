import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/productos'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-productos',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/almacenes')
              || url.pathname.startsWith('/api/v1/categorias')
              || url.pathname.startsWith('/api/v1/estantes'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-catalogos',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com'
              || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
