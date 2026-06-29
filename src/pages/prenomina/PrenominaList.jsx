import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CalendarRange, CalendarDays, BadgeCheck, Clock, Percent,
  List, CheckCircle2, Calculator, Eye, FolderKanban, Layers, CalendarX,
  Wallet, ReceiptText,
} from 'lucide-react'
import { PageHeader, Skeleton, EmptyState, Badge, Button, InfoTip } from '../../components/ui'
import { listarSemanas } from '../../api/prenomina'
import { useResource } from '../../hooks/useResource'

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function parseDate(iso) {
  return new Date(iso + 'T00:00:00')
}

function weekNumber(d) {
  const target = new Date(d.valueOf())
  const dayNr = (d.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000)
}

export default function PrenominaList() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all') // all | pending | done
  const [fechaFilter, setFechaFilter] = useState('')

  const {
    data: rawData,
    loading,
    error,
  } = useResource(
    'prenomina',
    () => listarSemanas(),
    { staleMs: 30_000, invalidateOn: ['prenomina:changed'] },
  )
  const items = rawData?.items ?? []

  useEffect(() => {
    if (error) toast.error(error.response?.data?.error || 'Error al cargar semanas')
  }, [error])

  const stats = useMemo(() => {
    const total = items.length
    const procesadas = items.filter((s) => s.estado_prenomina !== 'PENDIENTE').length
    const pendientes = total - procesadas
    const pct = total > 0 ? Math.round((procesadas / total) * 100) : 0
    return { total, procesadas, pendientes, pct }
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const isDone = s.estado_prenomina !== 'PENDIENTE'
      if (statusFilter === 'pending' && isDone) return false
      if (statusFilter === 'done' && !isDone) return false
      if (fechaFilter) {
        const f = fechaFilter
        if (f < s.fecha_inicio || f > s.fecha_fin) return false
      }
      return true
    })
  }, [items, statusFilter, fechaFilter])

  // Agrupar por mes (basado en fecha_inicio)
  const grouped = useMemo(() => {
    const out = []
    let currentKey = ''
    for (const s of filtered) {
      const d = parseDate(s.fecha_inicio)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key !== currentKey) {
        currentKey = key
        out.push({ type: 'sep', key, label: `${MESES[d.getMonth() + 1]} ${d.getFullYear()}` })
      }
      out.push({ type: 'card', semana: s })
    }
    return out
  }, [filtered])

  return (
    <>
      <PageHeader
        icon={ReceiptText}
        title={
          <span className="inline-flex items-center gap-1.5">
            Generación de Prenómina
            <InfoTip text="Calcula, edita y cierra la nómina semanal a partir de los reportes de horas TERMINADOS. Se procesa por semanas en orden cronológico; al cerrar se aplican préstamos y ajustes Inbursa automáticamente." />
          </span>
        }
        description="Calcula el pago de los trabajadores en base a los reportes de horas cerrados."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Sin semanas pendientes"
          description="Cuando los coordinadores cierren reportes de horas, aparecerán aquí."
        />
      ) : (
        <>
          {/* KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              icon={CalendarDays}
              label="Semanas totales"
              value={stats.total}
              sub="cerradas por coordinadores"
            />
            <KpiCard
              icon={BadgeCheck}
              label="Procesadas"
              value={stats.procesadas}
              sub="prenóminas generadas"
            />
            <KpiCard
              icon={Clock}
              label="Pendientes"
              value={stats.pendientes}
              sub="listas para calcular"
            />
            <KpiCard
              icon={Percent}
              label="Completado"
              value={`${stats.pct}%`}
              progress={stats.pct}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 shadow-sm">
              <CalendarDays size={16} className="text-ink-400" />
              <label className="text-sm text-ink-500 dark:text-ink-400 font-medium whitespace-nowrap">Fecha:</label>
              <input
                type="date"
                value={fechaFilter}
                onChange={(e) => setFechaFilter(e.target.value)}
                className="text-sm bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              {fechaFilter && (
                <button
                  type="button"
                  onClick={() => setFechaFilter('')}
                  className="text-ink-400 hover:text-red-500 text-lg leading-none px-1"
                  title="Limpiar"
                >×</button>
              )}
            </div>

            <div className="inline-flex bg-ink-100 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl p-1">
              <SegBtn active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={stats.total} icon={List}>Todas</SegBtn>
              <SegBtn active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={stats.pendientes} icon={Clock}>Pendientes</SegBtn>
              <SegBtn active={statusFilter === 'done'} onClick={() => setStatusFilter('done')} count={stats.procesadas} icon={CheckCircle2}>Procesadas</SegBtn>
            </div>
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-ink-900 rounded-2xl border border-dashed border-ink-300 dark:border-ink-700">
              <CalendarX className="mx-auto text-ink-300 dark:text-ink-600 mb-3" size={40} />
              <p className="font-semibold text-ink-700 dark:text-ink-200">Sin coincidencias</p>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">No se encontraron semanas para los filtros aplicados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {grouped.map((g) => g.type === 'sep' ? (
                <MonthSep key={g.key} label={g.label} />
              ) : (
                <SemanaCard
                  key={g.semana.fecha_str}
                  semana={g.semana}
                  onClick={() => navigate(`/prenomina/${g.semana.fecha_str}`)}
                  onResumenPago={() => navigate(`/prenomina/${g.semana.fecha_str}/pago`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── Componentes ─────────────────────────────────────────────────────────────

// KPI sobrio estilo Dashboard StatCard: chip neutro + valor dominante. Sin
// barras coloridas ni gradientes — el icono y el número hablan por sí solos.
function KpiCard({ icon: Icon, label, value, sub, progress }) {
  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-3xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1 leading-none">{value}</p>
        {progress != null ? (
          <div className="mt-2 h-1.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 dark:bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        ) : sub ? (
          <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-1">{sub}</p>
        ) : null}
      </div>
    </div>
  )
}

function SegBtn({ active, onClick, count, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-100 shadow-sm ring-1 ring-ink-200 dark:ring-ink-600'
          : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'
      }`}
    >
      <Icon size={12} />
      {children}
      <span className={`inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        active ? 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200' : 'bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-300'
      }`}>{count}</span>
    </button>
  )
}

function MonthSep({ label }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-2 first:pt-0">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400 bg-white dark:bg-ink-900 px-3 py-1 rounded-full border border-ink-200 dark:border-ink-800 whitespace-nowrap">
        <CalendarDays size={11} /> {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-ink-200 dark:from-ink-700 to-transparent" />
    </div>
  )
}

// Cada estado tiene su propia paleta sobria: borde-izquierdo + acento del día
// + tono del badge. Sin gradientes ni fondos saturados — solo un toque de
// color para que el estado se lea de un vistazo.
const ESTADO_STYLE = {
  PENDIENTE: {
    border:     'border-l-brand-500',
    dateAccent: 'text-brand-700 dark:text-brand-300',
    badgeTone:  'brand',
    badgeLabel: 'Lista p/cálculo',
    btnVariant: 'primary',
    BtnIcon:    Calculator,
    btnLabel:   'Calcular prenómina',
  },
  ABIERTA: {
    border:     'border-l-amber-500',
    dateAccent: 'text-amber-700 dark:text-amber-300',
    badgeTone:  'warning',
    badgeLabel: 'En edición',
    btnVariant: 'secondary',
    BtnIcon:    Calculator,
    btnLabel:   'Continuar edición',
  },
  APROBADO: {
    border:     'border-l-emerald-500',
    dateAccent: 'text-emerald-700 dark:text-emerald-300',
    badgeTone:  'success',
    badgeLabel: 'Aprobada',
    btnVariant: 'secondary',
    BtnIcon:    Eye,
    btnLabel:   'Ver recibos',
  },
}

function SemanaCard({ semana, onClick, onResumenPago }) {
  const estado = semana.estado_prenomina === 'APROBADO'
    ? 'APROBADO'
    : semana.estado_prenomina === 'ABIERTA'
      ? 'ABIERTA'
      : 'PENDIENTE'
  const st = ESTADO_STYLE[estado]
  // Resumen de pago solo cuando ya hay cálculos (ABIERTA o APROBADO).
  const showResumen = estado !== 'PENDIENTE'

  const inicio = parseDate(semana.fecha_inicio)
  const fin = parseDate(semana.fecha_fin)
  const wk = weekNumber(inicio)

  const projects = semana.proyectos.slice(0, 5)
  const restantes = semana.proyectos.length - projects.length

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[160px_1fr_auto] items-stretch overflow-hidden rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 border-l-[3px] ${st.border} hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all`}
    >
      {/* Panel de fecha sobrio */}
      <div className="bg-ink-50/60 dark:bg-ink-800/30 px-3 py-3 flex flex-col items-center justify-center text-center md:border-r md:border-ink-200 md:dark:border-ink-800">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          Semana {wk}
        </span>
        <div className={`text-3xl font-bold mt-1 leading-none tabular-nums ${st.dateAccent}`}>
          {String(inicio.getDate()).padStart(2, '0')}
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wide mt-1 text-ink-700 dark:text-ink-200">
          {MESES[inicio.getMonth() + 1].slice(0, 3)} {inicio.getFullYear()}
        </div>
        <div className="text-[10px] text-ink-500 dark:text-ink-400 mt-1 tabular-nums">
          al {String(fin.getDate()).padStart(2, '0')} {MESES[fin.getMonth() + 1].slice(0, 3)}
        </div>
        <div className="inline-flex items-center gap-1 mt-2 text-[10px] text-ink-500 dark:text-ink-400">
          <FolderKanban size={10} /> {semana.proyectos.length} proyecto{semana.proyectos.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Panel de proyectos */}
      <div className="px-4 py-3 flex flex-col justify-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          <Layers size={11} /> Proyectos consolidados
        </div>
        <div className="flex flex-wrap gap-1.5">
          {projects.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 pl-1 pr-2.5 py-0.5 rounded-full text-xs text-ink-700 dark:text-ink-200"
              title={`${p.nombre}${p.coordinador_nombre ? ` · ${p.coordinador_nombre}` : ' · Sin coordinador'}`}
            >
              <span className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold uppercase ${
                p.coordinador_nombre
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'bg-ink-200 text-ink-500 dark:bg-ink-700 dark:text-ink-400'
              }`}>
                {p.coordinador_initials || '?'}
              </span>
              <span className="font-semibold text-ink-900 dark:text-ink-100">{p.nombre || p.numero_proyecto}</span>
            </span>
          ))}
          {restantes > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 text-xs font-semibold">
              +{restantes} más
            </span>
          )}
        </div>
      </div>

      {/* Panel de acciones */}
      <div className="px-4 py-3 flex flex-col items-stretch md:items-end justify-center gap-2 md:min-w-[200px] md:border-l md:border-ink-200 md:dark:border-ink-800">
        <Badge tone={st.badgeTone} dot className="self-start md:self-end">
          {st.badgeLabel}
        </Badge>

        <Button
          variant={st.btnVariant}
          size="sm"
          leftIcon={<st.BtnIcon size={13} />}
          onClick={onClick}
        >
          {st.btnLabel}
        </Button>

        {showResumen && (
          <Button
            variant="success"
            size="sm"
            leftIcon={<Wallet size={13} />}
            onClick={(e) => { e.stopPropagation(); onResumenPago() }}
            title="Ver cuánto se le paga a cada empleado"
          >
            Resumen de pago
          </Button>
        )}
      </div>
    </div>
  )
}
