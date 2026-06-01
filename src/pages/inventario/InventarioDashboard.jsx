import { useEffect, useMemo, useState, memo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PackageSearch, Boxes, ScanLine, ArrowRightLeft, Send, ClipboardList,
  AlertTriangle, Package, TrendingUp, TrendingDown, Clock, ChevronRight,
  History, CheckCircle2, Wrench, Hammer, Settings2,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getProductos, getProductosBajoMinimo, getMovimientos, getSolicitudes,
} from '../../api/inventario'
import { getStatsHerramientas } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import useIsMobileDevice from '../../hooks/useIsMobileDevice'

// Eventos que invalidan stocks/listados de inventario:
// - `producto:changed` — alta/edición/baja de producto
// - `movimiento:changed` — alta de movimiento (también cambia stock visible)
// - `solicitud:changed` — alta/cambio estado/entrega de solicitud
// - `herramienta:changed` y derivados — recargan stats de herramientas
const PRODUCTO_EVENTS = ['producto:changed', 'movimiento:changed']
const HERR_STATS_EVENTS = [
  'herramienta:changed', 'asignacion:changed', 'mantenimiento:changed',
  'incidencia:changed', 'baja:changed',
]

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#db2777',
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function StatCard({ tone, label, value, Icon, to }) {
  const tones = {
    blue:   { border: 'border-l-sky-500',     iconWrap: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200 ring-1 ring-sky-300/50 dark:ring-sky-400/30' },
    green:  { border: 'border-l-emerald-500', iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200 ring-1 ring-emerald-300/50 dark:ring-emerald-400/30' },
    purple: { border: 'border-l-violet-500',  iconWrap: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200 ring-1 ring-violet-300/50 dark:ring-violet-400/30' },
    orange: { border: 'border-l-amber-500',   iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200 ring-1 ring-amber-300/50 dark:ring-amber-400/30' },
    red:    { border: 'border-l-rose-500',    iconWrap: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200 ring-1 ring-rose-300/50 dark:ring-rose-400/30' },
  }
  const t = tones[tone] || tones.blue
  const Wrap = to ? Link : 'div'
  return (
    <Wrap
      to={to}
      className={`bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 border-l-4 ${t.border} p-5 flex items-center gap-4 shadow-sm ${to ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`h-12 w-12 rounded-full inline-flex items-center justify-center flex-shrink-0 ${t.iconWrap}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-ink-900 dark:text-ink-100 mt-0.5">{value}</p>
      </div>
    </Wrap>
  )
}

function Panel({ title, Icon, action, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 dark:border-ink-700 pb-3 mb-4">
        <div className="flex items-center gap-2 text-ink-800 dark:text-ink-200 font-semibold text-sm">
          {Icon && <Icon size={16} className="text-ink-400 dark:text-ink-500" />}
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const ChartTooltip = memo(function ChartTooltip({ active, payload, isDark, labelText }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-elevated border"
      style={{
        background: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      <p className="font-semibold mb-1">{payload[0].payload.label || payload[0].name}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          <span className="text-ink-500 dark:text-ink-400">{p.name}: </span>
          <strong>{p.value}</strong> {labelText || ''}
        </p>
      ))}
    </div>
  )
})

const MovimientosBar = memo(function MovimientosBar({ data, isDark }) {
  if (!data?.length) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin movimientos en los últimos 7 días</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280} debounce={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
        <Tooltip content={<ChartTooltip isDark={isDark} labelText="mov." />} cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} isAnimationActive={false} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Entradas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Salidas"  stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Ajustes"  stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
})

const CategoriasDonut = memo(function CategoriasDonut({ data, isDark }) {
  if (!data?.length) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin productos registrados</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280} debounce={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={1}
          stroke={isDark ? '#0f172a' : '#ffffff'}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip isDark={isDark} labelText="prod." />} isAnimationActive={false} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          wrapperStyle={{ fontSize: 11, paddingLeft: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})

function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TIPO_STYLE = {
  ENTRADA:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  SALIDA:   'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  AJUSTE:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  TRASPASO: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
}

// ── Versión móvil: minimal, foco en escanear ───────────────────────────────

function MobileInventarioHome() {
  const { user } = useAuth()

  const { data: rawBajoMinimo } = useResource(
    ['productos', 'bajo-minimo'],
    () => getProductosBajoMinimo(),
    { staleMs: 60_000, invalidateOn: PRODUCTO_EVENTS },
  )
  const { data: rawSolicitudes } = useResource(
    ['solicitudes', { limit: 100 }],
    () => getSolicitudes({ limit: 100 }),
    { staleMs: 60_000, invalidateOn: ['solicitud:changed'] },
  )
  const bajoMinimo = rawBajoMinimo ?? []
  const solicitudesPend = (rawSolicitudes ?? []).filter((s) => s.estatus === 'PENDIENTE').length

  return (
    <div className="max-w-md mx-auto space-y-5 pt-2">
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">
          {greeting()}
        </p>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 mt-1">
          {user?.full_name?.split(' ')[0] || user?.username}
        </h1>
      </div>

      <Link
        to="/inventario/scanner"
        className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-brand-600 text-white py-10 shadow-lg active:scale-[0.98] transition-transform"
      >
        <ScanLine size={48} strokeWidth={1.5} />
        <span className="text-lg font-bold">Escanear QR</span>
        <span className="text-xs text-white/80">Estante, producto o herramienta</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/inventario/bajo-minimo"
          className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={16} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Bajo mínimo</span>
          </div>
          <p className="text-2xl font-bold mt-1 tabular-nums">{bajoMinimo.length}</p>
        </Link>
        <Link
          to="/inventario/solicitudes"
          className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <ClipboardList size={16} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Solicitudes</span>
          </div>
          <p className="text-2xl font-bold mt-1 tabular-nums">{solicitudesPend}</p>
          <p className="text-[10px] text-ink-500 mt-0.5">pendientes</p>
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold px-1">Atajos</p>
        <Link to="/inventario/catalogo" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <Package size={18} className="text-brand-600" />
          <span className="text-sm font-medium flex-1">Catálogo</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/inventario/movimientos/nuevo" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <ArrowRightLeft size={18} className="text-brand-600" />
          <span className="text-sm font-medium flex-1">Registrar movimiento</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/inventario/tomas" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <ClipboardList size={18} className="text-brand-600" />
          <span className="text-sm font-medium flex-1">Tomas físicas</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
      </div>
    </div>
  )
}

// ── Dashboard completo (PC) ────────────────────────────────────────────────

export default function InventarioDashboard() {
  const isMobileDevice = useIsMobileDevice()
  if (isMobileDevice) return <MobileInventarioHome />

  const { user } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  void theme

  // 5 fuentes con namespaces compartidos por otras páginas de inventario
  // (Catalogo, BajoMinimo, Movimientos, Solicitudes, Herramientas/*). Cuando
  // el backend emite los eventos correspondientes, todas las vistas que
  // dependan del namespace se invalidan a la vez.
  const { data: rawProductos, error: errProd } = useResource(
    ['productos', { limit: 500 }],
    () => getProductos({ limit: 500 }),
    { staleMs: 60_000, invalidateOn: ['producto:changed'] },
  )
  const { data: rawBajoMinimo, error: errBajo } = useResource(
    ['productos', 'bajo-minimo'],
    () => getProductosBajoMinimo(),
    { staleMs: 60_000, invalidateOn: PRODUCTO_EVENTS },
  )
  const { data: rawMovimientos, error: errMov } = useResource(
    ['movimientos', { limit: 300 }],
    () => getMovimientos({ limit: 300 }),
    { staleMs: 60_000, invalidateOn: ['movimiento:changed'] },
  )
  const { data: rawSolicitudes, error: errSol } = useResource(
    ['solicitudes', { limit: 100 }],
    () => getSolicitudes({ limit: 100 }),
    { staleMs: 60_000, invalidateOn: ['solicitud:changed'] },
  )
  const { data: herrStatsData, error: errHerr } = useResource(
    ['herramientas', 'stats'],
    () => getStatsHerramientas(),
    { staleMs: 60_000, invalidateOn: HERR_STATS_EVENTS },
  )
  const productos = rawProductos ?? []
  const bajoMinimo = rawBajoMinimo ?? []
  const movimientos = rawMovimientos ?? []
  const solicitudes = rawSolicitudes ?? []
  const herrStats = herrStatsData ?? null

  // Spinner mientras llega el primer set (cualquiera de las 5 fuentes).
  const loading =
    !rawProductos && !rawBajoMinimo && !rawMovimientos && !rawSolicitudes && !herrStatsData

  useEffect(() => {
    const err = errProd || errBajo || errMov || errSol || errHerr
    if (err) toast.error(extractApiError(err, 'Error al cargar el dashboard'))
  }, [errProd, errBajo, errMov, errSol, errHerr])

  // ── Cálculos derivados ──────────────────────────────────────────────────
  const solicitudesPendientes = useMemo(
    () => solicitudes.filter((s) => s.estatus === 'PENDIENTE'),
    [solicitudes]
  )

  const movimientosHoy = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    return movimientos.filter((m) => (m.fecha || '').slice(0, 10) === hoy).length
  }, [movimientos])

  // Histograma de movimientos por día (últimos 7 días)
  const movimientosPorDia = useMemo(() => {
    const buckets = []
    const fmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit' })
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      buckets.push({ iso, label: fmt.format(d), Entradas: 0, Salidas: 0, Ajustes: 0 })
    }
    const byIso = Object.fromEntries(buckets.map((b) => [b.iso, b]))
    movimientos.forEach((m) => {
      const iso = (m.fecha || '').slice(0, 10)
      const bucket = byIso[iso]
      if (!bucket) return
      if (m.tipo === 'ENTRADA') bucket.Entradas++
      else if (m.tipo === 'SALIDA') bucket.Salidas++
      else if (m.tipo === 'AJUSTE') bucket.Ajustes++
    })
    return buckets
  }, [movimientos])

  // Distribución de productos por categoría (top 8 + "Otras")
  const productosPorCategoria = useMemo(() => {
    const counts = new Map()
    productos.forEach((p) => {
      const cat = p.categoria || 'Sin categoría'
      counts.set(cat, (counts.get(cat) || 0) + 1)
    })
    const arr = Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
    arr.sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const top = arr.slice(0, 7)
    const restoValor = arr.slice(7).reduce((acc, x) => acc + x.value, 0)
    return [...top, { label: 'Otras', value: restoValor }]
  }, [productos])

  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 8),
    [movimientos]
  )

  const productosById = useMemo(() => {
    const m = {}
    productos.forEach((p) => { m[p.id] = p })
    return m
  }, [productos])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-100">
          {greeting()},{' '}
          <span className="text-brand-600 dark:text-sky-300 capitalize">
            {user?.full_name || user?.username}
          </span>!
        </h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
          Panel principal de control de inventario y almacenes.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="blue"   label="Productos activos"      value={productos.length}              Icon={Package}        to="/inventario/catalogo" />
        <StatCard tone="orange" label="Solicitudes pendientes" value={solicitudesPendientes.length}  Icon={ClipboardList}  to="/inventario/solicitudes" />
        <StatCard tone="red"    label="Bajo mínimo"            value={bajoMinimo.length}             Icon={AlertTriangle}  to="/inventario/movimientos" />
        <StatCard tone="green"  label="Movimientos hoy"        value={movimientosHoy}                Icon={ArrowRightLeft} to="/inventario/movimientos" />
        {herrStats && (
          <>
            <StatCard tone="purple" label="Herramientas activas"
                      value={herrStats.total_herramientas}
                      Icon={Wrench} to="/inventario/herramientas" />
            <StatCard tone="blue"   label="Unidades asignadas"
                      value={herrStats.unidades_por_estado?.ASIGNADA || 0}
                      Icon={Hammer} to="/inventario/herramientas/asignaciones" />
            <StatCard tone="orange" label="En mantenimiento"
                      value={herrStats.unidades_por_estado?.EN_MANTENIMIENTO || 0}
                      Icon={Settings2} to="/inventario/herramientas/mantenimientos" />
            <StatCard tone="red"    label="Incidencias y bajas"
                      value={(herrStats.incidencias_abiertas || 0) + (herrStats.solicitudes_baja_pendientes || 0)}
                      Icon={AlertTriangle} to="/inventario/herramientas/incidencias" />
          </>
        )}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Movimientos (últimos 7 días)" Icon={History}>
          <MovimientosBar data={movimientosPorDia} isDark={isDark} />
        </Panel>
        <Panel title="Productos por categoría" Icon={Boxes}>
          <CategoriasDonut data={productosPorCategoria} isDark={isDark} />
        </Panel>
      </div>

      {/* Paneles inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Solicitudes pendientes */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              Solicitudes pendientes
              {solicitudesPendientes.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {solicitudesPendientes.length}
                </span>
              )}
            </span>
          }
          action={
            solicitudesPendientes.length > 0 && (
              <Link to="/inventario/solicitudes" className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-0.5">
                Ver todas <ChevronRight size={12} />
              </Link>
            )
          }
        >
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {solicitudesPendientes.length ? solicitudesPendientes.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                <div className="h-8 w-8 rounded-full inline-flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                  <ClipboardList size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-900 dark:text-ink-100 truncate" title={s.solicitante_nombre}>
                    {s.solicitante_nombre}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">
                    #{s.id} · {s.proyecto || 'Sin proyecto'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-ink-500 dark:text-ink-400">{fmtFecha(s.fecha_creacion)}</span>
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300">
                      {s.detalles?.length || 0} ítems
                    </span>
                  </div>
                </div>
              </li>
            )) : (
              <li className="flex flex-col items-center text-center text-xs text-ink-500 dark:text-ink-400 py-8">
                <CheckCircle2 size={28} className="text-emerald-500 mb-2" />
                Sin solicitudes pendientes.
              </li>
            )}
          </ul>
        </Panel>

        {/* Productos bajo mínimo */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-rose-500" />
              Productos bajo mínimo
              {bajoMinimo.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  {bajoMinimo.length}
                </span>
              )}
            </span>
          }
          action={
            bajoMinimo.length > 0 && (
              <Link to="/inventario/movimientos" className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-0.5">
                Reabastecer <ChevronRight size={12} />
              </Link>
            )
          }
        >
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {bajoMinimo.length ? bajoMinimo.slice(0, 8).map((p, idx) => (
              <li key={idx} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                <div className="h-8 w-8 rounded-full inline-flex items-center justify-center flex-shrink-0 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                  <AlertTriangle size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-900 dark:text-ink-100 uppercase truncate" title={p.descripcion}>
                    {p.descripcion}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 font-mono">{p.codigo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-ink-500 dark:text-ink-400">
                      Mín: {p.stock_minimo} {p.unidad}
                    </span>
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                      ACTUAL: {p.stock_actual}
                    </span>
                  </div>
                </div>
              </li>
            )) : (
              <li className="flex flex-col items-center text-center text-xs text-ink-500 dark:text-ink-400 py-8">
                <CheckCircle2 size={28} className="text-emerald-500 mb-2" />
                Inventario saludable.
              </li>
            )}
          </ul>
        </Panel>

        {/* Movimientos recientes */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <History size={14} className="text-sky-500" />
              Movimientos recientes
            </span>
          }
          action={
            movimientosRecientes.length > 0 && (
              <Link to="/inventario/movimientos" className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-0.5">
                Ver historial <ChevronRight size={12} />
              </Link>
            )
          }
        >
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {movimientosRecientes.length ? movimientosRecientes.map((m) => {
              const prod = productosById[m.producto_id]
              const sign = m.tipo === 'SALIDA' ? '-' : m.tipo === 'ENTRADA' ? '+' : ''
              const ToneIcon = m.tipo === 'ENTRADA' ? TrendingUp : m.tipo === 'SALIDA' ? TrendingDown : ArrowRightLeft
              return (
                <li key={m.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                  <div className={`h-8 w-8 rounded-full inline-flex items-center justify-center flex-shrink-0 ${TIPO_STYLE[m.tipo] || 'bg-ink-100 text-ink-600'}`}>
                    <ToneIcon size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink-900 dark:text-ink-100 truncate" title={prod?.descripcion}>
                      {prod?.descripcion || `Producto #${m.producto_id}`}
                    </p>
                    <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">
                      <span className={`font-bold ${m.tipo === 'SALIDA' ? 'text-rose-600' : m.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {sign}{m.cantidad} {prod?.unidad || ''}
                      </span>
                      {' · '}{m.tipo}
                    </p>
                    <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-0.5">{fmtFecha(m.fecha)}</p>
                  </div>
                </li>
              )
            }) : (
              <li className="flex flex-col items-center text-center text-xs text-ink-500 dark:text-ink-400 py-8">
                <History size={28} className="opacity-30 mb-2" />
                Sin movimientos registrados.
              </li>
            )}
          </ul>
        </Panel>
      </div>

      {/* Accesos rápidos */}
      <Panel title="Accesos rápidos" Icon={Boxes}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Catálogo',    icon: PackageSearch,  to: '/inventario/catalogo',     tone: 'blue' },
            { name: 'Almacenes',   icon: Boxes,          to: '/inventario/almacenes',    tone: 'green' },
            { name: 'Movimientos', icon: ArrowRightLeft, to: '/inventario/movimientos',  tone: 'purple' },
            { name: 'Solicitudes', icon: ClipboardList,  to: '/inventario/solicitudes',  tone: 'orange' },
            { name: 'Pedir',       icon: Send,           to: '/inventario/mis-pedidos',  tone: 'blue' },
            { name: 'Escáner',     icon: ScanLine,       to: '/inventario/scanner',      tone: 'orange' },
          ].map((mod) => {
            const tones = {
              blue:   'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200 ring-1 ring-sky-300/40 dark:ring-sky-400/30',
              green:  'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200 ring-1 ring-emerald-300/40 dark:ring-emerald-400/30',
              purple: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200 ring-1 ring-violet-300/40 dark:ring-violet-400/30',
              orange: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200 ring-1 ring-amber-300/40 dark:ring-amber-400/30',
            }
            const Icon = mod.icon
            return (
              <Link
                key={mod.to}
                to={mod.to}
                className="group flex flex-col items-center gap-2 p-3 rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/50 hover:bg-ink-100 dark:hover:bg-ink-800 text-center transition-colors"
              >
                <div className={`h-10 w-10 rounded-lg inline-flex items-center justify-center ${tones[mod.tone]}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-300 group-hover:text-ink-900 dark:group-hover:text-ink-100">
                  {mod.name}
                </span>
              </Link>
            )
          })}
        </div>
      </Panel>

      <div className="text-center pt-4 text-xs text-ink-400 dark:text-ink-500 border-t border-ink-200 dark:border-ink-700">
        Skilled © {new Date().getFullYear()}
      </div>
    </div>
  )
}
