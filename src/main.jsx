import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import AccessGate from './components/AccessGate'  // candado temporal de pruebas (ver el archivo para quitarlo)
import { initServiceWorkerUpdates } from './utils/swUpdate'
import App from './App'
import './index.css'

function AppToaster() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          boxShadow: isDark
            ? '0 4px 16px -2px rgba(0,0,0,0.5), 0 2px 6px -1px rgba(0,0,0,0.3)'
            : '0 4px 16px -2px rgba(15,23,42,0.08), 0 2px 6px -1px rgba(15,23,42,0.04)',
          fontSize: '13px',
          padding: '10px 14px',
          borderRadius: '8px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: isDark ? '#0f172a' : '#ecfdf5' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: isDark ? '#0f172a' : '#fef2f2' } },
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AccessGate>
      {/* Future flags de react-router 6.x: adoptan hoy el comportamiento que
          será el de v7, y de paso callan los avisos de consola en desarrollo.
            · v7_startTransition — envuelve las navegaciones en
              `React.startTransition`. Con las páginas en `lazy` (ver App.jsx),
              al cambiar de pantalla se mantiene la actual hasta que el chunk
              está listo, en vez de parpadear al fallback de Suspense.
            · v7_relativeSplatPath — cambia la resolución de rutas relativas
              dentro de rutas splat. Hoy no hay ninguna en la app, así que no
              altera nada; se activa para que añadir una más adelante no traiga
              la semántica vieja de rebote.
          Seguimos en la línea 6.x a propósito: v7 es un major y sus dos CVEs no
          nos aplican (ver `src/utils/safeRedirect.js`). */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <App />
              <AppToaster />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AccessGate>
  </React.StrictMode>,
)

// Avisa con un toast cuando hay un deploy nuevo, para las pestañas que quedan
// abiertas sin recargar. Va después del render: el Toaster ya está montado
// cuando esto pueda disparar.
initServiceWorkerUpdates()
