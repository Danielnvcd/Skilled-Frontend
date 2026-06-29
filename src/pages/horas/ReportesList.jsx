import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, CalendarClock, FileText, ChevronRight, Calendar, Layers,
  Pencil, Eye, FileCheck2, Lock, X,
} from 'lucide-react'
import {
  PageHeader, Button, Input, EmptyState, Pagination, Skeleton, Badge, InfoTip,
} from '../../components/ui'
import { listarReportes } from '../../api/horas'
import { useResource } from '../../hooks/useResource'
import AbrirReporteModal from './AbrirReporteModal'

const PER_PAGE = 20

// ── Estado del reporte ───────────────────────────────────────────────────────
// Cada estado fija su tono de Badge + borde de la card. La paleta es sobria
// (warning/success/info) y el botón de acción usa los variantes del Button
// del design system — sin gradientes ni colores por estado.
const ESTADOS = {
  BORRADOR: {
    label:      'En captura',
    badgeTone:  'warning',
    border:     'border-l-amber-500',
    icon:       Pencil,
    btnLabel:   'Capturar',
    btnVariant: 'primary',
    BtnIcon:    Pencil,
  },
  TERMINADO: {
    label:      'Listo para nómina',
    badgeTone:  'success',
    border:     'border-l-emerald-500',
    icon:       FileCheck2,
    btnLabel:   'Ver detalle',
    btnVariant: 'secondary',
    BtnIcon:    Eye,
  },
  PRENOMINA_CERRADA: {
    label:      'Nómina cerrada',
    badgeTone:  'info',
    border:     'border-l-sky-500',
    icon:       Lock,
    btnLabel:   'Ver detalle',
    btnVariant: 'secondary',
    BtnIcon:    Eye,
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

// ── KPI cards (clickables como filtro) ───────────────────────────────────────
// Mismo lenguaje que las stat cards del Dashboard: chip neutro slate + número
// dominante. La selección se indica con ring brand, sin cambiar el fondo.
function FiltroKPI({ active, icon: Icon, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border text-left transition-colors bg-white dark:bg-ink-900 flex items-center gap-3 focus-ring ${
        active
          ? 'border-brand-600 ring-1 ring-brand-500/30'
          : 'border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700'
      }`}
    >
      <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200 flex-shrink-0">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">{count}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400 mt-1 truncate">{label}</div>
      </div>
    </button>
  )
}

// ── Reporte card ─────────────────────────────────────────────────────────────
// Card sobrio con borde-izq de color como único acento del estado. Badge y
// botón usan componentes del design system para unificar look y a11y.
function ReporteCard({ reporte, onOpen }) {
  const meta = ESTADOS[reporte.estado] || {
    label: reporte.estado, badgeTone: 'neutral', border: 'border-l-ink-400',
    btnLabel: 'Ver detalle', btnVariant: 'secondary', BtnIcon: Eye,
  }
  const BtnIcon = meta.BtnIcon

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800 border-l-[3px] ${meta.border} bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all`}
    >
      <button
        type="button"
        onClick={() => onOpen(reporte.id)}
        className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-3 focus-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-ink-100 text-ink-700 border border-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700">
              {reporte.proyecto?.numero_proyecto || '—'}
            </span>
            <Badge tone={meta.badgeTone} dot>{meta.label}</Badge>
          </div>
          <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100 truncate">
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

        <span
          className={`flex-shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-semibold transition-colors ${
            meta.btnVariant === 'primary'
              ? 'bg-brand-800 text-white group-hover:bg-brand-900 dark:bg-brand-600 dark:group-hover:bg-brand-500'
              : 'bg-white text-ink-700 border border-ink-200 group-hover:bg-ink-50 group-hover:border-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700 dark:group-hover:bg-ink-700'
          }`}
        >
          <BtnIcon size={14} />
          {meta.btnLabel}
          <ChevronRight size={14} className="ml-0.5" />
        </span>
      </button>
    </div>
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
        icon={CalendarClock}
        title={
          <span className="inline-flex items-center gap-1.5">
            Reporte de Horas
            <InfoTip text="Reportes semanales de horas por proyecto. Cada reporte se abre, se captura y al marcarlo TERMINADO alimenta la prenómina de esa semana. Solo los cerrados entran a nómina." />
          </span>
        }
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
          icon={Pencil}
          label="En captura"
          count={stats.borrador}
          onClick={() => onSetEstado('BORRADOR')}
        />
        <FiltroKPI
          active={estado === 'TERMINADO'}
          icon={FileCheck2}
          label="Listos para nómina"
          count={stats.terminado}
          onClick={() => onSetEstado('TERMINADO')}
        />
        <FiltroKPI
          active={estado === 'PRENOMINA_CERRADA'}
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
