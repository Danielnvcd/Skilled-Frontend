/**
 * AccessGate — candado TEMPORAL de acceso durante el periodo de pruebas.
 *
 * Pide un código antes de dejar entrar a la app, aunque el usuario ya tenga
 * sesión iniciada. El objetivo es que nadie toque producción mientras se
 * validan cambios, NO es un control de seguridad: el código viaja en el bundle
 * y cualquiera con las devtools puede saltárselo. La API sigue expuesta igual,
 * protegida por su propio login/JWT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CÓMO SE ACTIVA
 *   En `.env.production` (y en Vercel → Settings → Environment Variables):
 *       VITE_GATE_ENABLED=true
 *       VITE_GATE_CODE=1234
 *
 * CÓMO SE QUITA (de menor a mayor esfuerzo — con la primera basta)
 *   1. Poner `VITE_GATE_ENABLED=false` (o borrar la línea) y redeployar.
 *      Sin la variable el gate no hace nada: renderiza la app tal cual.
 *   2. Para borrarlo del código: eliminar este archivo y las 2 líneas que lo
 *      usan en `src/main.jsx` (el import y el <AccessGate> que envuelve todo).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Va por FUERA de los providers en main.jsx a propósito: así, mientras está
 * bloqueado, no se monta AuthProvider ni SocketProvider y la app no abre
 * sesión ni conecta el WebSocket.
 */
import { useState } from 'react'
import { Lock, AlertCircle } from 'lucide-react'
import { Button, Input } from './ui'

const ENABLED = String(import.meta.env.VITE_GATE_ENABLED || '').toLowerCase() === 'true'
const CODE = String(import.meta.env.VITE_GATE_CODE || '1234')

// Guardamos el código con el que se desbloqueó: si lo cambias en el .env,
// los que ya habían entrado vuelven a quedar fuera sin tener que limpiar nada.
const STORAGE_KEY = 'gate_unlocked_with'

export default function AccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    if (!ENABLED) return true
    try {
      return localStorage.getItem(STORAGE_KEY) === CODE
    } catch {
      return false // modo incógnito / storage bloqueado → pide el código
    }
  })
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  if (unlocked) return children

  const handleSubmit = (e) => {
    e.preventDefault()
    if (value.trim() !== CODE) {
      setError('Código incorrecto.')
      setValue('')
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, CODE)
    } catch {
      // Sin storage igual lo dejamos pasar en esta pestaña.
    }
    setUnlocked(true)
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-ink-950 font-['Inter'] p-6">
      <div className="w-full max-w-sm">
        <img
          src="/logo1.png"
          alt="Skilled"
          className="h-11 max-w-[180px] object-contain mb-9"
          draggable={false}
        />

        <h1 className="text-2xl font-semibold text-ink-100 tracking-tight">
          Acceso restringido
        </h1>
        <p className="mt-1.5 text-sm text-ink-400 leading-relaxed">
          La plataforma está en validación por unos días. Ingresa el código de
          acceso para continuar.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-900/20 px-3.5 py-2.5 text-sm text-red-300 animate-fade-in"
            >
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="gate-code"
              className="text-xs font-semibold text-ink-400 uppercase tracking-wider ml-0.5 block"
            >
              Código de acceso
            </label>
            <Input
              id="gate-code"
              name="gate-code"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError('')
              }}
              leftIcon={<Lock size={16} />}
              placeholder="••••"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
            Entrar
          </Button>
        </form>

        <p className="mt-10 text-center text-xs text-ink-500">
          Si necesitas acceso, contacta al administrador del sistema.
        </p>
      </div>
    </div>
  )
}
