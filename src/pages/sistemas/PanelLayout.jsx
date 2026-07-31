/**
 * Piezas compartidas por las vistas del panel de sistemas.
 *
 * El panel exige 2FA en el backend: si la cuenta no lo tiene, TODOS sus
 * endpoints devuelven 403 con `requiere_2fa: true`. En vez de dejar la pantalla
 * en un error seco, `Aviso2FA` explica qué falta y manda a activarlo.
 */
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui'
import { esFalta2fa } from '../../api/sistemas'

export function Aviso2FA() {
  const navigate = useNavigate()
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              Este panel requiere autenticación de dos factores
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300/90">
              El rol de sistemas puede crear cuentas y cerrar sesiones de otros
              usuarios. Por eso una contraseña no basta para entrar aquí: hace
              falta un segundo factor. Actívalo en tu perfil y vuelve.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/perfil')}>
            Activar 2FA en Mi perfil
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Envuelve el contenido: muestra el aviso de 2FA o el error real. */
export function EstadoCarga({ error, loading, children, skeleton = null }) {
  if (esFalta2fa(error)) return <Aviso2FA />
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900/50 dark:bg-red-900/20">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <span className="text-red-800 dark:text-red-300">
          {error?.response?.data?.error || error?.message || 'No se pudo cargar la información.'}
        </span>
      </div>
    )
  }
  if (loading) return skeleton
  return children
}

/** Semáforo de un componente de infraestructura. */
export function Indicador({ ok, titulo, detalle }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900">
      <span
        className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
          ok ? 'bg-emerald-500' : 'bg-red-500'
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{titulo}</p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
          {ok ? detalle : detalle || 'sin respuesta'}
        </p>
      </div>
    </div>
  )
}

export function fmtFechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function fmtDuracion(segundos) {
  if (!segundos && segundos !== 0) return '—'
  const d = Math.floor(segundos / 86400)
  const h = Math.floor((segundos % 86400) / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  return `${m} min`
}
