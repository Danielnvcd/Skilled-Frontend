import { useEffect, useState, useMemo, memo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Briefcase, History, Cake, AlertTriangle, FolderOpen,
  ShieldAlert, FileText, IdCard, CheckCircle2, ChevronRight,
  UserRoundPlus, UsersRound, FolderKanban, LayoutGrid, CalendarClock,
  ReceiptText, HandCoins, ClipboardList, TrendingUp, Activity,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts'
import { Card, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { obtenerDashboard } from '../api/dashboard'
import { extractApiError } from '../utils/apiError'
import { useResource } from '../hooks/useResource'
import AvatarFoto from '../components/empleados/AvatarFoto'

// Paleta monocromática corporativa: degradado de azul navy (brand) de oscuro
// a claro. Estilo enterprise SaaS — el orden importa: la primera categoría
// (la de mayor peso) recibe el tono más saturado.
const CHART_COLORS = [
  '#1f3554', // brand-800
  '#2b4870', // brand-700
  '#345a89', // brand-600
  '#4471a3', // brand-500
  '#688fbc', // brand-400
  '#9ab6d6', // brand-300
  '#c5d6e9', // brand-200
]
const BRAND_PRIMARY = '#345a89'   // brand-600
const BRAND_PRIMARY_DARK = '#688fbc' // brand-400 para modo oscuro

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// StatCard estilo SaaS sobrio: tarjeta blanca con chip neutro monocromo. El
// valor numérico es el protagonista; el icono distingue la métrica sin
// recurrir a color.
// `to` opcional convierte la tarjeta en drill-down: clic navega a la lista
// que explica el número (regla ERP: ningún KPI sin clic). El valor en sí se
// mantiene fresco por websocket vía el invalidateOn del useResource de arriba.
function StatCard({ label, value, Icon, to }) {
  const inner = (
    <>
      <div className="h-12 w-12 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-3xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1 leading-none">{value}</p>
      </div>
    </>
  )
  const base = 'bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-5 flex items-center gap-4'
  if (!to) return <div className={base}>{inner}</div>
  return (
    <Link
      to={to}
      title={`Ver ${label.toLowerCase()}`}
      className={`${base} group hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all`}
    >
      {inner}
      <ChevronRight size={16} className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
    </Link>
  )
}

const ChartTooltip = memo(function ChartTooltip({ active, payload, isDark, total }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : null
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-elevated border min-w-[160px]"
      style={{
        background: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
          style={{ background: payload[0].payload?.fill || payload[0].color || BRAND_PRIMARY }}
        />
        <p className="font-semibold truncate">{payload[0].name || payload[0].payload.label}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="text-ink-500 dark:text-ink-400">Empleados</span>
        <strong className="text-sm">{value}</strong>
      </div>
      {pct !== null && (
        <div className="flex items-baseline justify-between gap-3 tabular-nums mt-0.5">
          <span className="text-ink-500 dark:text-ink-400">Participación</span>
          <strong className="text-sm">{pct}%</strong>
        </div>
      )}
    </div>
  )
})

const ProyectosDonut = memo(function ProyectosDonut({ data, isDark }) {
  // Ordenar de mayor a menor para que el degradado navy refleje la jerarquía.
  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [data],
  )
  const total = useMemo(() => sorted.reduce((s, d) => s + (d.value || 0), 0), [sorted])

  const [hoverIdx, setHoverIdx] = useState(null)
  const [pinnedIdx, setPinnedIdx] = useState(null)
  const activeIdx = hoverIdx ?? pinnedIdx
  const activeItem = activeIdx != null ? sorted[activeIdx] : null
  const activePct = activeItem && total > 0 ? (activeItem.value / total) * 100 : null

  if (!sorted.length) {
    return <p className="text-sm text-ink-500 italic text-center py-10">Sin asignaciones registradas</p>
  }

  const toggle = (i) => setPinnedIdx((prev) => (prev === i ? null : i))

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      {/* Donut — más compacto, sin gap doble por strokeWidth+paddingAngle */}
      <div className="relative flex-shrink-0 w-[170px] h-[170px]">
        <ResponsiveContainer width="100%" height="100%" debounce={200}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={sorted}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={sorted.length > 1 ? 0.5 : 0}
              stroke={isDark ? '#0f172a' : '#ffffff'}
              strokeWidth={1}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={(_, i) => toggle(i)}
            >
              {sorted.map((_, i) => {
                const isActive = activeIdx === i
                const isDimmed = activeIdx != null && !isActive
                return (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={isDimmed ? 0.28 : 1}
                    style={{ cursor: 'pointer', transition: 'fill-opacity 150ms ease' }}
                  />
                )
              })}
            </Pie>
            <Tooltip content={<ChartTooltip isDark={isDark} total={total} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro: usa el diámetro interno (108px) para evitar desborde sobre el aro */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center justify-center text-center w-[108px]">
            {activeItem ? (
              <>
                <span className="text-[9px] uppercase tracking-wider font-medium text-ink-500 dark:text-ink-400 leading-tight line-clamp-2 px-1" title={activeItem.label}>
                  {activeItem.label}
                </span>
                <span className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none mt-1">
                  {activeItem.value}
                </span>
                <span className="text-[10px] tabular-nums font-medium text-brand-600 dark:text-sky-300 mt-0.5">
                  {activePct.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">{total}</span>
                <span className="text-[9px] uppercase tracking-wider font-medium text-ink-500 dark:text-ink-400 mt-1">Empleados</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda — al lado del donut en sm+, debajo en móvil. Ancho contenido (no flex-1) para que el grupo donut+leyenda quede centrado horizontalmente. */}
      <ul className="w-full sm:w-auto sm:max-w-[280px] sm:min-w-[200px] space-y-0.5 max-h-[170px] overflow-y-auto scrollbar-thin pr-1 min-w-0">
        {sorted.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          const isActive = activeIdx === i
          const isDimmed = activeIdx != null && !isActive
          return (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => toggle(i)}
                className={`w-full flex items-center gap-2 text-[11px] px-1.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-ink-100 dark:bg-ink-800'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
                } ${isDimmed ? 'opacity-50' : ''}`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm flex-shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="flex-1 truncate text-ink-700 dark:text-ink-300 text-left" title={item.label}>{item.label}</span>
                <span className="tabular-nums font-semibold text-ink-900 dark:text-ink-100">{item.value}</span>
                <span className="tabular-nums text-ink-500 dark:text-ink-400 w-9 text-right">{pct.toFixed(1)}%</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})

const PuestosBar = memo(function PuestosBar({ data, isDark }) {
  // Ordenado descendente para que las barras más largas estén arriba —
  // patrón estándar en dashboards corporativos.
  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [data],
  )
  const total = useMemo(() => sorted.reduce((s, d) => s + (d.value || 0), 0), [sorted])
  const primary = isDark ? BRAND_PRIMARY_DARK : BRAND_PRIMARY

  const [hoverIdx, setHoverIdx] = useState(null)

  if (!sorted.length) {
    return <p className="text-sm text-ink-500 italic text-center py-10">Sin puestos asignados</p>
  }

  // Altura por barra suficiente para que el texto Y (fontSize 11) no se encime.
  // 26px da ~13px de aire entre labels consecutivas.
  const height = Math.min(340, Math.max(220, sorted.length * 26 + 20))
  // Tick personalizado: envuelve a 2 líneas por palabras cuando el label
  // excede ~22 chars; corta con elipsis solo cuando la segunda línea no cabe.
  const renderYTick = ({ x, y, payload }) => {
    const raw = String(payload?.value ?? '')
    const MAX = 22
    let line1 = raw
    let line2 = ''
    if (raw.length > MAX) {
      const words = raw.split(' ')
      line1 = ''
      let rest = []
      for (const w of words) {
        const next = (line1 ? `${line1} ${w}` : w)
        if (next.length <= MAX) line1 = next
        else rest.push(w)
      }
      // Si la primera palabra ya excede MAX, recorta crudo
      if (!line1) {
        line1 = raw.slice(0, MAX - 1) + '…'
        line2 = ''
      } else {
        line2 = rest.join(' ')
        if (line2.length > MAX) line2 = line2.slice(0, MAX - 1) + '…'
      }
    }
    const fill = isDark ? '#cbd5e1' : '#334155'
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="end" fill={fill} fontSize={11}>
          {line2 ? (
            <>
              <tspan x={-6} dy="-0.25em">{line1}</tspan>
              <tspan x={-6} dy="1.15em">{line2}</tspan>
            </>
          ) : (
            <tspan x={-6} dy="0.355em">{line1}</tspan>
          )}
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 30, bottom: 4, left: 2 }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="puestos-bar-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={primary} stopOpacity={0.85} />
            <stop offset="100%" stopColor={primary} stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={renderYTick}
          width={150}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          content={<ChartTooltip isDark={isDark} total={total} />}
          cursor={{ fill: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(248,250,252,0.8)' }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="value"
          fill="url(#puestos-bar-gradient)"
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
          barSize={14}
          onMouseEnter={(_, i) => setHoverIdx(i)}
        >
          {sorted.map((_, i) => {
            const isDimmed = hoverIdx != null && hoverIdx !== i
            return (
              <Cell
                key={i}
                fillOpacity={isDimmed ? 0.3 : 1}
                style={{ cursor: 'pointer', transition: 'fill-opacity 150ms ease' }}
              />
            )
          })}
          <LabelList
            dataKey="value"
            position="right"
            style={{
              fill: isDark ? '#cbd5e1' : '#334155',
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

function isSuspicious(action) {
  const a = (action || '').toLowerCase()
  return /fallido|elimin[óo]|admin cambi[óo] contrase[ñn]a|bloqueado|denegado/.test(a)
}

function fmtRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(iso) {
  if (!iso) return ''
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

// Acceso rápido: tarjeta neutra con chip de icono monocromo (slate). Sin
// acentos de color para un look corporativo sobrio; el icono y el label son
// los elementos diferenciadores.
function QuickAccessCard({ to, Icon, label, hint }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 p-4 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all"
    >
      <div className="h-11 w-11 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200 group-hover:bg-ink-200 dark:group-hover:bg-ink-700 transition-colors">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">{label}</div>
        {hint && <div className="text-xs text-ink-500 dark:text-ink-400 leading-tight mt-1">{hint}</div>}
      </div>
      <ChevronRight size={16} className="text-ink-300 dark:text-ink-600 group-hover:text-ink-500 dark:group-hover:text-ink-400 flex-shrink-0 transition-colors" />
    </Link>
  )
}

function Panel({ title, subtitle, Icon, action, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-4 flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-ink-100 dark:border-ink-800/80 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-ink-800 dark:text-ink-200 font-semibold text-sm">
            {Icon && <Icon size={15} className="text-ink-400 dark:text-ink-500" strokeWidth={2} />}
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5 ml-[22px]">{subtitle}</div>
          )}
        </div>
        {action}
      </div>
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const {
    data,
    loading,
    error,
  } = useResource(
    'dashboard',
    () => obtenerDashboard(),
    // Endpoint agregado pesado. staleMs alto + invalidación selectiva: solo
    // refrescamos cuando hay cambios fuertes (alta/baja de empleado, nuevo
    // proyecto, o nueva entrada de auditoría para "actividad reciente").
    // Cumpleaños y docs por vencer se actualizan al revalidateOnFocus o al
    // expirar el staleMs.
    { staleMs: 120_000, invalidateOn: ['empleado:changed', 'proyecto:changed', 'bitacora:new'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el dashboard'))
  }, [error])

  const stats = data?.stats
  const proyectosData = useMemo(() => data?.empleados_por_proyecto || [], [data])
  const puestosData = useMemo(() => data?.empleados_por_puesto?.slice(0, 10) || [], [data])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome — header sin caja: solo título + subtítulo + fecha */}
      <div className="flex items-end justify-between gap-3 flex-wrap pt-1">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100 tracking-tight">
            {greeting()},{' '}
            <span className="text-brand-600 dark:text-sky-300 capitalize">
              {user?.full_name || user?.username}
            </span>!
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1.5">
            Resumen general de la operación.
          </p>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 tabular-nums">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Accesos rápidos */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">
            Accesos rápidos
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <QuickAccessCard to="/empleados/nuevo" Icon={UserRoundPlus} label="Nuevo empleado" hint="Alta de RRHH" />
          <QuickAccessCard to="/proyectos" Icon={LayoutGrid} label="Proyectos" hint="Crear / asignar" />
          <QuickAccessCard to="/horas" Icon={CalendarClock} label="Horas" hint="Reportes semanales" />
          <QuickAccessCard to="/prenomina" Icon={ReceiptText} label="Prenómina" hint="Generar / cerrar" />
          <QuickAccessCard to="/prestamos" Icon={HandCoins} label="Préstamos" hint="Otorgar / abonar" />
          <QuickAccessCard to="/bitacora" Icon={ClipboardList} label="Bitácora" hint="Auditoría" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Trab. activos" value={stats?.total_trabajadores ?? 0} Icon={UsersRound} to="/empleados" />
        {/* Nuevos este mes → la lista ordenada por ingreso desc deja arriba justo a esos. */}
        <StatCard label="Nuevos este mes" value={stats?.nuevos_ingresos ?? 0} Icon={TrendingUp} to="/empleados?sort=ingreso&dir=desc" />
        <StatCard label="Total proyectos" value={stats?.total_proyectos ?? 0} Icon={FolderKanban} to="/proyectos" />
        <StatCard label="Proy. activos" value={stats?.proyectos_activos ?? 0} Icon={Activity} to="/proyectos" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Empleados por proyecto / área"
          subtitle={`${proyectosData.length} ${proyectosData.length === 1 ? 'asignación' : 'asignaciones'}`}
          Icon={FolderOpen}
          bodyClassName="flex items-center justify-center"
        >
          <ProyectosDonut data={proyectosData} isDark={isDark} />
        </Panel>
        <Panel
          title="Empleados por puesto principal"
          subtitle={`Top ${puestosData.length} de la plantilla`}
          Icon={Briefcase}
        >
          <PuestosBar data={puestosData} isDark={isDark} />
        </Panel>
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Actividad reciente"
          Icon={History}
          action={
            <Link
              to="/bitacora"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-sky-300 hover:underline"
            >
              Ver bitácora <ChevronRight size={11} />
            </Link>
          }
        >
          <ul className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.actividad_reciente?.length ? data.actividad_reciente.map((log) => {
              const sospechoso = isSuspicious(log.action)
              return (
                <li key={log.id}>
                  <Link
                    to="/bitacora"
                    className={`relative flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors ${
                      sospechoso
                        ? 'bg-gradient-to-r from-red-50 to-transparent dark:from-red-900/20 dark:to-transparent border-l-4 border-red-500'
                        : ''
                    }`}
                  >
                    {sospechoso && (
                      <span className="absolute top-1 right-2 text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded shadow">
                        SOSPECHOSO
                      </span>
                    )}
                    <div className={`h-8 w-8 rounded-full inline-flex items-center justify-center flex-shrink-0 ${
                      sospechoso
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 animate-pulse'
                        : 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'
                    }`}>
                      {sospechoso ? <ShieldAlert size={14} /> : <History size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-snug break-words ${sospechoso ? 'text-red-700 dark:text-red-300 font-medium' : 'text-ink-800 dark:text-ink-200'}`}>
                        {log.action}
                      </p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-0.5">
                        {log.user} · {fmtRelative(log.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            }) : (
              <li className="text-xs italic text-ink-500 dark:text-ink-400 px-3 py-2">
                No hay actividad reciente registrada.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title="Cumpleaños del mes"
          Icon={Cake}
          action={
            <Link
              to="/empleados"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-sky-300 hover:underline"
            >
              Ver todos <ChevronRight size={11} />
            </Link>
          }
        >
          <ul className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.cumpleañeros?.length ? data.cumpleañeros.map((e) => {
              const fullName = `${e.nombre || ''} ${e.nombre_apellidos || ''}`.trim()
              return (
                <li key={e.id}>
                  <Link
                    to={`/empleados/${e.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors"
                  >
                    <AvatarFoto
                      id={e.id}
                      hasFoto={Boolean(e.foto_perfil)}
                      name={fullName}
                      size="sm"
                      lazy
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100 uppercase truncate">{fullName}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Día {e.dia}</p>
                    </div>
                  </Link>
                </li>
              )
            }) : (
              <li className="flex flex-col items-center text-center text-xs text-ink-500 dark:text-ink-400 py-8">
                <Cake size={28} className="opacity-30 mb-2" />
                Nadie cumple años este mes.
              </li>
            )}
          </ul>
        </Panel>

        <Panel
          title={<span className="inline-flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Documentos por vencer
          </span>}
        >
          <ul className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.docs_por_vencer?.length ? data.docs_por_vencer.map((item, idx) => {
              const ItemIcon = item.tipo === 'credencial' ? IdCard : FileText
              const href = item.trabajador_id ? `/empleados/${item.trabajador_id}` : '/empleados'
              return (
                <li key={idx}>
                  <Link
                    to={href}
                    className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors"
                  >
                    <div className={`h-8 w-8 rounded-full inline-flex items-center justify-center flex-shrink-0 ${
                      item.vencido
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      <ItemIcon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-900 dark:text-ink-100 uppercase truncate" title={item.nombre_trabajador}>
                        {item.nombre_trabajador}
                      </p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate" title={item.descripcion}>
                        {item.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-ink-500 dark:text-ink-400">{fmtFecha(item.fecha)}</span>
                        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          item.vencido
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {item.vencido ? 'VENCIDO' : 'POR VENCER'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            }) : (
              <li className="flex flex-col items-center text-center text-xs text-ink-500 dark:text-ink-400 py-8">
                <CheckCircle2 size={28} className="text-emerald-500 mb-2" />
                No hay documentos por vencer.
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <div className="text-center pt-4 text-xs text-ink-400 dark:text-ink-500 border-t border-ink-200 dark:border-ink-700">
        Skilled © {new Date().getFullYear()}
      </div>
    </div>
  )
}
