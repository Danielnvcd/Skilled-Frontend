import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Briefcase, History, Cake, AlertTriangle, FolderOpen,
  ShieldAlert, FileText, IdCard, CheckCircle2, ChevronRight,
  UserRoundPlus, UsersRound, FolderKanban, FolderCheck, LayoutGrid, CalendarClock,
  ReceiptText, HandCoins, ClipboardList,
} from 'lucide-react'
import { Card, PageHeader, Skeleton } from '../components/ui'
import { DonutCorporativo, BarrasCorporativas } from '../components/charts/CorporateCharts'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useTheme } from '../context/ThemeContext'
import { obtenerDashboard } from '../api/dashboard'
import { extractApiError } from '../utils/apiError'
import { useResource } from '../hooks/useResource'
import AvatarFoto from '../components/empleados/AvatarFoto'

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

// ChartTooltip, donut y barras viven en components/charts/CorporateCharts.jsx
// (compartidos con Métricas).

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
    // proyecto, o prenómina guardada/cerrada — esta última mueve el deep-link
    // del acceso rápido "Prenómina"). La "actividad reciente" NO invalida
    // aquí: cada `bitacora:new` refetcheaba todo el dashboard — ahora el
    // panel inserta el evento push directamente (ver liveActividad abajo).
    // Cumpleaños y docs por vencer se actualizan al revalidateOnFocus o al
    // expirar el staleMs.
    { staleMs: 120_000, invalidateOn: ['empleado:changed', 'proyecto:changed', 'prenomina:changed'] },
  )

  // Feed en vivo de auditoría: se siembra con el snapshot del endpoint y cada
  // `bitacora:new` (push post-commit) se antepone al instante, sin refetch.
  const { on } = useSocket()
  const [liveActividad, setLiveActividad] = useState([])
  useEffect(() => {
    setLiveActividad(data?.actividad_reciente || [])
  }, [data])
  useEffect(() => {
    return on('bitacora:new', (log) => {
      if (!log?.id) return
      setLiveActividad((prev) => (
        prev.some((l) => l.id === log.id) ? prev : [log, ...prev].slice(0, 5)
      ))
    })
  }, [on])

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el dashboard'))
  }, [error])

  const stats = data?.stats

  // Deep-link de Prenómina: el backend reporta la semana accionable (la más
  // antigua con reportes cerrados sin aprobar). Con pendiente vamos directo a
  // /prenomina/:fecha — la lista solo cuando no hay nada que hacer.
  const prenoPend = data?.prenomina_pendiente
  const prenomina = prenoPend
    ? {
        to: `/prenomina/${prenoPend.fecha_str}`,
        hint: `${prenoPend.estado === 'ABIERTA' ? 'Continuar' : 'Calcular'} semana del ${fmtFecha(prenoPend.fecha_str)}`,
      }
    : { to: '/prenomina', hint: 'Generar / cerrar' }
  const proyectosData = useMemo(() => data?.empleados_por_proyecto || [], [data])
  const puestosData = useMemo(() => data?.empleados_por_puesto?.slice(0, 10) || [], [data])

  // Cumpleaños ordenados por día ascendente; `diaHoy` marca el festejado.
  const diaHoy = new Date().getDate()
  const cumpleañeros = useMemo(
    () => [...(data?.cumpleañeros || [])].sort((a, b) => (a.dia || 0) - (b.dia || 0)),
    [data],
  )

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
          <QuickAccessCard to={prenomina.to} Icon={ReceiptText} label="Prenómina" hint={prenomina.hint} />
          <QuickAccessCard to="/prestamos" Icon={HandCoins} label="Préstamos" hint="Otorgar / abonar" />
          <QuickAccessCard to="/bitacora" Icon={ClipboardList} label="Bitácora" hint="Auditoría" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Trab. activos" value={stats?.total_trabajadores ?? 0} Icon={UsersRound} to="/empleados" />
        {/* Nuevos este mes → la lista ordenada por ingreso desc deja arriba justo a esos. */}
        <StatCard label="Nuevos este mes" value={stats?.nuevos_ingresos ?? 0} Icon={UserRoundPlus} to="/empleados?sort=ingreso&dir=desc" />
        <StatCard label="Total proyectos" value={stats?.total_proyectos ?? 0} Icon={FolderKanban} to="/proyectos" />
        <StatCard label="Proy. activos" value={stats?.proyectos_activos ?? 0} Icon={FolderCheck} to="/proyectos" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Empleados por proyecto / área"
          subtitle={`${proyectosData.length} ${proyectosData.length === 1 ? 'asignación' : 'asignaciones'}`}
          Icon={FolderOpen}
          bodyClassName="flex items-center justify-center"
        >
          {/* El total del centro son ASIGNACIONES, no empleados únicos: un
              trabajador en dos proyectos cuenta en ambas rebanadas (M:N). */}
          <DonutCorporativo
            data={proyectosData}
            isDark={isDark}
            centerLabel="Asignaciones"
            emptyText="Sin asignaciones registradas"
          />
        </Panel>
        <Panel
          title="Empleados por puesto principal"
          subtitle={`Top ${puestosData.length} de la plantilla`}
          Icon={Briefcase}
        >
          <BarrasCorporativas data={puestosData} isDark={isDark} emptyText="Sin puestos asignados" />
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
            {liveActividad.length ? liveActividad.map((log) => {
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
            {cumpleañeros.length ? cumpleañeros.map((e) => {
              const fullName = `${e.nombre || ''} ${e.nombre_apellidos || ''}`.trim()
              const esHoy = e.dia === diaHoy
              return (
                <li key={e.id}>
                  <Link
                    to={`/empleados/${e.id}`}
                    className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors ${
                      esHoy
                        ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-inset ring-brand-200 dark:ring-brand-800/60 hover:bg-brand-100/70 dark:hover:bg-brand-900/30'
                        : 'hover:bg-ink-50 dark:hover:bg-ink-800/50'
                    }`}
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
                      <p className={`text-xs font-medium ${esHoy ? 'text-brand-700 dark:text-sky-300' : 'text-ink-500 dark:text-ink-400'}`}>
                        Día {e.dia}
                      </p>
                    </div>
                    {esHoy && (
                      <span className="flex-shrink-0 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-600 text-white">
                        HOY
                      </span>
                    )}
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
