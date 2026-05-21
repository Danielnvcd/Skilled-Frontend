import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  History, Calendar, X, ShieldAlert, Pencil, Eye, Loader2,
  AlertTriangle, MapPin, User as UserIcon, Globe,
} from 'lucide-react'
import {
  PageHeader, Button, Pagination, EmptyState, Skeleton, Modal,
} from '../components/ui'
import { listarBitacora, detalleLog } from '../api/bitacora'
import { extractApiError } from '../utils/apiError'

const PER_PAGE = 50

function isSuspicious(action) {
  const a = (action || '').toLowerCase()
  return /fallido|elimin[óo]|admin cambi[óo] contrase[ñn]a|bloqueado|denegado/.test(a)
}

function fmtFechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function LogItem({ log, onView }) {
  const sospechoso = isSuspicious(log.action)
  return (
    <li
      className={`relative grid grid-cols-[40px_1fr_auto] gap-3 px-4 py-3 rounded-lg border transition-colors ${
        sospechoso
          ? 'bg-gradient-to-r from-red-50 to-transparent dark:from-red-900/20 dark:to-transparent border-l-4 border-l-red-500 border-red-200 dark:border-red-900/40'
          : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-800/40'
      }`}
    >
      {sospechoso && (
        <span className="absolute -top-2 right-3 text-[9px] bg-red-500 text-white font-bold tracking-wider px-1.5 py-0.5 rounded shadow">
          ALERTA DE SEGURIDAD
        </span>
      )}
      <div className={`h-9 w-9 rounded-full inline-flex items-center justify-center ${
        sospechoso
          ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 animate-pulse'
          : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
      }`}>
        {sospechoso ? <ShieldAlert size={15} /> : <Pencil size={14} />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium break-words ${sospechoso ? 'text-red-800 dark:text-red-200' : 'text-ink-900 dark:text-ink-100'}`}>
          {log.action}
        </p>
        <p className={`text-xs mt-0.5 ${sospechoso ? 'text-red-700/80 dark:text-red-300/80' : 'text-ink-500 dark:text-ink-400'}`}>
          Realizado por <strong>{log.user}</strong>
          {log.ip && <> desde <span className="font-mono">{log.ip}</span></>}
        </p>
      </div>
      <div className="text-right flex flex-col items-end gap-1.5">
        <span className="text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">
          {fmtFechaHora(log.created_at)}
        </span>
        <Button size="sm" variant="ghost" leftIcon={<Eye size={13} />} onClick={() => onView(log.id)}>
          Ver
        </Button>
      </div>
    </li>
  )
}

function DetalleModal({ open, onClose, logId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !logId) return
    setLoading(true)
    setError(false)
    setData(null)
    detalleLog(logId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [open, logId])

  return (
    <Modal open={open} onClose={onClose} title="Detalle de actividad" size="md">
      {loading && (
        <div className="flex flex-col items-center justify-center py-10 text-ink-500 dark:text-ink-400">
          <Loader2 size={28} className="animate-spin mb-2" />
          <p className="text-sm">Obteniendo ubicación…</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center py-10 text-ink-500 dark:text-ink-400">
          <AlertTriangle size={32} className="text-amber-500 mb-2" />
          <p className="text-sm">Ocurrió un error al cargar los detalles.</p>
        </div>
      )}
      {data && !loading && !error && (
        <dl className="space-y-2.5 text-sm">
          <Row label="Acción" value={data.action} />
          <Row label="Usuario" value={data.user} icon={<UserIcon size={14} />} />
          <Row label="Fecha/Hora" value={data.date ? fmtFechaHora(data.date) : 'Desconocida'} />
          <Row label="Dirección IP" value={<span className="font-mono">{data.ip}</span>} icon={<Globe size={14} />} />
          <Row label="Ubicación" value={data.location} icon={<MapPin size={14} />} />
        </dl>
      )}
    </Modal>
  )
}

function Row({ label, value, icon }) {
  return (
    <div className="flex gap-3 items-start py-1.5 border-b border-ink-100 dark:border-ink-800 last:border-0">
      <dt className="w-28 flex-shrink-0 text-xs uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 inline-flex items-center gap-1.5">
        {icon}{label}
      </dt>
      <dd className="flex-1 text-ink-900 dark:text-ink-100 break-words">{value}</dd>
    </div>
  )
}

export default function Bitacora() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [fechaFiltro, setFechaFiltro] = useState(searchParams.get('fecha_filtro') || '')
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [detailLogId, setDetailLogId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listarBitacora({ page, fechaFiltro, perPage: PER_PAGE })
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => {
        if (cancelled) return
        toast.error(extractApiError(err, 'Error al cargar bitácora'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, fechaFiltro])

  useEffect(() => {
    const next = new URLSearchParams()
    if (fechaFiltro) next.set('fecha_filtro', fechaFiltro)
    if (page !== 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [fechaFiltro, page])

  return (
    <>
      <PageHeader
        icon={History}
        title="Bitácora completa"
        description="Registro histórico de todas las actividades en el sistema."
      />

      <div className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-ink-400" />
          <label className="text-sm font-medium text-ink-600 dark:text-ink-300 whitespace-nowrap">
            Filtrar por fecha:
          </label>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => { setFechaFiltro(e.target.value); setPage(1) }}
            className="border border-ink-200 dark:border-ink-700 bg-transparent rounded-md px-2.5 py-1.5 text-sm text-ink-800 dark:text-ink-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
          {fechaFiltro && (
            <button
              type="button"
              onClick={() => { setFechaFiltro(''); setPage(1) }}
              className="text-ink-400 hover:text-red-500 transition-colors p-1"
              aria-label="Limpiar filtro"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="ml-auto text-sm text-ink-500 dark:text-ink-400">
          Página <strong>{data.page || 1}</strong> de <strong>{data.pages || 1}</strong> ({data.total ?? 0} registros)
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin registros"
          description={fechaFiltro ? 'No se encontraron registros para esta fecha.' : 'Aún no hay actividad registrada.'}
        />
      ) : (
        <>
          <ul className="space-y-2 mb-5">
            {data.items.map((log) => (
              <LogItem key={log.id} log={log} onView={setDetailLogId} />
            ))}
          </ul>

          <Pagination
            page={(data.page || 1) - 1}
            totalPages={data.pages || 1}
            totalElements={data.total ?? 0}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}

      <DetalleModal
        open={Boolean(detailLogId)}
        onClose={() => setDetailLogId(null)}
        logId={detailLogId}
      />
    </>
  )
}
