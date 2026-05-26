import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  DollarSign, CalendarRange, CalendarDays, CheckCheck, Clock, Percent,
  List, CheckCircle2, Calculator, Eye, FolderOpen, Layers, X, CalendarX,
  Wallet,
} from 'lucide-react'
import { PageHeader, Skeleton, EmptyState } from '../../components/ui'
import { listarSemanas } from '../../api/prenomina'

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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all') // all | pending | done
  const [fechaFilter, setFechaFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listarSemanas()
      .then((res) => { if (!cancelled) setItems(res.items || []) })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.error || 'Error al cargar semanas')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

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
        icon={Calculator}
        title="Generación de Prenómina"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard
              tone="blue"
              icon={CalendarDays}
              label="Semanas totales"
              value={stats.total}
              sub="cerradas por coordinadores"
            />
            <KpiCard
              tone="green"
              icon={CheckCheck}
              label="Procesadas"
              value={stats.procesadas}
              sub="prenóminas generadas"
            />
            <KpiCard
              tone="amber"
              icon={Clock}
              label="Pendientes"
              value={stats.pendientes}
              sub="listas para calcular"
            />
            <KpiCard
              tone="violet"
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
                className="text-sm bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-[#0b5fb4]/20 focus:border-[#0b5fb4]"
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

const KPI_TONES = {
  blue:   { bar: 'bg-[#0b5fb4]',  iconBg: 'bg-blue-100 dark:bg-blue-900/40 text-[#0b5fb4] dark:text-blue-300',     value: 'text-[#1e40af] dark:text-blue-200' },
  green:  { bar: 'bg-emerald-600', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', value: 'text-emerald-700 dark:text-emerald-300' },
  amber:  { bar: 'bg-amber-600',   iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',         value: 'text-amber-700 dark:text-amber-300' },
  violet: { bar: 'bg-violet-600',  iconBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',     value: 'text-violet-700 dark:text-violet-300' },
}

function KpiCard({ tone = 'blue', icon: Icon, label, value, sub, progress }) {
  const t = KPI_TONES[tone] || KPI_TONES.blue
  return (
    <div className="relative bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl px-4 py-3.5 flex items-center gap-3 overflow-hidden transition-shadow hover:shadow-md hover:-translate-y-0.5">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${t.bar} opacity-85`} />
      <div className={`flex-shrink-0 h-11 w-11 rounded-lg inline-flex items-center justify-center ${t.iconBg}`}>
        <Icon size={18} />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
        <span className={`text-2xl font-extrabold leading-tight mt-0.5 ${t.value}`}>{value}</span>
        {progress != null ? (
          <div className="mt-1.5 h-1.5 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0b5fb4] to-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        ) : sub ? (
          <span className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">{sub}</span>
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
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-white dark:bg-ink-700 text-[#0b5fb4] dark:text-blue-300 shadow-sm'
          : 'text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'
      }`}
    >
      <Icon size={12} />
      {children}
      <span className={`inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        active ? 'bg-blue-100 dark:bg-blue-900/50 text-[#0b5fb4] dark:text-blue-200' : 'bg-ink-200 dark:bg-ink-700 text-ink-600 dark:text-ink-300'
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

function SemanaCard({ semana, onClick, onResumenPago }) {
  const isDone = semana.estado_prenomina !== 'PENDIENTE'
  const isAprobada = semana.estado_prenomina === 'APROBADO'
  const inicio = parseDate(semana.fecha_inicio)
  const fin = parseDate(semana.fecha_fin)
  const wk = weekNumber(inicio)

  const panelGradient = isDone
    ? 'from-emerald-600 to-emerald-700'
    : 'from-[#0b5fb4] to-[#094d8f]'
  const borderLeft = isDone ? 'border-l-emerald-500' : 'border-l-[#0b5fb4]'

  const projects = semana.proyectos.slice(0, 5)
  const restantes = semana.proyectos.length - projects.length

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[175px_1fr_auto] items-stretch overflow-hidden rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 border-l-[5px] ${borderLeft} shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}
    >
      {/* Panel de fecha */}
      <div className={`relative bg-gradient-to-br ${panelGradient} text-white px-3 py-4 flex flex-col items-center justify-center text-center`}>
        <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
          SEM {wk}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-85">Inicia</span>
        <div className="text-3xl font-extrabold mt-1 leading-none">{String(inicio.getDate()).padStart(2, '0')}</div>
        <div className="text-xs font-semibold uppercase tracking-wide mt-1 opacity-95">
          {MESES[inicio.getMonth() + 1].slice(0, 3)} · {inicio.getFullYear()}
        </div>
        <div className="flex items-center gap-1.5 my-1.5 text-[10px] opacity-70 w-full justify-center">
          <span className="h-px w-4 bg-white/40" /> al <span className="h-px w-4 bg-white/40" />
        </div>
        <div className="text-sm font-bold opacity-95">
          {String(fin.getDate()).padStart(2, '0')} {MESES[fin.getMonth() + 1].slice(0, 3)}
        </div>
        <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold whitespace-nowrap">
          <FolderOpen size={11} /> {semana.proyectos.length} proyecto{semana.proyectos.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Panel de proyectos */}
      <div className="px-5 py-4 md:border-r md:border-ink-200 md:dark:border-ink-800 flex flex-col justify-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <Layers size={11} /> Proyectos consolidados
        </div>
        <div className="flex flex-wrap gap-1.5">
          {projects.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 transition-colors pl-1 pr-2.5 py-0.5 rounded-full text-xs font-medium text-ink-700 dark:text-ink-200"
              title={`${p.nombre}${p.coordinador_nombre ? ` · ${p.coordinador_nombre}` : ' · Sin coordinador'}`}
            >
              <span className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold uppercase text-white ${
                p.coordinador_nombre
                  ? 'bg-gradient-to-br from-[#0b5fb4] to-blue-500'
                  : 'bg-ink-300 dark:bg-ink-600 text-ink-500 dark:text-ink-300'
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
      <div className="px-5 py-4 flex flex-col items-stretch md:items-end justify-center gap-2 md:min-w-[200px]">
        {isDone ? (
          <span className="inline-flex items-center gap-1.5 self-end px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {isAprobada ? 'Aprobada' : 'Procesada'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 self-end px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-[#0b5fb4] border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0b5fb4] animate-pulse" />
            Lista p/cálculo
          </span>
        )}

        <button
          type="button"
          onClick={onClick}
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
            isDone
              ? 'bg-blue-50 text-[#0b5fb4] border border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-700/60 dark:hover:bg-blue-900/40'
              : 'bg-gradient-to-br from-[#0b5fb4] to-[#094d8f] text-white shadow-md hover:shadow-lg hover:brightness-110 -translate-y-0'
          }`}
        >
          {isDone
            ? <><Eye size={14} /> Ver recibos</>
            : <><Calculator size={14} /> Calcular prenómina</>
          }
        </button>

        {isDone && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onResumenPago() }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md hover:shadow-lg hover:brightness-110"
            title="Ver cuánto se le paga a cada empleado"
          >
            <Wallet size={14} /> Resumen de pago
          </button>
        )}
      </div>
    </div>
  )
}
