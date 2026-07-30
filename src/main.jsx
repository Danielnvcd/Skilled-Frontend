import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import AccessGate from './components/AccessGate'  // candado temporal de pruebas (ver el archivo para quitarlo)
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
      <BrowserRouter>
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
