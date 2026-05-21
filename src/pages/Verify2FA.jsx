import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { extractApiError } from '../utils/apiError'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui'

export default function Verify2FA() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { verify2fa } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const stepToken = location.state?.stepToken
  const from = location.state?.from

  if (!stepToken) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await verify2fa(stepToken, code)
      const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
      navigate(safeFrom)
      toast.success('Verificación exitosa')
    } catch (err) {
      const msg = extractApiError(err, 'Código incorrecto')
      toast.error(msg)
      if (err.response?.status === 401 && /expirada|expired|inv[áa]lid/i.test(msg)) {
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
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 mb-6 focus-ring rounded"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-card dark:shadow-none p-8">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Verificación en dos pasos</span>
          </div>
          <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-100">Confirma tu identidad</h1>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            Ingresa el código de seis dígitos generado por tu aplicación autenticadora.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-2 tracking-wide">
                Código de verificación
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                required
                className="block w-full px-4 py-3 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 rounded-md text-center text-2xl font-semibold tracking-[0.5em] text-ink-900 dark:text-ink-100 placeholder:text-ink-300 dark:placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-colors"
              />
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Verificar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
