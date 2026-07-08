import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Send, Plus, Minus, Check, Trash2, Search, ShoppingCart,
  Wrench, Hexagon, Circle, ArrowDown, GitBranch, Boxes as BoxesIcon,
  Pipette, Printer, Package, Hammer, ImageOff, FolderKanban,
  CalendarRange, FileText, Settings2, Sparkles, X,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Input, Select, InfoTip,
} from '../../components/ui'
import { getProductos, getCategoriasResumen, createSolicitud, getProyectosInventario, getProyectosPlanificables, previewSolicitudPdf } from '../../api/inventario'
import { unidadPermiteDecimales } from '../../utils/unidades'
import { getHerramientas } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { useServerPagination } from '../../hooks/useServerPagination'
import { useSocket } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'

// ─── Catálogo visual de categorías ────────────────────────────────────────────
// Paleta unificada en slate/ink. La distinción visual viene del icono, no del
// color — evita un mosaico tipo arcoíris cuando se ven muchas categorías a la
// vez. La selección activa usa el color brand del producto.
const CAT_CFG = {
  'Tornillería':        { Icon: Wrench },
  'Tuercas':            { Icon: Hexagon },
  'Rondanas':           { Icon: Circle },
  'Pijas':              { Icon: ArrowDown },
  'Abrazaderas':        { Icon: GitBranch },
  'Soportería':         { Icon: BoxesIcon },
  'Tubería/Accesorios': { Icon: Pipette },
}
const CAT_DEFAULT = { Icon: Package }
const getCatCfg = (cat) => CAT_CFG[cat] || CAT_DEFAULT

// ─── Imagen con fallback seguro ─────────────────────────────────────────────
// Si la URL es válida (regex anti-XSS/SSRF se aplica server-side al guardar),
// la mostramos con loading lazy. Si falla al cargar, mostramos el fallback.
function SafeImage({ src, alt, fallback, className }) {
  const [errored, setErrored] = useState(false)
  if (!src || errored) {
    return <div className={className}>{fallback}</div>
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className + ' object-cover'}
    />
  )
}

// ─── Stepper numérico reutilizable ──────────────────────────────────────────
function QtyStepper({ value, onChange, step = 1, min = 0.1, unidad = '', decimals = true }) {
  const round = (x) => (decimals ? Math.round(x * 10) / 10 : Math.round(x))
  const dec = () => onChange(Math.max(min, round(Number(value) - step)))
  const inc = () => onChange(round(Number(value) + step))
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={dec}
        className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 flex items-center justify-center transition-colors">
        <Minus size={16} strokeWidth={2} />
      </button>
      <div className="flex flex-col items-center">
        <input
          type="number"
          step={step} min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-28 h-12 text-center text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
        {unidad && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mt-1">{unidad}</span>
        )}
      </div>
      <button type="button" onClick={inc}
        className="w-10 h-10 rounded-lg bg-brand-700 hover:bg-brand-800 text-white flex items-center justify-center transition-colors">
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Card de producto ──────────────────────────────────────────────────────
function ProductoCard({ producto, enCart, onClick }) {
  const cfg = getCatCfg(producto.categoria)
  const Icon = cfg.Icon
  const stock = parseFloat(producto.stock_actual)
  const minimo = parseFloat(producto.stock_minimo)
  const bajo = stock <= minimo
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col bg-white dark:bg-ink-900 border rounded-xl text-left overflow-hidden transition-all
        ${enCart
          ? 'border-emerald-500 ring-1 ring-emerald-300 dark:ring-emerald-700/50'
          : 'border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm'}`}
    >
      {/* Imagen */}
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-950 overflow-hidden">
        <SafeImage
          src={producto.imagen_url}
          alt={producto.descripcion}
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-ink-100 dark:bg-ink-800">
              <Icon size={34} strokeWidth={1.5} className="text-ink-500 dark:text-ink-400" />
            </div>
          }
          className="w-full h-full"
        />
        {/* Badge categoría flotante */}
        <span className="absolute top-2 left-2 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/90 dark:bg-ink-900/90 text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-700 backdrop-blur-sm">
          {producto.categoria || 'General'}
        </span>
        {/* Indicador en carrito */}
        {enCart && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center">
            <Check size={12} strokeWidth={3} />
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-2.5 flex flex-col gap-1">
        <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-100 line-clamp-2 leading-tight">
          {producto.descripcion}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-semibold bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 px-1.5 py-0.5 rounded">
            {producto.codigo}
          </span>
          <span className={`text-[11px] font-semibold tabular-nums ${bajo ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {Number.isInteger(stock) ? stock : stock.toFixed(1)} {producto.unidad}
          </span>
        </div>
      </div>
      {/* Botón hover */}
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-brand-700 group-hover:bg-brand-800 text-white inline-flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
        {enCart ? <Settings2 size={14} strokeWidth={2} /> : <Plus size={16} strokeWidth={2.5} />}
      </div>
    </button>
  )
}

// ─── Card de herramienta ───────────────────────────────────────────────────
function HerramientaCard({ herramienta, enCart, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col bg-white dark:bg-ink-900 border rounded-xl text-left overflow-hidden transition-all
        ${enCart
          ? 'border-emerald-500 ring-1 ring-emerald-300 dark:ring-emerald-700/50'
          : 'border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm'}`}
    >
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-950 overflow-hidden">
        <SafeImage
          src={herramienta.imagen_url}
          alt={herramienta.descripcion}
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-ink-100 dark:bg-ink-800">
              <Hammer size={34} strokeWidth={1.5} className="text-ink-500 dark:text-ink-400" />
            </div>
          }
          className="w-full h-full"
        />
        <span className="absolute top-2 left-2 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/90 dark:bg-ink-900/90 text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-700 backdrop-blur-sm">
          {herramienta.clasificacion || 'Herramienta'}
        </span>
        {enCart && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center">
            <Check size={12} strokeWidth={3} />
          </div>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1">
        <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-100 line-clamp-2 leading-tight">
          {herramienta.descripcion}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-semibold bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 px-1.5 py-0.5 rounded">
            {herramienta.sku}
          </span>
          {(herramienta.marca || herramienta.modelo) && (
            <span className="text-[11px] text-ink-500 dark:text-ink-400 truncate">
              {herramienta.marca || ''} {herramienta.modelo || ''}
            </span>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-brand-700 group-hover:bg-brand-800 text-white inline-flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
        {enCart ? <Settings2 size={14} strokeWidth={2} /> : <Plus size={16} strokeWidth={2.5} />}
      </div>
    </button>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function MisPedidos() {
  // El coordinador solo puede pedir material para SUS proyectos: usamos el
  // endpoint con scoping por dueño. El resto de roles (inventario, admin,
  // solicitante) ve el catálogo completo de proyectos.
  const { isCoordinador } = useAuth()

  const [tab, setTab] = useState('materiales')   // 'materiales' | 'herramientas'

  const [saving, setSaving] = useState(false)
  // Hoja inferior del pedido en móvil (estilo app nativa). En escritorio el
  // carrito vive en el panel lateral, así que este estado solo aplica a < xl.
  const [cartOpen, setCartOpen] = useState(false)
  // Bloquea el scroll del fondo mientras la hoja está abierta (solo móvil).
  useEffect(() => {
    if (!cartOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [cartOpen])

  const [search, setSearch] = useState('')
  const [searchHerr, setSearchHerr] = useState('')
  const [activeCat, setActiveCat] = useState('Todas')
  const [proyecto, setProyecto] = useState('')      // texto (para PDF y campo requerido)
  const [proyectoId, setProyectoId] = useState('')  // FK real, se manda al backend
  const [notas, setNotas] = useState('')

  const [cart, setCart] = useState([])             // materiales
  const [cartHerr, setCartHerr] = useState([])     // herramientas
  const [qtyModal, setQtyModal] = useState(null)   // material { producto, cantidad }
  const [herrModal, setHerrModal] = useState(null) // herramienta { herr, cantidad, fechas, justif, complem }

  // Búsqueda de materiales con debounce: no le pegamos al server por cada tecla.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Búsqueda de herramientas también server-side (antes filtraba en cliente
  // sobre 500 → con más herramientas, el resto quedaba inalcanzable).
  const [debouncedSearchHerr, setDebouncedSearchHerr] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchHerr(searchHerr.trim()), 350)
    return () => clearTimeout(t)
  }, [searchHerr])

  // Categorías (chips) desde el resumen server-side — no dependen de cuántos
  // productos se hayan cargado (con miles, derivarlas del listado las ocultaba).
  const { data: rawResumen } = useResource(
    ['categorias-resumen'],
    () => getCategoriasResumen(),
    { staleMs: 60_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
  )

  // Productos y herramientas con PAGINACIÓN server-side acumulativa: con miles
  // de productos un `limit` fijo dejaba inalcanzables los que sobraran del tope
  // (p.ej. la categoría 501+). Ahora "Mostrar más" pide la siguiente página al
  // backend vía `skip`, así se llega a todo el catálogo sin límite práctico.
  const catParam = activeCat === 'Todas' ? '' : activeCat
  const PAGE_PROD = 100
  const {
    items: productos,
    loading: prodLoading,
    loadingMore: prodLoadingMore,
    hasMore: prodHasMore,
    loadMore: loadMoreProd,
    refresh: refreshProd,
    error: errProd,
  } = useServerPagination(
    (skip, limit) => getProductos({ categoria: catParam, q: debouncedSearch, skip, limit }),
    `${catParam}|${debouncedSearch}`,
    { pageSize: PAGE_PROD },
  )
  const {
    items: herramientas,
    loading: herrLoadingBase,
    loadingMore: herrLoadingMore,
    hasMore: herrHasMore,
    loadMore: loadMoreHerr,
    refresh: refreshHerr,
    error: errHerr,
  } = useServerPagination(
    (skip, limit) => getHerramientas({ q: debouncedSearchHerr || undefined, skip, limit }),
    `${debouncedSearchHerr}`,
    { pageSize: PAGE_PROD },
  )
  const { data: rawProyectos, error: errProj } = useResource(
    isCoordinador ? ['proyectos-planificables'] : ['proyectos-inventario'],
    () => (isCoordinador ? getProyectosPlanificables() : getProyectosInventario()),
    { staleMs: 120_000, invalidateOn: ['proyecto:changed'] },
  )
  const proyectos = rawProyectos ?? []
  // Skeleton de materiales mientras carga la página o se asienta el debounce.
  const matLoading = prodLoading || search.trim() !== debouncedSearch
  const herrLoading = herrLoadingBase

  // Tiempo real: al cambiar catálogo/herramientas, recargar desde la página 0.
  const { on: onSocket } = useSocket()
  useEffect(() => {
    const offP = onSocket('producto:changed', refreshProd)
    const offM = onSocket('movimiento:changed', refreshProd)
    const offH = onSocket('herramienta:changed', refreshHerr)
    return () => { offP?.(); offM?.(); offH?.() }
  }, [onSocket, refreshProd, refreshHerr])

  useEffect(() => {
    const err = errProd || errHerr || errProj
    if (err) toast.error(extractApiError(err, 'Error al cargar catálogo'))
  }, [errProd, errHerr, errProj])

  // ─── Herramientas ─────────────────────────────────────────────────────────
  // La búsqueda ya se hace en el servidor (debouncedSearchHerr); aquí solo
  // exponemos el resultado para no filtrar dos veces ni ocultar coincidencias.
  const herramientasFiltradas = herramientas

  const openHerrModal = (h) => {
    const en = cartHerr.find((c) => c.herramienta_id === h.id)
    setHerrModal(en
      ? { ...en, herr: h }
      : {
          herr: h,
          herramienta_id: h.id,
          cantidad: 1,
          fecha_uso_inicio: '',
          fecha_uso_fin: '',
          justificacion: '',
          complementos: '',
        })
  }

  const confirmHerr = () => {
    if (!herrModal) return
    const qty = Number(herrModal.cantidad)
    if (!qty || qty <= 0) return toast.error('Cantidad debe ser mayor a 0')
    if (!Number.isInteger(qty)) return toast.error('Las herramientas se piden en cantidades enteras')
    if (herrModal.fecha_uso_inicio && herrModal.fecha_uso_fin
        && herrModal.fecha_uso_inicio > herrModal.fecha_uso_fin) {
      return toast.error('Fecha inicio no puede ser posterior a fecha fin')
    }
    if (!herrModal.justificacion.trim()) {
      return toast.error('Justifica para qué necesitas la herramienta')
    }
    setCartHerr((prev) => {
      const idx = prev.findIndex((c) => c.herramienta_id === herrModal.herramienta_id)
      const item = {
        herramienta_id: herrModal.herramienta_id,
        sku: herrModal.herr.sku,
        descripcion: herrModal.herr.descripcion,
        imagen_url: herrModal.herr.imagen_url || null,
        cantidad: qty,
        fecha_uso_inicio: herrModal.fecha_uso_inicio || null,
        fecha_uso_fin: herrModal.fecha_uso_fin || null,
        justificacion: herrModal.justificacion.trim(),
        complementos: herrModal.complementos.trim() || null,
      }
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = item; return copy
      }
      return [...prev, item]
    })
    setHerrModal(null)
  }

  const removeHerr = (hid) => setCartHerr((prev) => prev.filter((c) => c.herramienta_id !== hid))

  const categorias = useMemo(
    () => ['Todas', ...(rawResumen ?? []).map((c) => c.nombre)],
    [rawResumen],
  )

  // El catálogo ya viene paginado del servidor (categoría + búsqueda + skip).
  // Se renderiza tal cual lo cargado; "Mostrar más" pide la siguiente página.
  const filtered = productos
  const filteredVisibles = productos
  const herramientasVisibles = herramientasFiltradas

  const openQtyModal = (producto) => {
    const enCart = cart.find((c) => c.id === producto.id)
    setQtyModal({
      producto,
      cantidad: enCart ? enCart.cantidad : 1,
      justificacion: enCart?.justificacion || '',
    })
  }

  const confirmQty = () => {
    if (!qtyModal) return
    const qty = Number(qtyModal.cantidad)
    if (!qty || qty <= 0) {
      toast.error('La cantidad debe ser mayor a cero')
      return
    }
    if (!unidadPermiteDecimales(qtyModal.producto.unidad) && !Number.isInteger(qty)) {
      toast.error(`"${qtyModal.producto.unidad || 'pieza'}" solo admite cantidades enteras`)
      return
    }
    const justificacion = (qtyModal.justificacion || '').trim()
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === qtyModal.producto.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: qty, justificacion }
        return copy
      }
      const p = qtyModal.producto
      return [...prev, {
        id: p.id, codigo: p.codigo, descripcion: p.descripcion,
        unidad: p.unidad, categoria: p.categoria, imagen_url: p.imagen_url || null,
        cantidad: qty, justificacion,
      }]
    })
    setQtyModal(null)
  }

  const adjustCartQty = (id, delta) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== id) return [item]
        const nueva = Math.round((item.cantidad + delta) * 10) / 10
        if (nueva <= 0) return []
        return [{ ...item, cantidad: nueva }]
      })
    )
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id))

  const handleSubmit = async () => {
    if (cart.length === 0 && cartHerr.length === 0) {
      toast.error('Agrega al menos un artículo a tu pedido')
      return
    }
    if (!proyecto.trim()) {
      toast.error('Debes seleccionar un proyecto antes de enviar la solicitud')
      return
    }
    // El backend acepta máximo 500 líneas por solicitud. Avisar antes para no
    // mostrar un error técnico de validación al enviar un carrito enorme.
    if (cart.length + cartHerr.length > 500) {
      toast.error('Máximo 500 ítems por solicitud. Divide el pedido en varias solicitudes.')
      return
    }
    setSaving(true)
    try {
      const detalles = [
        ...cart.map((item) => ({
          tipo_item: 'MATERIAL',
          producto_id: item.id,
          cantidad_solicitada: item.cantidad,
          justificacion: item.justificacion || null,
        })),
        ...cartHerr.map((item) => ({
          tipo_item: 'HERRAMIENTA',
          herramienta_id: item.herramienta_id,
          cantidad_solicitada: item.cantidad,
          fecha_uso_inicio: item.fecha_uso_inicio,
          fecha_uso_fin: item.fecha_uso_fin,
          justificacion: item.justificacion,
          complementos: item.complementos,
        })),
      ]
      await createSolicitud({
        proyecto: proyecto || null,
        proyecto_id: proyectoId ? Number(proyectoId) : null,
        notas: notas || null,
        detalles,
      })
      toast.success(`Solicitud enviada (${detalles.length} ítems)`)
      setCart([])
      setCartHerr([])
      setProyecto('')
      setProyectoId('')
      setNotas('')
      setCartOpen(false)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo enviar la solicitud'))
    } finally {
      setSaving(false)
    }
  }

  const [printingPdf, setPrintingPdf] = useState(false)
  const handlePrintPDF = async () => {
    if (cart.length === 0 && cartHerr.length === 0) {
      toast.error('Agrega artículos antes de imprimir')
      return
    }
    setPrintingPdf(true)
    try {
      await previewSolicitudPdf({
        proyecto: proyecto || null,
        notas: notas || null,
        materiales: cart.map((item) => ({
          descripcion: item.descripcion,
          codigo: item.codigo,
          categoria: item.categoria,
          unidad: item.unidad,
          cantidad: item.cantidad,
          justificacion: item.justificacion || null,
        })),
        herramientas: cartHerr.map((item) => ({
          descripcion: item.descripcion,
          sku: item.sku,
          cantidad: item.cantidad,
          fecha_uso_inicio: item.fecha_uso_inicio,
          fecha_uso_fin: item.fecha_uso_fin,
          justificacion: item.justificacion,
          complementos: item.complementos,
        })),
      })
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el PDF'))
    } finally {
      setPrintingPdf(false)
    }
  }

  const cartCount = cart.length + cartHerr.length

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShoppingCart}
        title={<span className="inline-flex items-center gap-1.5">
          Pedir material y herramientas
          <InfoTip text="Arma tu pedido: toca productos del catálogo para agregarlos, ajusta cantidades y envíalo a almacén. Lo enviado lo sigues en “Mis solicitudes”." />
        </span>}
        description="Selecciona del catálogo y arma tu solicitud para almacén."
        actions={
          cartCount > 0 && (
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
              <ShoppingCart size={14} className="text-brand-600 dark:text-brand-300" />
              <span className="text-sm font-bold text-brand-700 dark:text-brand-200">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'} en tu solicitud
              </span>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
        {/* ─── Catálogo ─── */}
        <div className="space-y-4 min-w-0">
          {/* Tabs */}
          <Card className="!p-1 inline-flex w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => setTab('materiales')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors
                ${tab === 'materiales'
                  ? 'bg-brand-700 text-white'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              <Package size={15} strokeWidth={2} />
              Materiales
              {cart.length > 0 && (
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full
                  ${tab === 'materiales' ? 'bg-white/25 text-white' : 'bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200'}`}>
                  {cart.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('herramientas')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors
                ${tab === 'herramientas'
                  ? 'bg-brand-700 text-white'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              <Hammer size={15} strokeWidth={2} />
              Herramientas
              {cartHerr.length > 0 && (
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full
                  ${tab === 'herramientas' ? 'bg-white/25 text-white' : 'bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200'}`}>
                  {cartHerr.length}
                </span>
              )}
            </button>
          </Card>

          {/* Barra de búsqueda + filtros */}
          <Card className="!p-4 space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder={tab === 'materiales' ? 'Buscar material por descripción o SKU…' : 'Buscar herramienta por SKU, marca, modelo…'}
                value={tab === 'materiales' ? search : searchHerr}
                onChange={(e) => tab === 'materiales' ? setSearch(e.target.value) : setSearchHerr(e.target.value)}
                className="block w-full h-11 pl-10 pr-3 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 outline-none transition-all"
              />
            </div>

            {tab === 'materiales' && (
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((cat) => {
                  const cfg = cat === 'Todas' ? null : getCatCfg(cat)
                  const isActive = cat === activeCat
                  const Icon = cfg?.Icon || Sparkles
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                        isActive
                          ? 'bg-brand-700 text-white border-brand-700'
                          : 'bg-ink-50 text-ink-700 border-ink-200 hover:bg-ink-100 hover:border-ink-300 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700 dark:hover:bg-ink-700'
                      }`}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {cat}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Conteo */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              <span className="font-bold text-ink-700 dark:text-ink-200">
                {tab === 'materiales' ? productos.length : herramientas.length}
              </span>{' '}
              {tab === 'materiales' ? 'materiales' : 'herramientas'} mostrados
            </p>
            {((tab === 'materiales' && prodHasMore) || (tab === 'herramientas' && herrHasMore)) && (
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                Hay más — usa “Mostrar más” o afina la búsqueda.
              </p>
            )}
          </div>

          {/* Grid */}
          {(tab === 'materiales' ? matLoading : herrLoading) ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-ink-100 dark:bg-ink-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : tab === 'materiales' ? (
            filtered.length === 0 ? (
              <Card className="p-12 text-center">
                <ImageOff size={40} className="mx-auto mb-3 text-ink-300" />
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Sin resultados</p>
                <p className="text-xs text-ink-400 mt-1">Cambia la búsqueda o el filtro de categoría</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredVisibles.map((p) => (
                    <ProductoCard
                      key={p.id}
                      producto={p}
                      enCart={cart.find((c) => c.id === p.id)}
                      onClick={() => openQtyModal(p)}
                    />
                  ))}
                </div>
                {prodHasMore && (
                  <div className="mt-4 text-center">
                    <Button variant="secondary" loading={prodLoadingMore} onClick={loadMoreProd}>
                      Mostrar más
                    </Button>
                  </div>
                )}
              </>
            )
          ) : (
            herramientasFiltradas.length === 0 ? (
              <Card className="p-12 text-center">
                <Hammer size={40} className="mx-auto mb-3 text-ink-300" />
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Sin herramientas</p>
                <p className="text-xs text-ink-400 mt-1">Ajusta la búsqueda</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {herramientasVisibles.map((h) => (
                    <HerramientaCard
                      key={h.id}
                      herramienta={h}
                      enCart={cartHerr.find((c) => c.herramienta_id === h.id)}
                      onClick={() => openHerrModal(h)}
                    />
                  ))}
                </div>
                {herrHasMore && (
                  <div className="mt-4 text-center">
                    <Button variant="secondary" loading={herrLoadingMore} onClick={loadMoreHerr}>
                      Mostrar más
                    </Button>
                  </div>
                )}
              </>
            )
          )}
        </div>

        {/* ─── Carrito ─── (panel lateral en escritorio · hoja inferior en móvil) */}
        {/* Backdrop solo móvil */}
        <div
          className={`xl:hidden fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-300 ${cartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setCartOpen(false)}
        />
        <div
          id="mi-solicitud"
          className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out
            ${cartOpen ? 'translate-y-0' : 'translate-y-full'}
            xl:sticky xl:inset-x-auto xl:bottom-auto xl:top-4 xl:z-auto xl:translate-y-0 xl:self-start`}
        >
          <Card className="!p-0 overflow-hidden rounded-b-none xl:rounded-xl flex flex-col max-h-[88vh] xl:max-h-none">
            {/* Asa de arrastre (solo móvil) */}
            <div className="xl:hidden pt-2 pb-1 flex justify-center" onClick={() => setCartOpen(false)}>
              <span className="h-1.5 w-10 rounded-full bg-ink-300 dark:bg-ink-600" />
            </div>
            {/* Header */}
            <div className="px-4 py-3 bg-brand-800 dark:bg-brand-600 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold inline-flex items-center gap-2 text-sm">
                  <ShoppingCart size={16} strokeWidth={2} />
                  Mi solicitud
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums bg-white/20 px-2 py-0.5 rounded-full">
                    {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="xl:hidden inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/20"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="p-3 space-y-3 max-h-[55vh] overflow-y-auto">
              {cart.length === 0 && cartHerr.length === 0 ? (
                <div className="text-center py-10 px-4 border-2 border-dashed border-ink-200 dark:border-ink-700 rounded-2xl">
                  <ShoppingCart size={36} className="mx-auto mb-3 text-ink-300" />
                  <p className="text-ink-500 dark:text-ink-400 text-sm font-semibold">Tu solicitud está vacía</p>
                  <p className="text-ink-400 text-xs mt-1">Agrega productos del catálogo</p>
                </div>
              ) : (
                <>
                  {cartHerr.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2 flex items-center gap-1 px-1">
                        <Hammer size={11} /> Herramientas ({cartHerr.length})
                      </p>
                      <div className="space-y-2">
                        {cartHerr.map((item) => (
                          <div key={item.herramienta_id}
                               className="flex items-center gap-2.5 p-2.5 bg-ink-50 dark:bg-ink-800/50 rounded-lg border border-ink-200 dark:border-ink-800">
                            <SafeImage
                              src={item.imagen_url}
                              alt={item.descripcion}
                              fallback={
                                <div className="w-full h-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
                                  <Hammer size={16} strokeWidth={1.8} className="text-ink-500 dark:text-ink-400" />
                                </div>
                              }
                              className="w-10 h-10 rounded-md flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold truncate leading-tight text-ink-900 dark:text-ink-100">{item.descripcion}</p>
                              <p className="text-[9px] font-mono text-ink-500 dark:text-ink-400">{item.sku} · {item.cantidad}u</p>
                              {item.fecha_uso_inicio && (
                                <p className="text-[9px] text-ink-500 mt-0.5 inline-flex items-center gap-1">
                                  <CalendarRange size={9} />
                                  {item.fecha_uso_inicio} → {item.fecha_uso_fin || '?'}
                                </p>
                              )}
                            </div>
                            <button type="button" onClick={() => removeHerr(item.herramienta_id)}
                                    className="text-ink-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-white dark:hover:bg-ink-900 flex-shrink-0"
                                    title="Quitar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div>
                      {cartHerr.length > 0 && <div className="h-px bg-ink-200 dark:bg-ink-700 my-3" />}
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2 flex items-center gap-1 px-1">
                        <Package size={11} /> Materiales ({cart.length})
                      </p>
                      <div className="space-y-2">
                        {cart.map((item) => {
                          const cfg = getCatCfg(item.categoria)
                          const Icon = cfg.Icon
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2.5 p-2.5 bg-ink-50 dark:bg-ink-800/50 rounded-lg border border-ink-200 dark:border-ink-800"
                            >
                              <SafeImage
                                src={item.imagen_url}
                                alt={item.descripcion}
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center bg-ink-100 dark:bg-ink-800">
                                    <Icon size={16} strokeWidth={1.8} className="text-ink-500 dark:text-ink-400" />
                                  </div>
                                }
                                className="w-10 h-10 rounded-md flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-ink-900 dark:text-ink-100 truncate leading-tight">
                                  {item.descripcion}
                                </p>
                                <p className="text-[9px] font-mono text-ink-500 dark:text-ink-400">{item.codigo}</p>
                              </div>
                              <div className="inline-flex items-center gap-0.5 bg-white dark:bg-ink-900 rounded-md border border-ink-200 dark:border-ink-700 px-0.5">
                                <button
                                  type="button"
                                  onClick={() => adjustCartQty(item.id, -1)}
                                  className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 rounded transition-colors"
                                >
                                  <Minus size={12} strokeWidth={2} />
                                </button>
                                <span className="text-[11px] font-semibold tabular-nums min-w-[20px] text-center text-ink-900 dark:text-ink-100">{item.cantidad}</span>
                                <button
                                  type="button"
                                  onClick={() => adjustCartQty(item.id, +1)}
                                  className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 rounded transition-colors"
                                >
                                  <Plus size={12} strokeWidth={2} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                className="text-ink-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-white dark:hover:bg-ink-900 flex-shrink-0"
                                title="Quitar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-ink-200 dark:border-ink-800 space-y-3 bg-ink-50/50 dark:bg-ink-950/50">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5 block inline-flex items-center gap-1.5">
                  <FolderKanban size={11} /> Proyecto <span className="text-red-500">*</span>
                </label>
                <Select
                  value={proyectoId}
                  onChange={(e) => {
                    const pid = e.target.value
                    setProyectoId(pid)
                    const p = proyectos.find((x) => String(x.id) === pid)
                    setProyecto(p ? `${p.numero_proyecto} — ${p.nombre || ''}`.trim() : '')
                  }}
                >
                  <option value="">Selecciona un proyecto…</option>
                  {proyectos.map((p) => {
                    const txt = `${p.numero_proyecto} — ${p.nombre || ''}`.trim()
                    return <option key={p.id} value={p.id}>{txt}</option>
                  })}
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5 block inline-flex items-center gap-1.5">
                  <FileText size={11} /> Observaciones (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas para el almacén…"
                  rows={2}
                  className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all resize-none"
                />
              </div>

              <Button
                onClick={handleSubmit}
                loading={saving}
                disabled={cartCount === 0 || !proyecto.trim()}
                leftIcon={<Send size={14} />}
                className="w-full"
                title={cartCount === 0 ? 'Agrega productos al pedido primero' : !proyecto.trim() ? 'Selecciona un proyecto para poder enviar' : 'Enviar el pedido a almacén'}
              >
                Enviar solicitud
              </Button>
              {cartCount > 0 && !proyecto.trim() && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                  Selecciona un proyecto para poder enviar.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={handlePrintPDF}
                disabled={cartCount === 0}
                loading={printingPdf}
                leftIcon={<Printer size={14} />}
                className="w-full"
                title="Generar un PDF del pedido sin enviarlo (vista previa)"
              >
                Imprimir PDF
              </Button>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="xl:hidden w-full text-center text-xs font-semibold text-brand-700 dark:text-brand-300 py-1"
              >
                Seguir agregando productos
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Botón flotante (solo móvil): abre la hoja del pedido como en una app. */}
      {cartCount > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="xl:hidden fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 pl-4 pr-5 h-12 rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/30 active:scale-95 transition-transform"
          aria-label="Ver mi solicitud"
        >
          <span className="relative inline-flex">
            <ShoppingCart size={20} strokeWidth={2} />
            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-white text-brand-700">
              {cartCount}
            </span>
          </span>
          <span className="text-sm font-semibold">Ver pedido</span>
        </button>
      )}

      {/* ─── Modal cantidad (material) ─── */}
      <Modal
        open={!!qtyModal}
        onClose={() => setQtyModal(null)}
        title="Cantidad a solicitar"
        footer={
          <>
            <Button variant="secondary" onClick={() => setQtyModal(null)} leftIcon={<X size={14} />}>
              Cancelar
            </Button>
            <Button onClick={confirmQty} leftIcon={<Check size={14} strokeWidth={3} />}>
              Agregar al pedido
            </Button>
          </>
        }
      >
        {qtyModal && (
          <div className="space-y-5">
            {/* Card de producto con foto */}
            <div className="flex gap-4 items-center p-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
              <SafeImage
                src={qtyModal.producto.imagen_url}
                alt={qtyModal.producto.descripcion}
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-ink-100 dark:bg-ink-800">
                    {(() => {
                      const Icon = getCatCfg(qtyModal.producto.categoria).Icon
                      return <Icon size={26} strokeWidth={1.5} className="text-ink-500 dark:text-ink-400" />
                    })()}
                  </div>
                }
                className="w-20 h-20 rounded-lg flex-shrink-0 border border-ink-200 dark:border-ink-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">{qtyModal.producto.descripcion}</p>
                <p className="text-xs text-ink-500 font-mono mt-1">{qtyModal.producto.codigo}</p>
                <p className="text-[11px] text-ink-500 mt-1">
                  Stock disponible:{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {qtyModal.producto.stock_actual} {qtyModal.producto.unidad}
                  </strong>
                </p>
              </div>
            </div>

            <QtyStepper
              value={qtyModal.cantidad}
              onChange={(v) => setQtyModal({ ...qtyModal, cantidad: v })}
              step={1}
              min={unidadPermiteDecimales(qtyModal.producto.unidad) ? 0.1 : 1}
              unidad={qtyModal.producto.unidad}
              decimals={unidadPermiteDecimales(qtyModal.producto.unidad)}
            />
            {!unidadPermiteDecimales(qtyModal.producto.unidad) && (
              <p className="text-center text-[11px] text-ink-500 mt-2">
                Este producto se pide en cantidades enteras.
              </p>
            )}

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5 block">
                Justificación / observación (opcional)
              </label>
              <textarea
                value={qtyModal.justificacion}
                onChange={(e) => setQtyModal({ ...qtyModal, justificacion: e.target.value })}
                rows={2}
                maxLength={2000}
                placeholder="¿Para qué lo necesitas? ¿En qué proyecto?"
                className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal herramienta ─── */}
      <Modal
        open={!!herrModal}
        onClose={() => setHerrModal(null)}
        title="Solicitar herramienta"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setHerrModal(null)} leftIcon={<X size={14} />}>
              Cancelar
            </Button>
            <Button onClick={confirmHerr} leftIcon={<Check size={14} strokeWidth={3} />}>
              Agregar al pedido
            </Button>
          </>
        }
      >
        {herrModal && (
          <div className="space-y-5">
            {/* Card de herramienta con foto */}
            <div className="flex gap-4 items-center p-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
              <SafeImage
                src={herrModal.herr.imagen_url}
                alt={herrModal.herr.descripcion}
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-ink-100 dark:bg-ink-800">
                    <Hammer size={26} strokeWidth={1.5} className="text-ink-500 dark:text-ink-400" />
                  </div>
                }
                className="w-20 h-20 rounded-lg flex-shrink-0 border border-ink-200 dark:border-ink-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">{herrModal.herr.descripcion}</p>
                <p className="text-xs text-ink-500 font-mono mt-1">{herrModal.herr.sku}</p>
                {(herrModal.herr.marca || herrModal.herr.modelo) && (
                  <p className="text-[11px] text-ink-500 mt-1">
                    {herrModal.herr.marca || ''} {herrModal.herr.modelo || ''}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Cantidad"
                type="number" min={1} step={1}
                value={herrModal.cantidad}
                onChange={(e) => setHerrModal({ ...herrModal, cantidad: e.target.value })}
              />
              <Input
                label="Uso desde"
                type="date"
                value={herrModal.fecha_uso_inicio}
                onChange={(e) => setHerrModal({ ...herrModal, fecha_uso_inicio: e.target.value })}
              />
              <Input
                label="Uso hasta"
                type="date"
                value={herrModal.fecha_uso_fin}
                onChange={(e) => setHerrModal({ ...herrModal, fecha_uso_fin: e.target.value })}
              />
            </div>

            <Input
              label="Complementos (opcional)"
              value={herrModal.complementos}
              onChange={(e) => setHerrModal({ ...herrModal, complementos: e.target.value })}
              placeholder="Brocas SDS, batería extra, juego de puntas…"
              maxLength={500}
            />

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1.5 block inline-flex items-center gap-1.5">
                <FileText size={11} /> Justificación <span className="text-red-600">*</span>
              </label>
              <textarea
                value={herrModal.justificacion}
                onChange={(e) => setHerrModal({ ...herrModal, justificacion: e.target.value })}
                rows={3} maxLength={2000}
                placeholder="¿Para qué la necesitas? ¿En qué proyecto?"
                className="w-full rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 outline-none transition-all resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
