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
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Card, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { obtenerDashboard } from '../api/dashboard'
import { extractApiError } from '../utils/apiError'
import { useResource } from '../hooks/useResource'
import AvatarFoto from '../components/empleados/AvatarFoto'

// Paleta sobria tipo dashboard SaaS: 5 tonos discretos en lugar de 10
// saturados. Reduce el ruido visual cuando hay muchos slices/bars.
const CHART_COLORS = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#64748b', // slate-500 — neutro para el resto
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// StatCard estilo SaaS sobrio: tarjeta blanca con chip neutro monocromo. El
// valor numérico es el protagonista; el icono distingue la métrica sin
// recurrir a color.
function StatCard({ label, value, Icon }) {
  return (
    <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-3xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1 leading-none">{value}</p>
      </div>
    </div>
  )
}

const ChartTooltip = memo(function ChartTooltip({ active, payload, isDark }) {
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
      <p className="font-semibold mb-0.5">{payload[0].name || payload[0].payload.label}</p>
      <p className="tabular-nums">
        <span className="text-ink-500">Empleados: </span>
        <strong>{payload[0].value}</strong>
      </p>
    </div>
  )
})

const ProyectosDonut = memo(function ProyectosDonut({ data, isDark }) {
  if (!data?.length) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin asignaciones registradas</p>
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
        <Tooltip content={<ChartTooltip isDark={isDark} />} isAnimationActive={false} />
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

const PuestosBar = memo(function PuestosBar({ data, isDark }) {
  if (!data?.length) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin puestos asignados</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280} debounce={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
        />
        <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} isAnimationActive={false} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
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

function Panel({ title, Icon, action, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-ink-100 dark:border-ink-800/80">
        <div className="flex items-center gap-2 text-ink-800 dark:text-ink-200 font-semibold text-sm">
          {Icon && <Icon size={16} className="text-ink-400 dark:text-ink-500" strokeWidth={2} />}
          {title}
        </div>
        {action}
      </div>
      {children}
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
  const puestosData = useMemo(() => data?.empleados_por_puesto?.slice(0, 12) || [], [data])

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
        <StatCard label="Trab. activos" value={stats?.total_trabajadores ?? 0} Icon={UsersRound} />
        <StatCard label="Nuevos este mes" value={stats?.nuevos_ingresos ?? 0} Icon={TrendingUp} />
        <StatCard label="Total proyectos" value={stats?.total_proyectos ?? 0} Icon={FolderKanban} />
        <StatCard label="Proy. activos" value={stats?.proyectos_activos ?? 0} Icon={Activity} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Empleados por proyecto / área" Icon={FolderOpen}>
          <ProyectosDonut data={proyectosData} isDark={isDark} />
        </Panel>
        <Panel title="Empleados por puesto principal" Icon={Briefcase}>
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
