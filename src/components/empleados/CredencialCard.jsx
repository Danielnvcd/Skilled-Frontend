import { Badge } from '../ui'

// Credencial con look de "membership card" profesional. Reutilizable entre
// la ficha del empleado y la ficha-modal del módulo /credenciales.
//
// Props:
//   credencial   { planta, credencial_id, fecha_caducidad }
//   noEmpleado   string opcional — se muestra en el footer

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return iso }
}

export default function CredencialCard({ credencial, noEmpleado }) {
  const c = credencial
  const today = new Date().toISOString().slice(0, 10)
  const vencida = c.fecha_caducidad && c.fecha_caducidad < today

  let daysDiff = null
  if (c.fecha_caducidad) {
    try {
      const cad = new Date(c.fecha_caducidad + 'T00:00:00')
      daysDiff = Math.ceil((cad - new Date()) / 86400000)
    } catch {}
  }

  let estado
  if (!c.fecha_caducidad) estado = 'sin-fecha'
  else if (vencida) estado = 'vencida'
  else if (daysDiff !== null && daysDiff <= 30) estado = 'por-vencer'
  else estado = 'vigente'

  const styles = {
    'sin-fecha': {
      stripe: 'from-ink-300 to-ink-500 dark:from-ink-600 dark:to-ink-700',
      ring: 'ring-ink-200 dark:ring-ink-700',
      badgeTone: 'neutral',
      badgeText: 'Sin fecha',
      iconBg: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    },
    vigente: {
      stripe: 'from-emerald-400 to-emerald-600',
      ring: 'ring-emerald-200 dark:ring-emerald-800/70',
      badgeTone: 'success',
      badgeText: 'Vigente',
      iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    },
    'por-vencer': {
      stripe: 'from-amber-400 to-amber-600',
      ring: 'ring-amber-200 dark:ring-amber-800/70',
      badgeTone: 'warning',
      badgeText: `Vence en ${daysDiff} d${daysDiff === 1 ? 'ía' : 'ías'}`,
      iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    },
    vencida: {
      stripe: 'from-red-400 to-red-600',
      ring: 'ring-red-200 dark:ring-red-800/70',
      badgeTone: 'danger',
      badgeText: `Vencida hace ${Math.abs(daysDiff)} d${Math.abs(daysDiff) === 1 ? 'ía' : 'ías'}`,
      iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    },
  }[estado]

  const idFormatted = (c.credencial_id || '')
    .toString()
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
  const planta = c.planta || 'Planta'
  const inicial = planta.trim().charAt(0).toUpperCase() || 'P'

  return (
    <div
      className={`group relative rounded-xl overflow-hidden ring-1 ${styles.ring} bg-white dark:bg-ink-900 shadow-sm hover:shadow-md transition-all`}
    >
      <div className={`h-1.5 bg-gradient-to-r ${styles.stripe}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${styles.iconBg}`}>
              {inicial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">
                Planta
              </p>
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate" title={planta}>
                {planta}
              </p>
            </div>
          </div>
          <Badge tone={styles.badgeTone} dot>{styles.badgeText}</Badge>
        </div>

        <div className="px-3 py-3 rounded-lg bg-gradient-to-br from-ink-50 to-ink-100 dark:from-ink-800 dark:to-ink-800/50 mb-3 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 8px)',
            }}
          />
          <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-1">
            ID Credencial
          </p>
          <p className="relative font-mono text-base font-semibold tracking-wider text-ink-900 dark:text-ink-100 break-all leading-tight">
            {idFormatted || <span className="italic text-ink-400">—</span>}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-0.5">
              Caducidad
            </p>
            <p className="text-ink-800 dark:text-ink-200 tabular-nums">
              {c.fecha_caducidad ? fmtFecha(c.fecha_caducidad) : '—'}
            </p>
          </div>
          {noEmpleado && (
            <div className="text-right min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-0.5">
                No. Empleado
              </p>
              <p className="font-mono text-ink-800 dark:text-ink-200">{noEmpleado}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
