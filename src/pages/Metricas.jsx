import { useEffect, useMemo, useState, memo } from 'react'
import toast from 'react-hot-toast'
import {
  BarChart3, Users, IdCard, Factory, FileBadge,
  AlertTriangle, Clock, Search,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  PageHeader, Skeleton, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../components/ui'
import { useTheme } from '../context/ThemeContext'
import { getMetricas } from '../api/metricas'
import { extractApiError } from '../utils/apiError'
import { useResource } from '../hooks/useResource'

// Paleta sobria 5 tonos (igual al Dashboard) en lugar de 12 saturados. El
// neutro slate se reutiliza al rotar para evitar ruido visual cuando hay
// muchas barras.
const CHART_COLORS = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#64748b', // slate-500 — neutro
]

// StatCard sobrio: chip neutro slate, sin borde lateral colorido. Mismo
// patrón que el Dashboard para que las dos páginas se sientan parte del
// mismo producto.
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

const ChartTooltip = memo(function ChartTooltip({ active, payload, isDark, labelKey, suffix }) {
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
      <p className="font-semibold mb-0.5">
        {payload[0].payload[labelKey] || payload[0].name}
      </p>
      <p className="tabular-nums">
        <span className="text-ink-500">{payload[0].name}: </span>
        <strong>{payload[0].value}</strong> {suffix}
      </p>
    </div>
  )
})

const PlantasBar = memo(function PlantasBar({ data, isDark }) {
  if (!data?.length) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin credenciales de planta registradas.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={320} debounce={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
        <XAxis
          dataKey="planta"
          tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
        <Tooltip content={<ChartTooltip isDark={isDark} labelKey="planta" suffix="empleados" />} cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} isAnimationActive={false} />
        <Bar dataKey="total" name="Empleados" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

const DC3Donut = memo(function DC3Donut({ con, sin, isDark }) {
  const total = con + sin
  if (total === 0) {
    return <p className="text-sm text-ink-500 italic text-center py-12">Sin trabajadores activos.</p>
  }
  const data = [
    { label: 'Con DC3', value: con,  color: '#10b981' },
    { label: 'Sin DC3', value: sin, color: '#94a3b8' },
  ]
  return (
    <ResponsiveContainer width="100%" height={320} debounce={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          stroke={isDark ? '#0f172a' : '#ffffff'}
          strokeWidth={3}
          isAnimationActive={false}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0]
            const pct = total > 0 ? Math.round((p.value / total) * 100) : 0
            return (
              <div
                className="rounded-md px-3 py-2 text-xs shadow-elevated border"
                style={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
              >
                <p className="font-semibold mb-0.5">{p.payload.label}</p>
                <p className="tabular-nums">
                  <strong>{p.value}</strong>{' '}
                  <span className="text-ink-500">({pct}%)</span>
                </p>
              </div>
            )
          }}
          isAnimationActive={false}
        />
        <Legend
          iconType="circle"
          verticalAlign="bottom"
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})

function EstadoBadge({ estado }) {
  if (estado === 'Vigente') return <Badge tone="success">{estado}</Badge>
  if (estado === 'Vencida' || estado === 'Vencido') return <Badge tone="danger">{estado}</Badge>
  return <Badge tone="neutral">{estado}</Badge>
}

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function Metricas() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [activePlanta, setActivePlanta] = useState(null)
  const [searchPlanta, setSearchPlanta] = useState('')
  const [searchDC3, setSearchDC3] = useState('')

  const {
    data,
    loading,
    error,
  } = useResource(
    'metricas',
    () => getMetricas(),
    { staleMs: 120_000, invalidateOn: ['empleado:changed', 'credencial:changed'] },
  )

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar métricas'))
  }, [error])

  useEffect(() => {
    if (!activePlanta && data?.plantas?.length) {
      setActivePlanta(data.plantas[0].planta)
    }
  }, [data, activePlanta])

  const totales = data?.totales || {}
  const plantas = data?.plantas || []
  const detallePlantas = data?.detalle_plantas || {}
  const detalleDC3 = data?.detalle_dc3 || []

  const trabPlantaActiva = useMemo(() => {
    const lista = detallePlantas[activePlanta] || []
    const q = searchPlanta.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((t) =>
      String(t.no_empleado).includes(q) ||
      t.nombre?.toLowerCase().includes(q) ||
      t.puesto?.toLowerCase().includes(q) ||
      String(t.credencial_id || '').toLowerCase().includes(q)
    )
  }, [detallePlantas, activePlanta, searchPlanta])

  const filteredDC3 = useMemo(() => {
    const q = searchDC3.trim().toLowerCase()
    if (!q) return detalleDC3
    return detalleDC3.filter((t) =>
      String(t.no_empleado).includes(q) ||
      t.nombre?.toLowerCase().includes(q) ||
      t.puesto?.toLowerCase().includes(q)
    )
  }, [detalleDC3, searchDC3])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Métricas"
        description="Visión general de credenciales por planta y permisos DC3 del personal activo."
        actions={
          <span className="text-[11px] text-ink-500 inline-flex items-center gap-1.5">
            <Clock size={12} /> Datos en tiempo real
          </span>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Empleados activos"        value={totales.empleados_activos ?? 0} Icon={Users} />
        <StatCard label="Con credencial de planta" value={totales.con_credencial ?? 0}    Icon={IdCard} />
        <StatCard label="Plantas activas"          value={totales.total_plantas ?? 0}     Icon={Factory} />
        <StatCard label="Con permiso DC3"          value={totales.con_dc3 ?? 0}           Icon={FileBadge} />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Empleados por planta" Icon={Factory}>
          <PlantasBar data={plantas} isDark={isDark} />
        </Panel>
        <Panel title="Cobertura de permisos DC3" Icon={FileBadge}>
          <DC3Donut con={totales.con_dc3 ?? 0} sin={totales.sin_dc3 ?? 0} isDark={isDark} />
        </Panel>
      </div>

      {/* Detalle por planta */}
      <Panel title="Detalle por planta" Icon={Factory}>
        {plantas.length === 0 ? (
          <p className="text-sm text-ink-500 italic py-6 text-center">No hay credenciales de planta registradas.</p>
        ) : (
          <>
            {/* Tabs de plantas */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {plantas.map((p) => {
                const isActive = p.planta === activePlanta
                return (
                  <button
                    key={p.planta}
                    type="button"
                    onClick={() => setActivePlanta(p.planta)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 border-ink-200 dark:border-ink-700 hover:border-brand-400'
                    }`}
                  >
                    {p.planta}
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'
                    }`}>{p.total}</span>
                  </button>
                )
              })}
            </div>

            {/* Buscador */}
            <div className="relative max-w-sm mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar en esta planta..."
                value={searchPlanta}
                onChange={(e) => setSearchPlanta(e.target.value)}
                className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            {/* Tabla */}
            {trabPlantaActiva.length === 0 ? (
              <p className="text-sm text-ink-500 italic py-6 text-center">Sin resultados para los filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TH>No. Emp.</TH>
                    <TH>Nombre</TH>
                    <TH>Puesto</TH>
                    <TH>ID Credencial</TH>
                    <TH>Caducidad</TH>
                    <TH>Estado</TH>
                  </THead>
                  <TBody>
                    {trabPlantaActiva.map((t, idx) => (
                      <TR key={`${activePlanta}-${t.no_empleado}-${idx}`}>
                        <TD className="font-mono font-semibold text-brand-700 dark:text-brand-300">{t.no_empleado}</TD>
                        <TD className="font-medium">{t.nombre}</TD>
                        <TD>{t.puesto}</TD>
                        <TD>
                          <code className="text-xs px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200">
                            {t.credencial_id}
                          </code>
                        </TD>
                        <TD>{fmtFecha(t.fecha_caducidad)}</TD>
                        <TD><EstadoBadge estado={t.estado_cred} /></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Detalle DC3 */}
      <Panel
        title="Empleados con permiso DC3"
        Icon={FileBadge}
        action={
          detalleDC3.length > 0 && (
            <span className="text-[11px] text-ink-500">
              {detalleDC3.length} total{detalleDC3.length !== 1 ? 'es' : ''}
            </span>
          )
        }
      >
        {detalleDC3.length === 0 ? (
          <div className="flex flex-col items-center text-center text-sm text-ink-500 dark:text-ink-400 py-8">
            <AlertTriangle size={28} className="text-amber-400 mb-2" />
            No hay empleados con Permiso DC3 registrado.
          </div>
        ) : (
          <>
            <div className="relative max-w-sm mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar empleado..."
                value={searchDC3}
                onChange={(e) => setSearchDC3(e.target.value)}
                className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>

            {filteredDC3.length === 0 ? (
              <p className="text-sm text-ink-500 italic py-6 text-center">Sin resultados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TH>No. Emp.</TH>
                    <TH>Nombre</TH>
                    <TH>Puesto</TH>
                    <TH>Vigencia</TH>
                    <TH>Estado</TH>
                  </THead>
                  <TBody>
                    {filteredDC3.map((t, idx) => (
                      <TR key={`${t.no_empleado}-${idx}`}>
                        <TD className="font-mono font-semibold text-brand-700 dark:text-brand-300">{t.no_empleado}</TD>
                        <TD className="font-medium">{t.nombre}</TD>
                        <TD>{t.puesto}</TD>
                        <TD>{fmtFecha(t.fecha_fin)}</TD>
                        <TD><EstadoBadge estado={t.estado} /></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
