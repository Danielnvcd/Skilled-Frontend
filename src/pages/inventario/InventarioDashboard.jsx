import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PackageSearch, Boxes, ScanLine, ArrowRightLeft, Send, ClipboardList,
  AlertTriangle, Package, TrendingUp, TrendingDown, Clock, ChevronRight,
  History, CheckCircle2, Wrench, Hammer, Settings2,
} from 'lucide-react'
import { Skeleton } from '../../components/ui'
import { DonutCorporativo, BarrasCorporativas } from '../../components/charts/CorporateCharts'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  getCategoriasResumen, getProductosBajoMinimo, getMovimientos, getSolicitudes,
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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// StatCard corporativo idéntico al del Dashboard admin: chip neutro monocromo
// + número dominante + drill-down con ChevronRight (regla ERP: ningún KPI sin
// clic). Mismo `h-12 w-12 rounded-lg` para que ambas páginas se sientan parte
// del mismo producto.
function StatCard({ label, value, Icon, to }) {
  const inner = (
    <>
      <div className="h-9 w-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400 truncate">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-0.5 leading-none">{value}</p>
      </div>
    </>
  )
  const base = 'bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-3.5 flex items-center gap-3'
  if (!to) return <div className={base}>{inner}</div>
  return (
    <Link
      to={to}
      title={`Ver ${typeof label === 'string' ? label.toLowerCase() : ''}`}
      className={`${base} group hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all`}
    >
      {inner}
      <ChevronRight size={14} className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
    </Link>
  )
}

// Panel corporativo idéntico al del Dashboard admin: soporta subtítulo y
// `bodyClassName` para centrar gráficas. Header con icono monocromo slate.
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
        className="flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-800 dark:bg-brand-600 text-white py-10 active:bg-brand-900 transition-colors"
      >
        <ScanLine size={48} strokeWidth={1.5} />
        <span className="text-lg font-semibold">Escanear QR</span>
        <span className="text-xs text-white/80">Estante, producto o herramienta</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/inventario/bajo-minimo"
          className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 active:bg-ink-50 dark:active:bg-ink-800 transition-colors"
        >
          <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400">
            <AlertTriangle size={16} strokeWidth={1.8} />
            <span className="text-[10px] uppercase font-semibold tracking-wider">Bajo mínimo</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1">{bajoMinimo.length}</p>
        </Link>
        <Link
          to="/inventario/solicitudes"
          className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 active:bg-ink-50 dark:active:bg-ink-800 transition-colors"
        >
          <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400">
            <ClipboardList size={16} strokeWidth={1.8} />
            <span className="text-[10px] uppercase font-semibold tracking-wider">Solicitudes</span>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 mt-1">{solicitudesPend}</p>
          <p className="text-[10px] text-ink-500 mt-0.5">pendientes</p>
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold px-1">Atajos</p>
        <Link to="/inventario/catalogo" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <Package size={18} className="text-ink-500 dark:text-ink-400" strokeWidth={1.8} />
          <span className="text-sm font-medium flex-1">Catálogo</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/inventario/movimientos/nuevo" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <ArrowRightLeft size={18} className="text-ink-500 dark:text-ink-400" strokeWidth={1.8} />
          <span className="text-sm font-medium flex-1">Registrar movimiento</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
        <Link to="/inventario/solicitudes" className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-3 active:bg-ink-50 dark:active:bg-ink-800">
          <ClipboardList size={18} className="text-ink-500 dark:text-ink-400" strokeWidth={1.8} />
          <span className="text-sm font-medium flex-1">Solicitudes</span>
          <ChevronRight size={16} className="text-ink-400" />
        </Link>
      </div>
    </div>
  )
}

// ── Dashboard completo (PC) ────────────────────────────────────────────────

// Selector de variante. Existe para que la versión de escritorio sea un
// componente aparte: antes el `if (isMobileDevice) return <MobileInventarioHome/>`
// vivía dentro del mismo componente, POR ENCIMA de sus ~12 hooks. Hoy no
// reventaba porque `useIsMobileDevice` deriva del user-agent y nunca cambia de
// valor, pero bastaba con volverlo reactivo (un matchMedia, un resize) para que
// el conteo de hooks cambiara entre renders y React abortara la pantalla.
export default function InventarioDashboard() {
  const isMobileDevice = useIsMobileDevice()
  return isMobileDevice ? <MobileInventarioHome /> : <DesktopInventarioDashboard />
}

function DesktopInventarioDashboard() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 5 fuentes con namespaces compartidos por otras páginas de inventario
  // (Catalogo, BajoMinimo, Movimientos, Solicitudes, Herramientas/*). Cuando
  // el backend emite los eventos correspondientes, todas las vistas que
  // dependan del namespace se invalidan a la vez.
  // Resumen por categoría (conteos) en vez del catálogo completo: con miles de
  // productos no podemos bajarlos solo para el chart y el total.
  const { data: rawResumen, error: errProd } = useResource(
    ['categorias-resumen'],
    () => getCategoriasResumen(),
    { staleMs: 60_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
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
  const resumenCategorias = rawResumen ?? []
  const totalProductos = resumenCategorias.reduce((a, c) => a + (c.total || 0), 0)
  const bajoMinimo = rawBajoMinimo ?? []
  const movimientos = rawMovimientos ?? []
  const solicitudes = rawSolicitudes ?? []
  const herrStats = herrStatsData ?? null

  // Spinner mientras llega el primer set (cualquiera de las 5 fuentes).
  const loading =
    !rawResumen && !rawBajoMinimo && !rawMovimientos && !rawSolicitudes && !herrStatsData

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

  // Distribución de movimientos por tipo (ventana cargada) — ranking para las
  // barras corporativas. Misma forma de datos { label, value } que el admin.
  const movimientosPorTipo = useMemo(() => {
    const acc = { ENTRADA: 0, SALIDA: 0, AJUSTE: 0, TRASPASO: 0 }
    movimientos.forEach((m) => { if (acc[m.tipo] != null) acc[m.tipo]++ })
    const LABELS = { ENTRADA: 'Entradas', SALIDA: 'Salidas', AJUSTE: 'Ajustes', TRASPASO: 'Traspasos' }
    return Object.entries(acc)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: LABELS[k], value: v }))
  }, [movimientos])

  // Distribución de productos por categoría (top 8 + "Otras") — desde el resumen
  // server-side, que ya trae el conteo por categoría.
  const productosPorCategoria = useMemo(() => {
    const arr = resumenCategorias
      .map((c) => ({ label: c.nombre || 'Sin categoría', value: c.total || 0 }))
      .filter((x) => x.value > 0)
    arr.sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const top = arr.slice(0, 7)
    const restoValor = arr.slice(7).reduce((acc, x) => acc + x.value, 0)
    return [...top, { label: 'Otras', value: restoValor }]
  }, [resumenCategorias])

  const movimientosRecientes = useMemo(
    () => movimientos.slice(0, 8),
    [movimientos]
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
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
    <div className="space-y-6">
      {/* Header sin caja: título + subtítulo + fecha */}
      <div className="flex items-end justify-between gap-3 flex-wrap pt-1">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100 tracking-tight">
            Actividad y auditoría
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1.5">
            Indicadores, movimientos y solicitudes de inventario, almacenes y herramientas.
          </p>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400 tabular-nums">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Productos activos"      value={totalProductos}               Icon={Package}        to="/inventario/catalogo" />
        <StatCard label="Solicitudes pendientes" value={solicitudesPendientes.length}  Icon={ClipboardList}  to="/inventario/solicitudes" />
        <StatCard label="Bajo mínimo"            value={bajoMinimo.length}             Icon={AlertTriangle}  to="/inventario/movimientos" />
        <StatCard label="Movimientos hoy"        value={movimientosHoy}                Icon={ArrowRightLeft} to="/inventario/movimientos" />
        {herrStats && (
          <>
            <StatCard label="Herramientas activas"
                      value={herrStats.total_herramientas}
                      Icon={Wrench} to="/inventario/herramientas" />
            <StatCard label="Unidades asignadas"
                      value={herrStats.unidades_por_estado?.ASIGNADA || 0}
                      Icon={Hammer} to="/inventario/herramientas/asignaciones" />
            <StatCard label="En mantenimiento"
                      value={herrStats.unidades_por_estado?.EN_MANTENIMIENTO || 0}
                      Icon={Settings2} to="/inventario/herramientas/mantenimientos" />
            <StatCard label="Incidencias y bajas"
                      value={(herrStats.incidencias_abiertas || 0) + (herrStats.solicitudes_baja_pendientes || 0)}
                      Icon={AlertTriangle} to="/inventario/herramientas/incidencias" />
          </>
        )}
      </div>

      {/* Gráficas corporativas — mismo lenguaje visual que el Dashboard admin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Productos por categoría"
          subtitle={`${productosPorCategoria.length} ${productosPorCategoria.length === 1 ? 'categoría' : 'categorías'} · ${totalProductos} productos`}
          Icon={Boxes}
          bodyClassName="flex items-center justify-center"
        >
          <DonutCorporativo
            data={productosPorCategoria}
            isDark={isDark}
            valueLabel="Productos"
            centerLabel="Productos"
            emptyText="Sin productos registrados"
          />
        </Panel>
        <Panel
          title="Movimientos por tipo"
          subtitle={`${movimientos.length} registros recientes`}
          Icon={History}
        >
          <BarrasCorporativas
            data={movimientosPorTipo}
            isDark={isDark}
            valueLabel="Movimientos"
            emptyText="Sin movimientos registrados"
            gradientId="inv-mov-gradient"
          />
        </Panel>
      </div>

      {/* Paneles inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Solicitudes pendientes */}
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} className="text-ink-400 dark:text-ink-500" />
              Solicitudes pendientes
              {solicitudesPendientes.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
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
              <AlertTriangle size={14} className="text-ink-400 dark:text-ink-500" />
              Productos bajo mínimo
              {bajoMinimo.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
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
              <History size={14} className="text-ink-400 dark:text-ink-500" />
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
              const prod = { descripcion: m.producto_descripcion, unidad: m.producto_unidad }
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

      {/* Accesos rápidos — chips neutros, mismo lenguaje que el Dashboard. */}
      <Panel title="Accesos rápidos" Icon={Boxes}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Catálogo',    icon: PackageSearch,  to: '/inventario/catalogo' },
            { name: 'Almacenes',   icon: Boxes,          to: '/inventario/almacenes' },
            { name: 'Movimientos', icon: ArrowRightLeft, to: '/inventario/movimientos' },
            { name: 'Solicitudes', icon: ClipboardList,  to: '/inventario/solicitudes' },
            { name: 'Pedir',       icon: Send,           to: '/inventario/mis-pedidos' },
            { name: 'Escáner',     icon: ScanLine,       to: '/inventario/scanner' },
          ].map((mod) => {
            const Icon = mod.icon
            return (
              <Link
                key={mod.to}
                to={mod.to}
                className="group flex flex-col items-center gap-2 p-3 rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm text-center transition-all"
              >
                <div className="h-10 w-10 rounded-lg inline-flex items-center justify-center bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200 group-hover:bg-ink-200 dark:group-hover:bg-ink-700 transition-colors">
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-300 group-hover:text-ink-900 dark:group-hover:text-ink-100">
                  {mod.name}
                </span>
              </Link>
            )
          })}
        </div>
      </Panel>

      <div className="text-center pt-4 text-xs text-ink-400 dark:text-ink-500 border-t border-ink-200 dark:border-ink-800">
        Skilled © {new Date().getFullYear()}
      </div>
    </div>
  )
}
