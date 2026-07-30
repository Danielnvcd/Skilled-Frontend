import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search, Warehouse, PackageCheck, Boxes, FolderOpen, LayoutGrid, ChevronDown, ChevronRight,
  ArrowLeftRight, ClipboardList, ShoppingCart, ScanLine, Upload, AlertTriangle, Activity,
} from 'lucide-react'
import { Skeleton, Pagination } from '../../components/ui'
import {
  getAlmacenesResumen, getAlmacenStock, getCategorias, getProyectosInventario,
  getResumenProyectos, getProductosBajoMinimo,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

// Eventos que cambian existencias por almacén: alta/edición de almacén, cambios
// de producto y cualquier movimiento (que recalcula stock_por_almacen).
const ALMACEN_EVENTS = ['almacen:changed', 'producto:changed', 'movimiento:changed']

const PAGE_SIZE = 24

// Formatea unidades: entero si es exacto, 2 decimales si no. Separador de miles.
function fmtNum(n) {
  const v = Number(n) || 0
  return (v % 1 === 0 ? v : Number(v.toFixed(2))).toLocaleString('es-MX')
}

// Micro-etiqueta uniforme con el resto del sistema (misma escala que el label
// del StatCard del Dashboard): 10px, mayúsculas, tracking-wide.
const LABEL = 'text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400'

// ── Indicador (KPI) — idéntico al StatCard del Dashboard: chip de icono
// monocromo + número dominante `text-xl`. Con `to` es un drill-down. Con
// `tone='alert'` (p. ej. Bajo mínimo con cuenta > 0) el chip y el número toman
// color de advertencia (ámbar), coherente con el resto del sistema. ───────────
function StatCard({ value, label, Icon, to, tone = 'default' }) {
  const alert = tone === 'alert'
  const chip = alert
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
  const valueColor = alert ? 'text-amber-700 dark:text-amber-300' : 'text-ink-900 dark:text-ink-100'
  const inner = (
    <>
      <div className={`h-9 w-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${chip}`}>
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${LABEL} truncate`}>{label}</p>
        <p className={`text-xl font-semibold tabular-nums mt-0.5 leading-none ${valueColor}`}>{value}</p>
      </div>
    </>
  )
  const base = 'bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 p-3.5 flex items-center gap-3'
  if (!to) return <div className={base}>{inner}</div>
  const hover = alert
    ? 'hover:border-amber-300 dark:hover:border-amber-700'
    : 'hover:border-brand-300 dark:hover:border-brand-700'
  return (
    <Link to={to} className={`${base} group ${hover} hover:shadow-sm transition-all`}>
      {inner}
      <ChevronRight size={14} className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
    </Link>
  )
}

// ── Encabezado de sección coherente en toda la portada: chip de ícono + título
// + subtítulo, con un `action` opcional a la derecha (toggle, badge, etc). Es el
// mismo lenguaje que ya usaba "Materiales por proyecto"; ahora lo comparten
// todas las secciones para que la página se lea como una sola pieza. ──────────
function SectionHeader({ Icon, title, titleExtra, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-9 w-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
          <Icon size={17} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200 truncate">{title}</h2>
            {titleExtra}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400 tabular-nums truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

// ── Acciones rápidas de la portada: accesos directos a las tareas diarias del
// almacenista. La primera (Registrar movimiento) es la acción primaria. ───────
const QUICK_ACTIONS = [
  { to: '/inventario/movimientos/nuevo', label: 'Registrar movimiento', Icon: ArrowLeftRight, primary: true },
  { to: '/inventario/solicitudes',       label: 'Solicitudes',           Icon: ClipboardList },
  { to: '/inventario/solicitudes-compra', label: 'Compras',              Icon: ShoppingCart },
  { to: '/inventario/bajo-minimo',       label: 'Bajo mínimo',           Icon: AlertTriangle },
  { to: '/inventario/scanner',           label: 'Escanear',              Icon: ScanLine },
  { to: '/inventario/importar',          label: 'Importar',              Icon: Upload },
]

function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map(({ to, label, Icon, primary }) => (
        <Link
          key={to}
          to={to}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-ring ${
            primary
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600'
          }`}
        >
          <Icon size={15} strokeWidth={1.9} className={primary ? '' : 'text-ink-500 dark:text-ink-400'} />
          {label}
        </Link>
      ))}
    </div>
  )
}

// ── Tarjeta de almacén (selector) ───────────────────────────────────────────
function AlmacenCard({ almacen, selected, onSelect }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(almacen.almacen_id)}
      className={`text-left rounded-xl border px-4 py-3.5 transition-all focus-ring ${
        selected
          ? 'border-brand-500 dark:border-brand-500 bg-brand-50/50 dark:bg-brand-900/15'
          : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{almacen.nombre}</h3>
        {selected && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300 flex-shrink-0">
            En vista
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400 truncate">
        {almacen.ubicacion || 'Sin ubicación registrada'}
      </p>
      <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800/80 grid grid-cols-2 gap-3">
        <div>
          <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
            {almacen.total_productos.toLocaleString('es-MX')}
          </p>
          <p className={`mt-1.5 ${LABEL}`}>Productos</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
            {fmtNum(almacen.total_unidades)}
          </p>
          <p className={`mt-1.5 ${LABEL}`}>Unidades</p>
        </div>
      </div>
    </button>
  )
}

// ── Tarjeta de producto (galería) ───────────────────────────────────────────
function ProductoCard({ p, contextoLabel = 'En este almacén' }) {
  // "Bajo mínimo" es un atributo GLOBAL del producto (mismo criterio que el
  // catálogo): compara el stock total contra el mínimo, no la existencia de
  // este único almacén, para no marcar falsos positivos con stock repartido.
  const bajoStock = p.stock_minimo > 0 && p.stock_actual <= p.stock_minimo
  return (
    <Link
      to={`/inventario/productos/${p.producto_id}/kardex`}
      title={`${p.codigo} — ${p.descripcion}`}
      className="group flex flex-col rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all focus-ring"
    >
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-800/50 border-b border-ink-200 dark:border-ink-800 overflow-hidden">
        {p.imagen_url ? (
          <img
            src={p.imagen_url}
            alt={p.descripcion}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-ink-400 dark:text-ink-600">Sin imagen</span>
          </div>
        )}
        {bajoStock && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-semibold uppercase tracking-wider">
            Bajo mínimo
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-0.5 flex-1">
        <p className="font-mono text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.codigo}</p>
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-snug line-clamp-2">{p.descripcion}</p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.categoria}</p>
        <div className="mt-auto pt-2 border-t border-ink-100 dark:border-ink-800/70">
          <p className={`text-lg font-semibold tabular-nums leading-none ${bajoStock ? 'text-red-600 dark:text-red-400' : 'text-ink-900 dark:text-ink-100'}`}>
            {fmtNum(p.cantidad)} <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{p.unidad}</span>
          </p>
          <p className={`mt-1.5 ${LABEL} truncate`} title={contextoLabel}>{contextoLabel}</p>
        </div>
      </div>
    </Link>
  )
}

// ── Tarjeta de un proyecto ───────────────────────────────────────────────────
// Total dominante + desglose por almacén como filas limpias monocromas (almacén ·
// unidades · %), clickeables: al hacer clic se abre la galería de ese almacén
// filtrada por el proyecto. El almacén que alimenta la galería activa queda
// resaltado en color de marca. Sin colores por almacén, para que la sección se
// lea con el mismo lenguaje que el resto de la portada.
function ProyectoCard({ f, cardKey, projTotal, segs, onCell, activeAlmacenId, activeProyecto }) {
  const isActiveProj = activeProyecto !== '' && String(activeProyecto) === String(cardKey)

  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 hover:shadow-sm hover:border-ink-300 dark:hover:border-ink-700 transition-all">
      {/* Cabecera: nombre del proyecto + total de unidades dominante */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={`text-sm font-semibold truncate ${f.es_general ? 'text-ink-600 dark:text-ink-300' : 'text-ink-900 dark:text-ink-100'}`}
              title={f.proyecto_descripcion || f.proyecto_nombre}
            >
              {f.es_general ? 'General' : f.proyecto_nombre}
            </h3>
            {f.es_general && (
              <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400">
                Libre
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5 truncate">
            {f.total_productos} producto{f.total_productos === 1 ? '' : 's'}
            {!f.es_general && f.proyecto_descripcion ? ` · ${f.proyecto_descripcion}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
            {fmtNum(projTotal)}
          </p>
          <p className={`mt-1 ${LABEL}`}>Unidades</p>
        </div>
      </div>

      {segs.length > 0 && (
        /* Desglose por almacén — filas limpias monocromas, clickeables (drill-down) */
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800/80 space-y-0.5">
          {segs.map((s) => {
            const active = isActiveProj && s.id === activeAlmacenId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onCell(s.id, cardKey)}
                aria-label={`${s.nombre}: ${fmtNum(s.unidades)} unidades (${Math.round(s.pct)}%) — ver en galería`}
                title={`Ver ${s.productos} producto(s) de ${f.es_general ? 'General' : f.proyecto_nombre} en ${s.nombre}`}
                className={`group w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-ring ${
                  active
                    ? 'bg-brand-50 dark:bg-brand-900/25 ring-1 ring-brand-200 dark:ring-brand-800'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
                }`}
              >
                <span className={`flex-1 min-w-0 truncate text-[12px] ${active ? 'text-brand-700 dark:text-brand-300 font-medium' : 'text-ink-700 dark:text-ink-200 group-hover:text-brand-600 dark:group-hover:text-brand-300'}`}>
                  {s.nombre}
                </span>
                <span className="flex-shrink-0 tabular-nums text-[12px] font-semibold text-ink-900 dark:text-ink-100">
                  {fmtNum(s.unidades)}
                  <span className="ml-0.5 font-normal text-ink-400 dark:text-ink-500">u</span>
                </span>
                <span className="flex-shrink-0 w-9 text-right tabular-nums text-[11px] text-ink-400 dark:text-ink-500">
                  {Math.round(s.pct)}%
                </span>
                <ChevronRight size={13} className={`flex-shrink-0 transition-colors ${active ? 'text-brand-500' : 'text-ink-300 dark:text-ink-600 group-hover:text-brand-500'}`} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Materiales por proyecto (tarjetas) ───────────────────────────────────────
// Cada proyecto (General = stock libre) es una tarjeta con su total dominante,
// nº de productos y una barra que reparte las unidades entre almacenes; cada
// almacén de la leyenda enlaza a la galería filtrada. Reutiliza el endpoint
// /almacenes/resumen-proyectos y la paleta navy de las gráficas del Dashboard.
function ResumenProyectos({ data, onCell, activeAlmacenId, activeProyecto }) {
  const [open, setOpen] = useState(true)
  const almacenes = data?.almacenes || []
  const filas = data?.filas || []
  const granTotal = Number(data?.total_unidades || 0)

  // Proyectos ordenados por volumen (mayor arriba) — ranking corporativo. Cada
  // tarjeta trae ya calculados sus segmentos por almacén (con % de reparto).
  const cards = useMemo(() => (
    [...filas]
      .sort((a, b) => Number(b.total_unidades || 0) - Number(a.total_unidades || 0))
      .map((f) => {
        const key = f.proyecto_id ?? 'general'
        const projTotal = Number(f.total_unidades || 0)
        const segs = almacenes
          .map((a) => {
            const celda = f.celdas?.[String(a.id)]
            const u = Number(celda?.unidades || 0)
            return {
              id: a.id, nombre: a.nombre, unidades: u,
              productos: Number(celda?.productos || 0),
              pct: projTotal > 0 ? (u / projTotal) * 100 : 0,
            }
          })
          .filter((s) => s.unidades > 0)
          .sort((a, b) => b.unidades - a.unidades)
        return { f, key, projTotal, segs }
      })
  ), [filas, almacenes])

  return (
    <section className="space-y-3">
      {/* Encabezado corporativo (chip + título + subtítulo + toggle) — compartido */}
      <SectionHeader
        Icon={LayoutGrid}
        title="Materiales por proyecto"
        subtitle={
          `${filas.length} proyecto${filas.length === 1 ? '' : 's'} con existencia · ${fmtNum(granTotal)} unidades`
          + (almacenes.length ? ` · ${almacenes.length} almacén${almacenes.length === 1 ? '' : 'es'}` : '')
        }
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400 hover:text-brand-600 dark:hover:text-brand-300 transition-colors flex-shrink-0 focus-ring rounded px-1.5 py-1"
          >
            {open ? 'Ocultar' : 'Mostrar'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        }
      />

      {open && (
        filas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 dark:border-ink-700 px-6 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
            Aún no hay materiales con existencia. Registra entradas para verlos aquí.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.map(({ f, key, projTotal, segs }) => (
              <ProyectoCard
                key={key}
                f={f}
                cardKey={key}
                projTotal={projTotal}
                segs={segs}
                onCell={onCell}
                activeAlmacenId={activeAlmacenId}
                activeProyecto={activeProyecto}
              />
            ))}
          </div>
        )
      )}
    </section>
  )
}

export default function PortadaAlmacenes() {
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage] = useState(0)               // 0-based (Pagination)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoria, setCategoria] = useState('')
  const [imagen, setImagen] = useState('')          // '' | 'con' | 'sin'
  const [proyecto, setProyecto] = useState('')      // '' (total) | 'general' | <id> — stock por proyecto
  const [categorias, setCategorias] = useState([])
  const [proyectos, setProyectos] = useState([])

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => setCategorias([]))
    getProyectosInventario().then(setProyectos).catch(() => setProyectos([]))
  }, [])

  // Búsqueda con debounce para no pegarle al server en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Resumen por almacén (tarjetas).
  const { data: rawResumen, error: errResumen } = useResource(
    ['almacenes', 'resumen'],
    () => getAlmacenesResumen(),
    { staleMs: 60_000, invalidateOn: ALMACEN_EVENTS },
  )
  const resumen = useMemo(() => rawResumen ?? [], [rawResumen])

  // Resumen de materiales por proyecto y almacén (matriz de la portada).
  const { data: rawResumenProy } = useResource(
    ['almacenes', 'resumen-proyectos'],
    () => getResumenProyectos(),
    { staleMs: 60_000, invalidateOn: ALMACEN_EVENTS },
  )

  // Productos bajo mínimo — alimenta el KPI de alerta y la tira de alerta. Se
  // invalida con los mismos eventos que cambian existencias.
  const { data: rawBajoMinimo } = useResource(
    ['productos', 'bajo-minimo'],
    () => getProductosBajoMinimo(),
    { staleMs: 60_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
  )
  const bajoMinimo = useMemo(() => rawBajoMinimo ?? [], [rawBajoMinimo])

  // Ref a la galería para desplazarse al hacer clic en una celda del resumen.
  const galleryRef = useRef(null)
  const handleResumenCell = (almacenId, proyId) => {
    setSelectedId(almacenId)
    setProyecto(proyId === 'general' ? 'general' : String(proyId))
    setTimeout(() => galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  useEffect(() => {
    if (errResumen) toast.error(extractApiError(errResumen, 'Error al cargar los almacenes'))
  }, [errResumen])

  // Autoselección del primer almacén; si el seleccionado desaparece, cae al primero.
  useEffect(() => {
    if (!resumen.length) return
    if (selectedId == null || !resumen.some((a) => a.almacen_id === selectedId)) {
      setSelectedId(resumen[0].almacen_id)
    }
  }, [resumen, selectedId])

  // Reinicia a la primera página al cambiar de almacén o de filtros.
  useEffect(() => { setPage(0) }, [selectedId, debounced, categoria, imagen, proyecto])

  // Galería del almacén seleccionado (paginada, server-side).
  const { data: rawStock, loading: loadingStock, error: errStock } = useResource(
    ['almacen-stock', { id: selectedId, page, q: debounced, categoria, imagen, proyecto }],
    () => getAlmacenStock(selectedId, { page: page + 1, perPage: PAGE_SIZE, q: debounced, categoria, imagen, proyecto }),
    { enabled: selectedId != null, staleMs: 30_000, invalidateOn: ALMACEN_EVENTS },
  )
  useEffect(() => {
    if (errStock) toast.error(extractApiError(errStock, 'Error al cargar las existencias'))
  }, [errStock])

  const stock = rawStock ?? { items: [], total: 0, pages: 1, total_unidades: 0 }
  const selected = resumen.find((a) => a.almacen_id === selectedId) || null
  const buscando = search.trim() !== debounced
  const nFiltros = (categoria ? 1 : 0) + (imagen ? 1 : 0) + (proyecto ? 1 : 0)
  const proyectoLabel = proyecto === 'general'
    ? 'General (sin proyecto)'
    : (proyectos.find((p) => String(p.id) === String(proyecto))?.numero_proyecto || null)

  const loadingResumen = !rawResumen && !errResumen

  // KPIs del encabezado (derivados de lo que ya se carga; sin queries extra).
  const nProyectos = (rawResumenProy?.filas || []).filter((f) => !f.es_general).length
  const kpis = [
    { label: 'Almacenes', value: loadingResumen ? '—' : resumen.length.toLocaleString('es-MX'), Icon: Warehouse, to: '/inventario/almacenes' },
    { label: 'Productos con existencia', value: rawResumenProy ? Number(rawResumenProy.total_productos || 0).toLocaleString('es-MX') : '—', Icon: PackageCheck, to: '/inventario/catalogo' },
    { label: 'Unidades en inventario', value: rawResumenProy ? fmtNum(rawResumenProy.total_unidades) : '—', Icon: Boxes },
    { label: 'Proyectos con material', value: rawResumenProy ? nProyectos.toLocaleString('es-MX') : '—', Icon: FolderOpen, to: '/inventario/proyectos' },
    { label: 'Bajo mínimo', value: rawBajoMinimo ? bajoMinimo.length.toLocaleString('es-MX') : '—', Icon: AlertTriangle, to: '/inventario/bajo-minimo', tone: bajoMinimo.length > 0 ? 'alert' : 'default' },
  ]

  return (
    <div className="space-y-6">
      {/* Encabezado + acciones rápidas */}
      <div className="space-y-4 pt-1">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ink-100 tracking-tight">
                Existencias por almacén
              </h1>
            </div>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1.5 max-w-2xl">
              Control de materiales por almacén y por proyecto. Selecciona un almacén para consultar su catálogo.
            </p>
          </div>
          <Link
            to="/inventario/actividad"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600 transition-colors flex-shrink-0"
          >
            <Activity size={15} className="text-ink-400" /> Actividad y auditoría <ChevronRight size={15} className="text-ink-400" />
          </Link>
        </div>

        {/* Acciones rápidas — tareas diarias del almacenista */}
        <QuickActions />
      </div>

      {/* KPIs — StatCards del Dashboard (clickeables; Bajo mínimo con alerta) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <StatCard key={k.label} value={k.value} label={k.label} Icon={k.Icon} to={k.to} tone={k.tone} />
        ))}
      </div>

      {/* Tira de alerta: productos bajo mínimo (solo si hay) — acción inmediata */}
      {bajoMinimo.length > 0 && (
        <Link
          to="/inventario/bajo-minimo"
          className="group flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle size={16} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {bajoMinimo.length} producto{bajoMinimo.length === 1 ? '' : 's'} bajo mínimo
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 truncate">
              {bajoMinimo.slice(0, 4).map((p) => p.codigo).join(' · ')}{bajoMinimo.length > 4 ? ' …' : ''}
            </p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 flex-shrink-0">
            Ver todos <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {/* Resumen de materiales por proyecto y almacén */}
      {rawResumenProy && (
        <ResumenProyectos
          data={rawResumenProy}
          onCell={handleResumenCell}
          activeAlmacenId={selectedId}
          activeProyecto={proyecto}
        />
      )}

      {/* Almacenes */}
      <section className="space-y-3">
        <SectionHeader
          Icon={Warehouse}
          title="Almacenes"
          subtitle={loadingResumen
            ? 'Cargando…'
            : `${resumen.length} almacén${resumen.length === 1 ? '' : 'es'} · elige uno para ver su catálogo`}
        />
        {loadingResumen ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : resumen.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 dark:border-ink-700 px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">No hay almacenes registrados</h3>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 max-w-sm mx-auto">
              Registra tus bodegas para ver aquí las existencias por almacén.
            </p>
            <Link
              to="/inventario/almacenes"
              className="mt-4 inline-flex items-center h-9 px-3.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Administrar almacenes
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {resumen.map((a) => (
              <AlmacenCard
                key={a.almacen_id}
                almacen={a}
                selected={a.almacen_id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Galería del almacén seleccionado */}
      {selected && (
        <section className="space-y-4 pt-5 border-t border-ink-200 dark:border-ink-800" ref={galleryRef}>
          <SectionHeader
            Icon={Boxes}
            title={selected.nombre}
            titleExtra={proyectoLabel && (
              <span className="px-2 py-0.5 rounded border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                {proyectoLabel}
              </span>
            )}
            subtitle={
              `${stock.total.toLocaleString('es-MX')} producto${stock.total === 1 ? '' : 's'} con existencia · ${fmtNum(stock.total_unidades)} unidades`
              + (proyectoLabel ? ' · apartadas a este proyecto' : '')
            }
          />

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por código o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={imagen}
              onChange={(e) => setImagen(e.target.value)}
              className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Con y sin foto</option>
              <option value="con">Con foto</option>
              <option value="sin">Sin foto</option>
            </select>
            {/* Filtro por proyecto (feature stock por proyecto): sin selección se
                muestra el total del almacén; con proyecto, solo ese bucket. */}
            <select
              value={proyecto}
              onChange={(e) => setProyecto(e.target.value)}
              title="Filtrar existencias por proyecto"
              className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Todos los proyectos</option>
              <option value="general">General (sin proyecto)</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}
                </option>
              ))}
            </select>
            {(nFiltros > 0 || search) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCategoria(''); setImagen(''); setProyecto('') }}
                className="inline-flex items-center h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-600 transition-colors flex-shrink-0"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Grid de productos */}
          {loadingStock || buscando ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
            </div>
          ) : stock.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-300 dark:border-ink-700 px-6 py-10 text-center">
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">Sin existencias</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 max-w-sm mx-auto">
                {search || nFiltros > 0
                  ? 'Ningún producto coincide con los filtros en este almacén.'
                  : 'Este almacén no tiene productos con existencia registrada.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                {stock.items.map((p) => (
                  <ProductoCard
                    key={p.producto_id}
                    p={p}
                    contextoLabel={proyectoLabel ? `Proyecto ${proyectoLabel}` : 'En este almacén'}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={stock.pages || 1}
                totalElements={stock.total || 0}
                size={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </section>
      )}

      <div className="pt-4 text-xs text-ink-400 dark:text-ink-500 border-t border-ink-200 dark:border-ink-800">
        Skilled &middot; Sistema de inventario &copy; {new Date().getFullYear()}
      </div>
    </div>
  )
}
