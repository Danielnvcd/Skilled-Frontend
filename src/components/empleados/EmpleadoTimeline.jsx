import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock, AlertCircle, FileText, Wallet, ArrowDownToLine,
  ArrowUpToLine, Activity, History, ExternalLink, Calendar,
} from 'lucide-react'
import { Card, Skeleton, EmptyState, Button, Select } from '../ui'
import { obtenerTimeline } from '../../api/trabajadores'
import { useResource } from '../../hooks/useResource'
import { fmtFecha as fmtFechaBase } from '../../utils/format'

const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
})

// Meta por tipo: icono + chip de color. Las clases completas (no string
// interp) para que Tailwind no las purgue.
const TIPO_META = {
  horas: {
    Icon: Clock,
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Horas',
  },
  ausencia: {
    Icon: AlertCircle,
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Ausencia',
  },
  ajuste: {
    Icon: Activity,
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    label: 'Ajuste',
  },
  prestamo_creado: {
    Icon: ArrowDownToLine,
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    label: 'Préstamo',
  },
  abono: {
    Icon: ArrowUpToLine,
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    label: 'Abono',
  },
  documento: {
    Icon: FileText,
    chip: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
    label: 'Documento',
  },
}

const DEFAULT = TIPO_META.documento

const RANGOS = [
  { dias: 30, label: 'Últimos 30 días' },
  { dias: 90, label: 'Últimos 90 días' },
  { dias: 180, label: 'Últimos 6 meses' },
  { dias: 365, label: 'Último año' },
]

// Sin valor se pinta vacío, no un guion: aquí la fecha va dentro de una frase.
const fmtFecha = (iso) => fmtFechaBase(iso, '')

function diasAtrasDesde(iso) {
  try {
    const d = new Date(iso + 'T00:00:00')
    const ahora = new Date()
    ahora.setHours(0, 0, 0, 0)
    return Math.floor((ahora - d) / 86_400_000)
  } catch { return null }
}

export default function EmpleadoTimeline({ trabajadorId }) {
  const [rangoDias, setRangoDias] = useState(90)

  const { desde, hasta } = useMemo(() => {
    const hoy = new Date()
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - rangoDias)
    const iso = (d) => d.toISOString().slice(0, 10)
    return { desde: iso(inicio), hasta: iso(hoy) }
  }, [rangoDias])

  // Realtime: cualquier mutación que pueda generar un evento nuevo del
  // trabajador invalida la caché y refetchea. Cubre los flujos ya con emit:
  // empleados (baja/reactivar), horas (registros), ajustes, préstamos,
  // y bitácora como red de seguridad.
  const { data, loading, error } = useResource(
    ['empleado-timeline', { trabajadorId, rangoDias }],
    () => obtenerTimeline(trabajadorId, { desde, hasta, limit: 200 }),
    {
      staleMs: 30_000,
      invalidateOn: [
        'empleado:changed',
        'ajuste:changed',
        'prestamo:changed',
        'reporte:registros_cambio',
        'documento:changed',
        'abono:new',
      ],
    },
  )

  const eventos = data?.eventos || []

  // Agrupar por fecha (string ISO) para mostrar separadores de día.
  const grupos = useMemo(() => {
    const m = new Map()
    for (const e of eventos) {
      const arr = m.get(e.fecha) || []
      arr.push(e)
      m.set(e.fecha, arr)
    }
    return Array.from(m.entries())  // ya viene desc del backend
  }, [eventos])

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-ink-200 dark:border-ink-800">
        <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200 inline-flex items-center gap-2">
          <History size={14} className="text-brand-600" />
          Actividad reciente
          {!loading && data && (
            <span className="text-[11px] font-normal text-ink-500 dark:text-ink-400">
              ({data.total || 0} evento{(data.total || 0) === 1 ? '' : 's'})
            </span>
          )}
        </h3>
        <Select
          value={rangoDias}
          onChange={(e) => setRangoDias(Number(e.target.value))}
          className="text-xs h-8 w-auto min-w-[180px]"
          wrapperClassName="flex-shrink-0"
        >
          {RANGOS.map((r) => (
            <option key={r.dias} value={r.dias}>{r.label}</option>
          ))}
        </Select>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400 inline-flex items-center gap-2">
          <AlertCircle size={14} /> No se pudo cargar la actividad.
        </p>
      ) : grupos.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Sin actividad en este rango"
          description="No hay eventos registrados para el periodo seleccionado."
        />
      ) : (
        <ol className="relative space-y-3">
          {grupos.map(([fecha, items]) => {
            const dias = diasAtrasDesde(fecha)
            const label = dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : fmtFecha(fecha)
            return (
              <li key={fecha}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                    {label}
                  </span>
                  {dias !== null && dias > 1 && (
                    <span className="text-[10px] text-ink-400">· hace {dias} días</span>
                  )}
                  <div className="flex-1 h-px bg-ink-200 dark:bg-ink-800" />
                </div>
                <ul className="space-y-1.5 ml-1">
                  {items.map((evt, idx) => {
                    const meta = TIPO_META[evt.tipo] || DEFAULT
                    const { Icon } = meta
                    const content = (
                      <div className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md ${evt.url ? 'hover:bg-ink-50 dark:hover:bg-ink-800/40 cursor-pointer' : ''} transition-colors`}>
                        <span className={`flex-shrink-0 inline-flex h-7 w-7 rounded-md items-center justify-center ${meta.chip}`}>
                          <Icon size={13} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                              {evt.titulo}
                            </span>
                            {evt.horas != null && (
                              <span className="text-[11px] font-mono text-ink-500">{evt.horas.toFixed(2)}h</span>
                            )}
                            {evt.monto != null && (
                              <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                                {mxn.format(evt.monto)}
                              </span>
                            )}
                          </div>
                          {evt.subtitle && (
                            <div className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{evt.subtitle}</div>
                          )}
                        </div>
                        {evt.url && <ExternalLink size={11} className="text-ink-400 flex-shrink-0 mt-1" />}
                      </div>
                    )
                    return (
                      <li key={`${fecha}-${idx}`}>
                        {evt.url ? <Link to={evt.url}>{content}</Link> : content}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
