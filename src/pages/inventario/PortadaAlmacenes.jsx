import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Search, Warehouse, Boxes, Package, ChevronRight,
  ClipboardList, ScanLine,
  // Mismos iconos que el menú lateral para los mismos destinos: catálogo, bajo
  // mínimo, proyectos, movimientos y actividad. Un destino con dos dibujos
  // distintos según desde dónde se mire es lo que hace ver amateur a una app.
  PackageSearch, PackageMinus, FolderKanban, ArrowRightLeft, LayoutDashboard,
} from 'lucide-react'
import { Skeleton, Pagination, Modal } from '../../components/ui'
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
// Solo lo que se hace TODOS los días. Eran seis y varios repetían algo que ya
// está en la página o en el menú: "Bajo mínimo" es además un indicador (con su
// cuenta, que dice más que un botón) e "Importar" es una tarea ocasional que
// vive en el catálogo. Seis botones iguales no se leen; tres sí.
const QUICK_ACTIONS = [
  { to: '/inventario/movimientos/nuevo', label: 'Registrar movimiento', Icon: ArrowRightLeft, primary: true },
  { to: '/inventario/solicitudes',       label: 'Solicitudes',          Icon: ClipboardList },
  { to: '/inventario/scanner',           label: 'Escanear',             Icon: ScanLine },
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
// BUG QUE SE ARREGLÓ AQUÍ: al cambiar de almacén, las tarjetas "brincaban".
// La etiqueta "En vista" solo existía en la tarjeta seleccionada, y al aparecer
// le robaba ancho al título — que tiene `truncate`. Resultado: al hacer clic, el
// nombre de la tarjeta nueva se cortaba de golpe y el de la anterior se estiraba,
// los dos animados por `transition-all`, que también anima cambios de tamaño.
//
// Ahora el estado seleccionado NO altera el layout: solo cambian colores (chip,
// borde, fondo) y la transición se limita a `colors`. Nada se mueve de lugar.
function AlmacenCard({ almacen, selected, onSelect }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={almacen.nombre}
      onClick={() => onSelect(almacen.almacen_id)}
      className={`text-left rounded-xl border px-4 py-3.5 transition-colors focus-ring ${
        selected
          ? 'border-brand-500 dark:border-brand-500 bg-brand-50/50 dark:bg-brand-900/15'
          : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-ink-300 dark:hover:border-ink-700'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`h-9 w-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 transition-colors ${
          selected
            ? 'bg-brand-600 text-white'
            : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
        }`}>
          <Warehouse size={17} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          {/* Sin insignia condicional: el almacén en vista se reconoce por el
              chip azul y el borde, que no ocupan espacio del título. */}
          <h3 className={`text-sm font-semibold truncate transition-colors ${
            selected ? 'text-brand-800 dark:text-brand-200' : 'text-ink-900 dark:text-ink-100'
          }`}>
            {almacen.nombre}
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400 truncate">
            {almacen.ubicacion || 'Sin ubicación registrada'}
          </p>
        </div>
      </div>

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
  // Una URL rota dejaba un cuadro gris vacío: se ocultaba la imagen y el rótulo
  // "Sin imagen" solo se pintaba cuando el producto NO tenía URL. Pasa seguido
  // con imágenes importadas por Excel que apuntan a un sitio caído. El estado se
  // reinicia solo al cambiar de producto porque la lista va con `key`.
  const [imagenRota, setImagenRota] = useState(false)
  const hayImagen = !!p.imagen_url && !imagenRota
  return (
    <Link
      to={`/inventario/productos/${p.producto_id}/kardex`}
      // De dónde viene: sin esto el kardex regresaba siempre al catálogo, así
      // que abrir un producto desde Inicio dejaba al usuario en otra pantalla.
      state={{ volverA: '/', volverLabel: 'Volver al inicio' }}
      title={`${p.codigo} — ${p.descripcion}`}
      className="group flex flex-col rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all focus-ring"
    >
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-800/50 border-b border-ink-200 dark:border-ink-800 overflow-hidden">
        {hayImagen ? (
          <img
            src={p.imagen_url}
            alt={p.descripcion}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-ink-400 dark:text-ink-600">Sin imagen</span>
          </div>
        )}
        {/* Un solo lenguaje de alerta en toda la portada: ámbar, igual que el KPI
            de Bajo mínimo. El bloque rojo sólido gritaba más que el propio dato
            y competía con la foto del producto. */}
        {bajoStock && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-white/95 dark:bg-ink-900/95 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-sm">
            Bajo mínimo
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-0.5 flex-1">
        <p className="font-mono text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.codigo}</p>
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-snug line-clamp-2">{p.descripcion}</p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.categoria}</p>
        <div className="mt-auto pt-2 border-t border-ink-100 dark:border-ink-800/70">
          <p className={`text-lg font-semibold tabular-nums leading-none ${bajoStock ? 'text-amber-700 dark:text-amber-300' : 'text-ink-900 dark:text-ink-100'}`}>
            {fmtNum(p.cantidad)} <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{p.unidad}</span>
          </p>
          <p className={`mt-1.5 ${LABEL} truncate`} title={contextoLabel}>{contextoLabel}</p>
        </div>
      </div>
    </Link>
  )
}


export default function PortadaAlmacenes() {
  // ── La ventana sirve para ELEGIR; el material se ve en la página ────────
  // Clic en una bodega → se abre una ventana con los proyectos que tienen
  // material ahí → al elegir uno, la ventana se cierra y el material aparece
  // abajo, en la página, como siempre.
  //
  // Por eso hay dos cosas separadas: lo que se está eligiendo en la ventana
  // (`modalAlmacenId`) y lo que la página está mostrando (`selectedId` +
  // `proyecto`). Si abres la ventana y la cierras sin elegir, lo que ya estabas
  // viendo se queda como estaba.
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalAlmacenId, setModalAlmacenId] = useState(null)
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

  // ── Cambiar de almacén o de filtro vuelve a la página 1, EN EL MISMO evento ──
  // Antes esto vivía en un useEffect y llegaba tarde: entre el clic y el efecto
  // había un render con el almacén NUEVO y la página VIEJA, así que se pedía al
  // servidor una página que a veces no existe en ese almacén. Eso disparaba una
  // consulta de más y, si el almacén nuevo tenía menos páginas, la galería
  // parpadeaba (o mostraba "Sin existencias") antes de saltar sola a la primera.
  const cambiarFiltro = (setter) => (valor) => { setter(valor); setPage(0) }
  const limpiarFiltros = () => {
    setSearch(''); setCategoria(''); setImagen(''); setPage(0)
  }

  // Al cambiar lo que se muestra, la búsqueda y los filtros de la galería se
  // reinician: eran de la selección anterior.
  const limpiarBusqueda = () => { setPage(0); setSearch(''); setCategoria(''); setImagen('') }

  // Abrir la ventana NO cambia lo que la página muestra: solo propone.
  const abrirSelector = (almacenId) => { setModalAlmacenId(almacenId); setModalAbierto(true) }
  const cerrarSelector = () => setModalAbierto(false)

  // Elegir sí aplica: cierra la ventana y la galería de abajo pasa a ese
  // almacén y proyecto. `''` = todo el material del almacén.
  const elegir = (claveProyecto) => {
    setSelectedId(modalAlmacenId)
    setProyecto(claveProyecto)
    limpiarBusqueda()
    setModalAbierto(false)
  }

  useEffect(() => {
    if (errResumen) toast.error(extractApiError(errResumen, 'Error al cargar los almacenes'))
  }, [errResumen])

  // Si la bodega que se está mostrando desaparece (la borraron u otro usuario la
  // desactivó), se limpia en vez de quedar con datos fantasma. El efecto de
  // abajo se encarga de volver a llenar la página.
  useEffect(() => {
    if (selectedId == null || !resumen.length) return
    if (!resumen.some((a) => a.almacen_id === selectedId)) {
      setSelectedId(null); setProyecto(''); limpiarBusqueda()
    }
  }, [resumen, selectedId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Al entrar, la página muestra el almacén PRINCIPAL para no abrir en blanco.
  // "Principal" = el que más unidades tiene, no el primero de la lista (que va
  // por orden alfabético y bien podría estar vacío, que es justo lo que se
  // quiere evitar). Solo aplica cuando no hay nada elegido; en cuanto el usuario
  // elige algo, manda su elección.
  useEffect(() => {
    if (selectedId != null || resumen.length === 0) return
    const principal = resumen.reduce((mayor, a) => (
      Number(a.total_unidades || 0) > Number(mayor.total_unidades || 0) ? a : mayor
    ), resumen[0])
    if (principal) { setSelectedId(principal.almacen_id); setProyecto('') }
  }, [resumen, selectedId])

  // Red de seguridad: el reinicio real se hace al navegar y al filtrar; si la
  // página ya es 0, React ni re-renderiza.
  useEffect(() => { setPage(0) }, [debounced, categoria, imagen])

  // Proyectos CON material en la bodega que se está eligiendo en la ventana.
  // Sale del mismo resumen que ya se carga para la página: sin consultas extra.
  const proyectosDelAlmacen = useMemo(() => {
    const filas = rawResumenProy?.filas || []
    return filas
      .map((f) => {
        const celda = f.celdas?.[String(modalAlmacenId)]
        const unidades = Number(celda?.unidades || 0)
        if (unidades <= 0) return null
        return {
          clave: f.es_general ? 'general' : String(f.proyecto_id),
          nombre: f.es_general ? 'General' : f.proyecto_nombre,
          detalle: f.es_general
            ? 'Material libre, sin apartar a ningún proyecto'
            : (f.proyecto_descripcion || ''),
          esGeneral: !!f.es_general,
          unidades,
          productos: Number(celda?.productos || 0),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.unidades - a.unidades)
  }, [rawResumenProy, modalAlmacenId])

  // Galería del almacén seleccionado (paginada, server-side).
  const { data: rawStock, loading: loadingStock, error: errStock } = useResource(
    ['almacen-stock', { id: selectedId, page, q: debounced, categoria, imagen, proyecto }],
    () => getAlmacenStock(selectedId, { page: page + 1, perPage: PAGE_SIZE, q: debounced, categoria, imagen, proyecto }),
    // Solo se pide el catálogo cuando hay una selección aplicada (es decir,
    // cuando la galería de abajo está en pantalla).
    { enabled: selectedId != null, staleMs: 30_000, invalidateOn: ALMACEN_EVENTS },
  )
  useEffect(() => {
    if (errStock) toast.error(extractApiError(errStock, 'Error al cargar las existencias'))
  }, [errStock])

  const stock = rawStock ?? { items: [], total: 0, pages: 1, total_unidades: 0 }
  const selected = resumen.find((a) => a.almacen_id === selectedId) || null
  // El almacén que se está eligiendo en la ventana (puede no ser el que se está
  // mostrando abajo: abrir la ventana no cambia la galería hasta que eliges).
  const almacenDelModal = resumen.find((a) => a.almacen_id === modalAlmacenId) || null
  const buscando = search.trim() !== debounced
  // El proyecto ya no es un filtro suelto: es el paso en el que estás, y se ve
  // en la ruta de arriba. Aquí solo cuentan los filtros de la galería.
  const nFiltros = (categoria ? 1 : 0) + (imagen ? 1 : 0)
  const proyectoLabel = proyecto === 'general'
    ? 'General (sin proyecto)'
    : (proyectos.find((p) => String(p.id) === String(proyecto))?.numero_proyecto || null)

  const loadingResumen = !rawResumen && !errResumen

  // KPIs del encabezado (derivados de lo que ya se carga; sin queries extra).
  const nProyectos = (rawResumenProy?.filas || []).filter((f) => !f.es_general).length
  const kpis = [
    { label: 'Almacenes', value: loadingResumen ? '—' : resumen.length.toLocaleString('es-MX'), Icon: Warehouse, to: '/inventario/almacenes' },
    { label: 'Productos con existencia', value: rawResumenProy ? Number(rawResumenProy.total_productos || 0).toLocaleString('es-MX') : '—', Icon: PackageSearch, to: '/inventario/catalogo' },
    // `Package` y no `Boxes`: este KPI cuenta unidades sueltas, y `Boxes` es el
    // icono de "material por proyecto" (menú y sección de abajo).
    { label: 'Unidades en inventario', value: rawResumenProy ? fmtNum(rawResumenProy.total_unidades) : '—', Icon: Package },
    { label: 'Proyectos con material', value: rawResumenProy ? nProyectos.toLocaleString('es-MX') : '—', Icon: FolderKanban, to: '/inventario/proyectos' },
    { label: 'Bajo mínimo', value: rawBajoMinimo ? bajoMinimo.length.toLocaleString('es-MX') : '—', Icon: PackageMinus, to: '/inventario/bajo-minimo', tone: bajoMinimo.length > 0 ? 'alert' : 'default' },
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
              Abajo se muestra el material del almacén principal. Abre otro almacén para ver
              sus proyectos y cambiar lo que se lista.
            </p>
          </div>
          <Link
            to="/inventario/actividad"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600 transition-colors flex-shrink-0"
          >
            <LayoutDashboard size={15} className="text-ink-400" /> Actividad y auditoría <ChevronRight size={15} className="text-ink-400" />
          </Link>
        </div>

        {/* Acciones rápidas — tareas diarias del almacenista */}
        <QuickActions />
      </div>

      {/* ── La página: las bodegas, siempre a la vista ─────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          Icon={Warehouse}
          title="Almacenes"
          subtitle={loadingResumen
            ? 'Cargando…'
            : `${resumen.length} almacén${resumen.length === 1 ? '' : 'es'} · abre uno para ver su material`}
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
                onSelect={abrirSelector}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── La ventana: solo para elegir qué mostrar abajo ─────────────────── */}
      <Modal
        open={modalAbierto}
        onClose={cerrarSelector}
        size="lg"
        title={almacenDelModal?.nombre || 'Almacén'}
        description={almacenDelModal?.ubicacion || 'Elige qué material quieres ver'}
        footer={
          <button
            type="button"
            onClick={cerrarSelector}
            className="inline-flex items-center h-9 px-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600 transition-colors"
          >
            Cancelar
          </button>
        }
      >
        <section className="space-y-3">
          <SectionHeader
            Icon={Boxes}
            title="Proyectos con material aquí"
            subtitle={proyectosDelAlmacen.length === 0
              ? 'Este almacén no tiene material registrado'
              : `${proyectosDelAlmacen.length} proyecto${proyectosDelAlmacen.length === 1 ? '' : 's'} · elige uno para verlo abajo`}
            action={
              <button
                type="button"
                onClick={() => elegir('')}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex-shrink-0"
              >
                Ver todo el material <ChevronRight size={15} />
              </button>
            }
          />
          {proyectosDelAlmacen.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-300 dark:border-ink-700 px-6 py-10 text-center">
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">Sin existencias</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 max-w-sm mx-auto">
                Todavía no hay material registrado en este almacén.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {proyectosDelAlmacen.map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => elegir(p.clave)}
                  className="group text-left rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-3.5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`h-9 w-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${
                      p.esGeneral
                        ? 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
                        : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    }`}>
                      {p.esGeneral ? <Package size={17} strokeWidth={1.8} /> : <FolderKanban size={17} strokeWidth={1.8} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{p.nombre}</h3>
                      <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400 truncate">
                        {p.detalle || 'Material apartado a este proyecto'}
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-ink-300 dark:text-ink-600 group-hover:text-brand-500 flex-shrink-0 transition-colors" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800/80 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
                        {p.productos.toLocaleString('es-MX')}
                      </p>
                      <p className={`mt-1.5 ${LABEL}`}>Productos</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100 leading-none">
                        {fmtNum(p.unidades)}
                      </p>
                      <p className={`mt-1.5 ${LABEL}`}>Unidades</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </Modal>

      {/* ── El material, en la página (como siempre) ───────────────────────── */}
      {selected && (
        <section className="space-y-4 pt-5 border-t border-ink-200 dark:border-ink-800">
          <SectionHeader
            // Esta sección lista PRODUCTOS (con buscador y filtros), por eso el
            // mismo icono que el catálogo.
            Icon={PackageSearch}
            title={selected.nombre}
            titleExtra={
              <span className="px-2 py-0.5 rounded border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                {proyecto === '' ? 'Todo el material' : (proyectoLabel || 'Proyecto')}
              </span>
            }
            subtitle={
              `${stock.total.toLocaleString('es-MX')} producto${stock.total === 1 ? '' : 's'} · ${fmtNum(stock.total_unidades)} unidades`
              + (proyecto !== '' ? ' apartadas a este proyecto' : ' en este almacén')
            }
            action={
              <button
                type="button"
                onClick={() => abrirSelector(selectedId)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600 transition-colors flex-shrink-0"
              >
                Cambiar proyecto
              </button>
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
                onChange={(e) => cambiarFiltro(setSearch)(e.target.value)}
                className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => cambiarFiltro(setCategoria)(e.target.value)}
              className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={imagen}
              onChange={(e) => cambiarFiltro(setImagen)(e.target.value)}
              className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Con y sin foto</option>
              <option value="con">Con foto</option>
              <option value="sin">Sin foto</option>
            </select>
            {/* El selector de proyecto desapareció a propósito: el proyecto es
                el paso en el que estás (se ve en la ruta de arriba y se cambia
                volviendo). Tenerlo aquí además del recorrido era la segunda
                forma de hacer lo mismo. */}
            {(nFiltros > 0 || search) && (
              <button
                type="button"
                onClick={limpiarFiltros}
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

      {/* ── Panorama ────────────────────────────────────────────────────────
          Los totales del inventario. La matriz proyectos × almacenes salió de
          aquí: hacía lo mismo que el recorrido y era el segundo selector de
          almacén. Vive en su pantalla del menú (Material por proyecto). */}
      <section className="space-y-3 pt-5 border-t border-ink-200 dark:border-ink-800">
        <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200">Panorama del inventario</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <StatCard key={k.label} value={k.value} label={k.label} Icon={k.Icon} to={k.to} tone={k.tone} />
          ))}
        </div>
      </section>

      <div className="pt-4 text-xs text-ink-400 dark:text-ink-500 border-t border-ink-200 dark:border-ink-800">
        Skilled &middot; Sistema de inventario &copy; {new Date().getFullYear()}
      </div>
    </div>
  )
}
