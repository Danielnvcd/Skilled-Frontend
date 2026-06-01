import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, Clock, FileText, ChevronRight, Calendar, Layers,
  Pencil, Eye, CheckCircle2, FileCheck2, Lock, X,
} from 'lucide-react'
import {
  PageHeader, Button, Input, EmptyState, Pagination, Skeleton,
} from '../../components/ui'
import { listarReportes } from '../../api/horas'
import { useResource } from '../../hooks/useResource'
import AbrirReporteModal from './AbrirReporteModal'

const PER_PAGE = 20

// ── Helpers de estado ────────────────────────────────────────────────────────

const ESTADOS = {
  BORRADOR: {
    label: 'En captura',
    short: 'Borrador',
    accent: 'amber',
    icon: Pencil,
  },
  TERMINADO: {
    label: 'Listo para nómina',
    short: 'Terminado',
    accent: 'emerald',
    icon: CheckCircle2,
  },
  PRENOMINA_CERRADA: {
    label: 'Nómina cerrada',
    short: 'Cerrada',
    accent: 'sky',
    icon: Lock,
  },
}

const ACCENT_CLASSES = {
  amber: {
    barBg: 'bg-amber-500',
    chipBg: 'bg-amber-50 dark:bg-amber-900/30',
    chipText: 'text-amber-800 dark:text-amber-300',
    chipRing: 'ring-amber-200 dark:ring-amber-700/60',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    cardSelected: 'border-amber-300 dark:border-amber-700/70 bg-amber-50/60 dark:bg-amber-900/10',
    btn: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white',
  },
  emerald: {
    barBg: 'bg-emerald-500',
    chipBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    chipText: 'text-emerald-800 dark:text-emerald-300',
    chipRing: 'ring-emerald-200 dark:ring-emerald-700/60',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    cardSelected: 'border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/60 dark:bg-emerald-900/10',
    btn: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
  },
  sky: {
    barBg: 'bg-sky-500',
    chipBg: 'bg-sky-50 dark:bg-sky-900/30',
    chipText: 'text-sky-800 dark:text-sky-300',
    chipRing: 'ring-sky-200 dark:ring-sky-700/60',
    iconBg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    cardSelected: 'border-sky-300 dark:border-sky-700/70 bg-sky-50/60 dark:bg-sky-900/10',
    btn: 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white',
  },
  brand: {
    barBg: 'bg-brand-500',
    chipBg: 'bg-brand-50 dark:bg-brand-900/40',
    chipText: 'text-brand-800 dark:text-brand-200',
    chipRing: 'ring-brand-200 dark:ring-brand-700/60',
    iconBg: 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
    cardSelected: 'border-brand-300 dark:border-brand-700/70 bg-brand-50/60 dark:bg-brand-900/10',
    btn: 'bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500 text-white',
  },
}

// ── Helpers de formato ───────────────────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtFechaCorta(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]}`
}

function fmtRango(inicio, fin) {
  if (!inicio || !fin) return '—'
  const [yi, mi, di] = inicio.split('-').map(Number)
  const [yf, mf, df] = fin.split('-').map(Number)
  const ini = `${di} ${MESES[mi - 1]}`
  const finStr = mi === mf
    ? `${df}`
    : `${df} ${MESES[mf - 1]}`
  return `${ini} — ${finStr} ${yf}`
}

// ── KPI cards ────────────────────────────────────────────────────────────────

function FiltroKPI({ active, accent, icon: Icon, label, count, onClick }) {
  const a = ACCENT_CLASSES[accent]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 min-w-[150px] rounded-xl border bg-white dark:bg-ink-900 p-4 text-left transition-all focus-ring hover:shadow-card hover:-translate-y-0.5 ${
        active
          ? `${a.cardSelected} shadow-card`
          : 'border-ink-200 dark:border-ink-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-9 w-9 rounded-lg ${a.iconBg} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        {active && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-ink-500 dark:text-ink-400">
            Filtrando
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tabular-nums text-ink-900 dark:text-ink-100">{count}</div>
        <div className="text-xs text-ink-600 dark:text-ink-400 font-medium mt-0.5">{label}</div>
      </div>
    </button>
  )
}

// ── Reporte card ─────────────────────────────────────────────────────────────

function ReporteCard({ reporte, onOpen }) {
  const meta = ESTADOS[reporte.estado] || { label: reporte.estado, accent: 'brand', icon: FileText }
  const accent = ACCENT_CLASSES[meta.accent]
  const Icon = meta.icon
  const isEditable = reporte.estado === 'BORRADOR'

  return (
    <button
      type="button"
      onClick={() => onOpen(reporte.id)}
      className="group relative w-full flex items-stretch overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-brand-300 dark:hover:border-brand-700/60 hover:shadow-card transition-all focus-ring text-left"
    >
      {/* Barra lateral de color */}
      <div className={`w-1.5 flex-shrink-0 ${accent.barBg}`} />

      <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Info principal */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold font-mono ${accent.chipBg} ${accent.chipText} ring-1 ring-inset ${accent.chipRing}`}>
              {reporte.proyecto?.numero_proyecto || '—'}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${accent.chipText}`}>
              <Icon size={12} />
              {meta.label}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-ink-900 dark:text-ink-100 truncate">
            {reporte.proyecto?.nombre || 'Sin nombre'}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-ink-500 dark:text-ink-400">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={13} />
              <span className="font-medium text-ink-700 dark:text-ink-300">
                {fmtRango(reporte.fecha_inicio, reporte.fecha_fin)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers size={13} />
              <span className="tabular-nums">
                <span className="font-semibold text-ink-700 dark:text-ink-300">{reporte.registros_count}</span>{' '}
                {reporte.registros_count === 1 ? 'registro' : 'registros'}
              </span>
            </span>
          </div>
        </div>

        {/* Acción */}
        <div className="flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-semibold transition-colors ${
              isEditable
                ? accent.btn
                : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 group-hover:bg-ink-200 dark:group-hover:bg-ink-700'
            }`}
          >
            {isEditable ? <Pencil size={14} /> : <Eye size={14} />}
            {isEditable ? 'Capturar' : 'Ver detalle'}
            <ChevronRight size={14} className="ml-0.5" />
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ReportesList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  // Debounce de búsqueda — 300ms para no spammear el backend mientras escribe.
  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput.trim() !== q) {
        setQ(qInput.trim())
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [qInput, q])

  const {
    data: rawData,
    loading,
    error,
  } = useResource(
    ['reportes-horas', { page, q, estado }],
    () => listarReportes({ page, q, estado, perPage: PER_PAGE }),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )
  const data = rawData ?? { items: [], total: 0, page: 1, pages: 1 }

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error cargando reportes')
  }, [error])

  // KPIs por estado — llaves dentro del mismo namespace 'reportes-horas' para
  // que un único 'reporte:lista_changed' invalide listado + KPIs a la vez.
  const { data: kpiTotalRaw } = useResource(
    ['reportes-horas', { kpi: 'total' }],
    () => listarReportes({ page: 1, perPage: 1 }),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )
  const { data: kpiBorradorRaw } = useResource(
    ['reportes-horas', { kpi: 'BORRADOR' }],
    () => listarReportes({ page: 1, perPage: 1, estado: 'BORRADOR' }),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )
  const { data: kpiTerminadoRaw } = useResource(
    ['reportes-horas', { kpi: 'TERMINADO' }],
    () => listarReportes({ page: 1, perPage: 1, estado: 'TERMINADO' }),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )
  const { data: kpiCerradaRaw } = useResource(
    ['reportes-horas', { kpi: 'PRENOMINA_CERRADA' }],
    () => listarReportes({ page: 1, perPage: 1, estado: 'PRENOMINA_CERRADA' }),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )
  const stats = {
    total: kpiTotalRaw?.total ?? 0,
    borrador: kpiBorradorRaw?.total ?? 0,
    terminado: kpiTerminadoRaw?.total ?? 0,
    cerrada: kpiCerradaRaw?.total ?? 0,
  }

  const onSetEstado = (next) => {
    setEstado((prev) => (prev === next ? '' : next))
    setPage(1)
  }

  const onAbrir = (id) => navigate(`/horas/${id}`)

  const clearFilters = () => {
    setQInput('')
    setQ('')
    setEstado('')
    setPage(1)
  }

  const hayFiltros = Boolean(q || estado)

  return (
    <>
      <PageHeader
        icon={Clock}
        title="Reporte de Horas"
        description="Captura semanal por proyecto. Abre, registra y envía a prenómina cuando termines."
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
            Nuevo reporte
          </Button>
        }
      />

      {/* KPI cards — clickables como filtro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <FiltroKPI
          active={estado === 'BORRADOR'}
          accent="amber"
          icon={Pencil}
          label="En captura"
          count={stats.borrador}
          onClick={() => onSetEstado('BORRADOR')}
        />
        <FiltroKPI
          active={estado === 'TERMINADO'}
          accent="emerald"
          icon={FileCheck2}
          label="Listos para nómina"
          count={stats.terminado}
          onClick={() => onSetEstado('TERMINADO')}
        />
        <FiltroKPI
          active={estado === 'PRENOMINA_CERRADA'}
          accent="sky"
          icon={Lock}
          label="Nómina cerrada"
          count={stats.cerrada}
          onClick={() => onSetEstado('PRENOMINA_CERRADA')}
        />
      </div>

      {/* Búsqueda */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por proyecto o número..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            leftIcon={<Search size={15} />}
            rightIcon={qInput ? (
              <button
                type="button"
                onClick={() => setQInput('')}
                className="hover:text-ink-700 dark:hover:text-ink-200 pointer-events-auto"
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            ) : null}
          />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Quitar filtros
          </Button>
        )}
        <div className="ml-auto text-xs text-ink-500 dark:text-ink-400 hidden sm:block">
          {loading ? '…' : (
            <>
              <span className="font-semibold text-ink-900 dark:text-ink-100">{data.total}</span> resultado{data.total === 1 ? '' : 's'}
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hayFiltros ? 'Sin resultados' : 'No hay reportes aún'}
          description={
            hayFiltros
              ? 'Ningún reporte coincide con los filtros activos.'
              : 'Abre tu primer reporte semanal para empezar a capturar horas por proyecto.'
          }
          action={
            hayFiltros ? (
              <Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>
            ) : (
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                Abrir primer reporte
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((r) => (
              <ReporteCard key={r.id} reporte={r} onOpen={onAbrir} />
            ))}
          </div>

          <Pagination
            page={(data.page || 1) - 1}
            totalPages={data.pages || 1}
            totalElements={data.total}
            size={data.per_page || PER_PAGE}
            onChange={(newZeroPage) => setPage(newZeroPage + 1)}
          />
        </>
      )}

      <AbrirReporteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(newId) => {
          navigate(`/horas/${newId}`)
        }}
      />
    </>
  )
}
