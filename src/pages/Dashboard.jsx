import { useEffect, useState, useMemo, memo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Users, Briefcase, FolderOpen, Zap, History, Cake, AlertTriangle,
  ShieldAlert, FileText, IdCard, CheckCircle2, ChevronRight, Info,
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

function StatCard({ tone, label, value, Icon }) {
  const tones = {
    blue: {
      border: 'border-l-sky-500',
      iconWrap: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200 ring-1 ring-sky-300/50 dark:ring-sky-400/30',
    },
    green: {
      border: 'border-l-emerald-500',
      iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200 ring-1 ring-emerald-300/50 dark:ring-emerald-400/30',
    },
    purple: {
      border: 'border-l-violet-500',
      iconWrap: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200 ring-1 ring-violet-300/50 dark:ring-violet-400/30',
    },
    orange: {
      border: 'border-l-amber-500',
      iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200 ring-1 ring-amber-300/50 dark:ring-amber-400/30',
    },
  }
  const t = tones[tone]
  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-700 border-l-4 ${t.border} p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`h-12 w-12 rounded-full inline-flex items-center justify-center flex-shrink-0 ${t.iconWrap}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-ink-900 dark:text-ink-100 mt-0.5">{value}</p>
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
          Resumen general de la operación.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="blue" label="Trab. activos" value={stats?.total_trabajadores ?? 0} Icon={Users} />
        <StatCard tone="green" label="Nuevos este mes" value={stats?.nuevos_ingresos ?? 0} Icon={Briefcase} />
        <StatCard tone="purple" label="Total proyectos" value={stats?.total_proyectos ?? 0} Icon={FolderOpen} />
        <StatCard tone="orange" label="Proy. activos" value={stats?.proyectos_activos ?? 0} Icon={Zap} />
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
        >
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.actividad_reciente?.length ? data.actividad_reciente.map((log) => {
              const sospechoso = isSuspicious(log.action)
              return (
                <li
                  key={log.id}
                  className={`relative flex items-start gap-3 px-3 py-2.5 rounded-md ${
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
                </li>
              )
            }) : (
              <li className="text-xs italic text-ink-500 dark:text-ink-400">No hay actividad reciente registrada.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Cumpleaños del mes" Icon={Cake}>
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.cumpleañeros?.length ? data.cumpleañeros.map((e) => {
              const fullName = `${e.nombre || ''} ${e.nombre_apellidos || ''}`.trim()
              return (
                <li key={e.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
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
          <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {data?.docs_por_vencer?.length ? data.docs_por_vencer.map((item, idx) => {
              const ItemIcon = item.tipo === 'credencial' ? IdCard : FileText
              return (
                <li key={idx} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
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
