import { useState, useEffect, useMemo } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { extractApiError } from '../utils/apiError'
import { safeRedirectPath } from '../utils/safeRedirect'
import { ShieldCheck, ArrowLeft, FileKey2 } from 'lucide-react'
import { Button } from '../components/ui'

// Key de sessionStorage para persistir el estado del flujo de 2FA. Vive solo
// mientras la pestaña esté abierta y se borra al éxito o al volver a Login.
// Permite que el usuario refresque (F5) la pantalla del código sin perder el
// stepToken — el backend tolera 5 minutos.
const SS_KEY = 'pending2fa'

function readPending() {
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Defensivo: si lleva más de 5 min, descartar.
    if (!parsed?.stepToken || !parsed?.ts) return null
    if (Date.now() - parsed.ts > 5 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

function writePending(data) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch {}
}

function clearPending() {
  try { sessionStorage.removeItem(SS_KEY) } catch {}
}

export default function Verify2FA() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  // Modo "código de respaldo": cambia el input a uno alfanumérico que admite
  // el formato XXXX-XXXX-XXXX. El backend acepta el código en el mismo campo;
  // este toggle solo cambia validación + apariencia.
  const [useBackup, setUseBackup] = useState(false)
  const { verify2fa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Prioridad: location.state (camino feliz desde Login). Fallback: sessionStorage
  // (recarga de la pestaña). Si la primera vez venimos por state, lo persistimos.
  const fromState = location.state
  const persisted = useMemo(() => readPending(), [])
  const stepToken = fromState?.stepToken || persisted?.stepToken
  const from = fromState?.from || persisted?.from

  useEffect(() => {
    if (fromState?.stepToken) {
      writePending({
        stepToken: fromState.stepToken,
        from: fromState.from || null,
        username: fromState.username || null,
      })
    }
  }, [fromState])

  if (!stepToken) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Si es backup code, normalizar (upper, sin espacios). El backend
      // re-normaliza antes de hashear; lo hacemos aquí para que el toString
      // sea consistente con lo que vio el usuario en la hoja impresa.
      const codeToSend = useBackup
        ? code.toUpperCase().replace(/\s/g, '').trim()
        : code
      await verify2fa(stepToken, codeToSend)
      clearPending()
      // `from` puede venir del state de navegación o de sessionStorage; en
      // ambos casos su origen último es el `?from=` de la URL de login, que
      // controla el atacante. Se sanea otra vez aquí (ver safeRedirect.js).
      navigate(safeRedirectPath(from))
      toast.success(useBackup ? 'Acceso con código de respaldo' : 'Verificación exitosa')
    } catch (err) {
      const msg = extractApiError(err, useBackup ? 'Código de respaldo inválido' : 'Código incorrecto')
      toast.error(msg)
      if (err.response?.status === 401 && /expirada|expired|inv[áa]lid/i.test(msg)) {
        clearPending()
        setTimeout(() => navigate('/login'), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950 p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => { clearPending(); navigate('/login') }}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 mb-6 focus-ring rounded"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-card dark:shadow-none p-8">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400">
            {useBackup ? <FileKey2 size={16} /> : <ShieldCheck size={16} />}
            <span className="text-xs font-medium uppercase tracking-wider">
              {useBackup ? 'Código de respaldo' : 'Verificación en dos pasos'}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-100">Confirma tu identidad</h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            {useBackup
              ? 'Ingresa uno de los códigos que guardaste al activar 2FA. Cada código solo funciona una vez.'
              : 'Ingresa el código de seis dígitos generado por tu aplicación autenticadora.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                {useBackup ? 'Código de respaldo' : 'Código de verificación'}
              </label>
              {useBackup ? (
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 14))}
                  placeholder="XXXX-XXXX-XXXX"
                  maxLength={14}
                  required
                  autoFocus
                  className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-xl font-mono font-semibold tracking-[0.2em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
                />
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
                />
              )}
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Verificar
            </Button>
            <button
              type="button"
              onClick={() => { setCode(''); setUseBackup((v) => !v) }}
              className="block mx-auto text-xs text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 underline-offset-2 hover:underline focus-ring rounded"
            >
              {useBackup
                ? 'Usar código del autenticador'
                : '¿Perdiste el dispositivo? Usa un código de respaldo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
