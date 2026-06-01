import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Send, Plus, Minus, Check, Trash2, Search, ShoppingCart,
  Wrench, Hexagon, Circle, ArrowDown, GitBranch, Boxes as BoxesIcon,
  Pipette, Printer, Package, Hammer, ImageOff, FolderKanban,
  CalendarRange, FileText, Settings2, Sparkles, X,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Input, Select,
} from '../../components/ui'
import { getProductos, createSolicitud, getProyectosInventario, previewSolicitudPdf } from '../../api/inventario'
import { getHerramientas } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

// ─── Catálogo visual de categorías (fallback cuando no hay imagen) ────────────
const CAT_CFG = {
  'Tornillería':        { color: '#4F46E5', bg: '#EEF2FF', Icon: Wrench },
  'Tuercas':            { color: '#B45309', bg: '#FFFBEB', Icon: Hexagon },
  'Rondanas':           { color: '#0891B2', bg: '#ECFEFF', Icon: Circle },
  'Pijas':              { color: '#7C3AED', bg: '#F5F3FF', Icon: ArrowDown },
  'Abrazaderas':        { color: '#059669', bg: '#ECFDF5', Icon: GitBranch },
  'Soportería':         { color: '#DC2626', bg: '#FEF2F2', Icon: BoxesIcon },
  'Tubería/Accesorios': { color: '#0284C7', bg: '#F0F9FF', Icon: Pipette },
}
const CAT_DEFAULT = { color: '#6B7280', bg: '#F3F4F6', Icon: Package }
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
function QtyStepper({ value, onChange, step = 1, min = 0.1, unidad = '' }) {
  const dec = () => onChange(Math.max(min, Math.round((Number(value) - step) * 10) / 10))
  const inc = () => onChange(Math.round((Number(value) + step) * 10) / 10)
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={dec}
        className="w-12 h-12 rounded-xl bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 flex items-center justify-center transition-colors">
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <div className="flex flex-col items-center">
        <input
          type="number"
          step={step} min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-32 h-14 text-center text-3xl font-black text-ink-900 dark:text-ink-100 rounded-xl border-2 border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none"
        />
        {unidad && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mt-1">{unidad}</span>
        )}
      </div>
      <button type="button" onClick={inc}
        className="w-12 h-12 rounded-xl bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-colors shadow-sm">
        <Plus size={18} strokeWidth={2.5} />
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
      className={`group relative flex flex-col bg-white dark:bg-ink-900 border rounded-2xl text-left overflow-hidden transition-all
        ${enCart
          ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/30 shadow-md'
          : 'border-ink-200 dark:border-ink-800 hover:border-brand-400 dark:hover:border-brand-500 hover:shadow-lg hover:-translate-y-0.5'}`}
    >
      {/* Imagen */}
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-950 overflow-hidden">
        <SafeImage
          src={producto.imagen_url}
          alt={producto.descripcion}
          fallback={
            <div className="w-full h-full flex items-center justify-center"
                 style={{ background: cfg.bg }}>
              <Icon size={48} strokeWidth={1.5} style={{ color: cfg.color }} />
            </div>
          }
          className="w-full h-full"
        />
        {/* Badge categoría flotante */}
        <span
          className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {producto.categoria || 'General'}
        </span>
        {/* Indicador en carrito */}
        {enCart && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shadow-md">
            <Check size={14} strokeWidth={3} />
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-[13px] font-bold text-ink-900 dark:text-ink-100 line-clamp-2 leading-tight">
          {producto.descripcion}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 px-1.5 py-0.5 rounded uppercase font-mono">
            {producto.codigo}
          </span>
          <span className={`text-[11px] font-bold ${bajo ? 'text-rose-500' : 'text-emerald-500'}`}>
            {Number.isInteger(stock) ? stock : stock.toFixed(1)} {producto.unidad}
          </span>
        </div>
      </div>
      {/* Botón hover */}
      <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-brand-500 group-hover:bg-brand-600 text-white inline-flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
        {enCart ? <Settings2 size={16} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={3} />}
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
      className={`group relative flex flex-col bg-white dark:bg-ink-900 border rounded-2xl text-left overflow-hidden transition-all
        ${enCart
          ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/30 shadow-md'
          : 'border-ink-200 dark:border-ink-800 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-lg hover:-translate-y-0.5'}`}
    >
      <div className="relative aspect-square bg-ink-50 dark:bg-ink-950 overflow-hidden">
        <SafeImage
          src={herramienta.imagen_url}
          alt={herramienta.descripcion}
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-amber-50 dark:bg-amber-950/30">
              <Hammer size={48} strokeWidth={1.5} className="text-amber-500 dark:text-amber-400" />
            </div>
          }
          className="w-full h-full"
        />
        <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          {herramienta.clasificacion || 'Herramienta'}
        </span>
        {enCart && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shadow-md">
            <Check size={14} strokeWidth={3} />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <p className="text-[13px] font-bold text-ink-900 dark:text-ink-100 line-clamp-2 leading-tight">
          {herramienta.descripcion}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 px-1.5 py-0.5 rounded uppercase font-mono">
            {herramienta.sku}
          </span>
          {(herramienta.marca || herramienta.modelo) && (
            <span className="text-[11px] font-semibold text-ink-500 dark:text-ink-400 truncate">
              {herramienta.marca || ''} {herramienta.modelo || ''}
            </span>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-amber-500 group-hover:bg-amber-600 text-white inline-flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
        {enCart ? <Settings2 size={16} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={3} />}
      </div>
    </button>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function MisPedidos() {
  const [tab, setTab] = useState('materiales')   // 'materiales' | 'herramientas'

  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [searchHerr, setSearchHerr] = useState('')
  const [activeCat, setActiveCat] = useState('Todas')
  const [proyecto, setProyecto] = useState('')
  const [notas, setNotas] = useState('')

  const [cart, setCart] = useState([])             // materiales
  const [cartHerr, setCartHerr] = useState([])     // herramientas
  const [qtyModal, setQtyModal] = useState(null)   // material { producto, cantidad }
  const [herrModal, setHerrModal] = useState(null) // herramienta { herr, cantidad, fechas, justif, complem }

  // El solicitante necesita ver el catálogo actualizado. Reusamos los
  // mismos namespaces que el rol inventario para compartir caché.
  const { data: rawProductos, error: errProd } = useResource(
    ['productos', { limit: 500 }],
    () => getProductos({ limit: 500 }),
    { staleMs: 60_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
  )
  const { data: rawHerramientas, error: errHerr } = useResource(
    ['herramientas', 'catalogo'],
    () => getHerramientas({ limit: 500 }),
    { staleMs: 60_000, invalidateOn: ['herramienta:changed'] },
  )
  const { data: rawProyectos, error: errProj } = useResource(
    ['proyectos-inventario'],
    () => getProyectosInventario(),
    { staleMs: 120_000, invalidateOn: ['proyecto:changed'] },
  )
  const productos = rawProductos ?? []
  const herramientas = rawHerramientas ?? []
  const proyectos = rawProyectos ?? []
  const loading = !rawProductos && !rawHerramientas && !rawProyectos

  useEffect(() => {
    const err = errProd || errHerr || errProj
    if (err) toast.error(extractApiError(err, 'Error al cargar catálogo'))
  }, [errProd, errHerr, errProj])

  // ─── Herramientas ─────────────────────────────────────────────────────────
  const herramientasFiltradas = useMemo(() => {
    const q = searchHerr.toLowerCase().trim()
    if (!q) return herramientas
    return herramientas.filter((h) => (
      h.sku?.toLowerCase().includes(q) ||
      h.descripcion?.toLowerCase().includes(q) ||
      h.marca?.toLowerCase().includes(q) ||
      h.modelo?.toLowerCase().includes(q) ||
      h.clasificacion?.toLowerCase().includes(q)
    ))
  }, [herramientas, searchHerr])

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

  const categorias = useMemo(() => {
    const set = new Set()
    productos.forEach((p) => p.categoria && set.add(p.categoria))
    return ['Todas', ...Array.from(set).sort()]
  }, [productos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return productos.filter((p) => {
      const matchCat = activeCat === 'Todas' || p.categoria === activeCat
      const matchQ = !q || p.descripcion?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [productos, activeCat, search])

  const openQtyModal = (producto) => {
    const enCart = cart.find((c) => c.id === producto.id)
    setQtyModal({ producto, cantidad: enCart ? enCart.cantidad : 1 })
  }

  const confirmQty = () => {
    if (!qtyModal) return
    const qty = Number(qtyModal.cantidad)
    if (!qty || qty <= 0) {
      toast.error('La cantidad debe ser mayor a cero')
      return
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === qtyModal.producto.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: qty }
        return copy
      }
      const p = qtyModal.producto
      return [...prev, {
        id: p.id, codigo: p.codigo, descripcion: p.descripcion,
        unidad: p.unidad, categoria: p.categoria, imagen_url: p.imagen_url || null,
        cantidad: qty,
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
    setSaving(true)
    try {
      const detalles = [
        ...cart.map((item) => ({
          tipo_item: 'MATERIAL',
          producto_id: item.id,
          cantidad_solicitada: item.cantidad,
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
      await createSolicitud({ proyecto: proyecto || null, detalles })
      toast.success(`Solicitud enviada (${detalles.length} ítems)`)
      setCart([])
      setCartHerr([])
      setProyecto('')
      setNotas('')
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
        title="Pedir material y herramientas"
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
          <Card className="!p-1.5 inline-flex w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => setTab('materiales')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2 transition-all
                ${tab === 'materiales'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              <Package size={16} strokeWidth={2.5} />
              Materiales
              {cart.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full
                  ${tab === 'materiales' ? 'bg-white/25 text-white' : 'bg-brand-500 text-white'}`}>
                  {cart.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('herramientas')}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2 transition-all
                ${tab === 'herramientas'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              <Hammer size={16} strokeWidth={2.5} />
              Herramientas
              {cartHerr.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full
                  ${tab === 'herramientas' ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'}`}>
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
                  const isAll = cat === 'Todas'
                  const cfg = isAll ? null : getCatCfg(cat)
                  const isActive = cat === activeCat
                  const style = cfg
                    ? {
                        color: isActive ? 'white' : cfg.color,
                        background: isActive ? cfg.color : cfg.bg,
                        borderColor: isActive ? cfg.color : 'transparent',
                      }
                    : {
                        color: isActive ? 'white' : '#374151',
                        background: isActive ? '#111827' : '#F3F4F6',
                        borderColor: 'transparent',
                      }
                  const Icon = cfg?.Icon || Sparkles
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(cat)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all hover:scale-105 active:scale-95"
                      style={style}
                    >
                      <Icon size={12} strokeWidth={2.5} />
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
                {tab === 'materiales' ? filtered.length : herramientasFiltradas.length}
              </span>{' '}
              {tab === 'materiales' ? 'materiales' : 'herramientas'} disponibles
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map((p) => (
                  <ProductoCard
                    key={p.id}
                    producto={p}
                    enCart={cart.find((c) => c.id === p.id)}
                    onClick={() => openQtyModal(p)}
                  />
                ))}
              </div>
            )
          ) : (
            herramientasFiltradas.length === 0 ? (
              <Card className="p-12 text-center">
                <Hammer size={40} className="mx-auto mb-3 text-ink-300" />
                <p className="text-sm font-semibold text-ink-600 dark:text-ink-300">Sin herramientas</p>
                <p className="text-xs text-ink-400 mt-1">Ajusta la búsqueda</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {herramientasFiltradas.map((h) => (
                  <HerramientaCard
                    key={h.id}
                    herramienta={h}
                    enCart={cartHerr.find((c) => c.herramienta_id === h.id)}
                    onClick={() => openHerrModal(h)}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* ─── Carrito ─── */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="!p-0 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-bold inline-flex items-center gap-2">
                  <ShoppingCart size={18} strokeWidth={2.5} />
                  Mi solicitud
                </h3>
                <span className="text-xs font-black bg-white/25 px-2.5 py-1 rounded-full">
                  {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
                </span>
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
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-2 flex items-center gap-1 px-1">
                        <Hammer size={11} /> Herramientas ({cartHerr.length})
                      </p>
                      <div className="space-y-2">
                        {cartHerr.map((item) => (
                          <div key={item.herramienta_id}
                               className="flex items-center gap-2.5 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                            <SafeImage
                              src={item.imagen_url}
                              alt={item.descripcion}
                              fallback={
                                <div className="w-full h-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                                  <Hammer size={16} strokeWidth={2.5} className="text-amber-700 dark:text-amber-200" />
                                </div>
                              }
                              className="w-10 h-10 rounded-lg flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold truncate leading-tight text-ink-900 dark:text-ink-100">{item.descripcion}</p>
                              <p className="text-[9px] font-black text-ink-400 uppercase">{item.sku} · {item.cantidad}u</p>
                              {item.fecha_uso_inicio && (
                                <p className="text-[9px] text-ink-500 mt-0.5 inline-flex items-center gap-1">
                                  <CalendarRange size={9} />
                                  {item.fecha_uso_inicio} → {item.fecha_uso_fin || '?'}
                                </p>
                              )}
                            </div>
                            <button type="button" onClick={() => removeHerr(item.herramienta_id)}
                                    className="text-ink-300 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-white dark:hover:bg-ink-900 flex-shrink-0"
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
                      <p className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-300 mb-2 flex items-center gap-1 px-1">
                        <Package size={11} /> Materiales ({cart.length})
                      </p>
                      <div className="space-y-2">
                        {cart.map((item) => {
                          const cfg = getCatCfg(item.categoria)
                          const Icon = cfg.Icon
                          return (
                            <div
                              key={item.id}
                              className="flex items-center gap-2.5 p-2.5 bg-ink-50 dark:bg-ink-800/50 rounded-xl border border-ink-200 dark:border-ink-800"
                            >
                              <SafeImage
                                src={item.imagen_url}
                                alt={item.descripcion}
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center" style={{ background: cfg.bg }}>
                                    <Icon size={16} strokeWidth={2.5} style={{ color: cfg.color }} />
                                  </div>
                                }
                                className="w-10 h-10 rounded-lg flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-ink-900 dark:text-ink-100 truncate leading-tight">
                                  {item.descripcion}
                                </p>
                                <p className="text-[9px] font-black text-ink-400 uppercase">{item.codigo}</p>
                              </div>
                              <div className="inline-flex items-center gap-0.5 bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-700 px-0.5">
                                <button
                                  type="button"
                                  onClick={() => adjustCartQty(item.id, -1)}
                                  className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-brand-600 dark:hover:text-brand-300 rounded transition-colors"
                                >
                                  <Minus size={12} strokeWidth={3} />
                                </button>
                                <span className="text-[11px] font-black min-w-[20px] text-center text-ink-900 dark:text-ink-100">{item.cantidad}</span>
                                <button
                                  type="button"
                                  onClick={() => adjustCartQty(item.id, +1)}
                                  className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-brand-600 dark:hover:text-brand-300 rounded transition-colors"
                                >
                                  <Plus size={12} strokeWidth={3} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                className="text-ink-300 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-white dark:hover:bg-ink-900 flex-shrink-0"
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
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1.5 block inline-flex items-center gap-1.5">
                  <FolderKanban size={11} /> Proyecto
                </label>
                <Select
                  value={proyecto}
                  onChange={(e) => setProyecto(e.target.value)}
                >
                  <option value="">Sin proyecto asociado</option>
                  {proyectos.map((p) => {
                    const txt = `${p.numero_proyecto} — ${p.nombre || ''}`.trim()
                    return <option key={p.id} value={txt}>{txt}</option>
                  })}
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1.5 block inline-flex items-center gap-1.5">
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
                disabled={cartCount === 0}
                leftIcon={<Send size={14} />}
                className="w-full"
              >
                Enviar solicitud
              </Button>
              <Button
                variant="secondary"
                onClick={handlePrintPDF}
                disabled={cartCount === 0}
                loading={printingPdf}
                leftIcon={<Printer size={14} />}
                className="w-full"
              >
                Imprimir PDF
              </Button>
            </div>
          </Card>
        </div>
      </div>

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
            <div className="flex gap-4 items-center p-3 rounded-xl bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
              <SafeImage
                src={qtyModal.producto.imagen_url}
                alt={qtyModal.producto.descripcion}
                fallback={
                  <div className="w-full h-full flex items-center justify-center"
                       style={{ background: getCatCfg(qtyModal.producto.categoria).bg }}>
                    {(() => {
                      const Icon = getCatCfg(qtyModal.producto.categoria).Icon
                      return <Icon size={28} strokeWidth={1.5} style={{ color: getCatCfg(qtyModal.producto.categoria).color }} />
                    })()}
                  </div>
                }
                className="w-20 h-20 rounded-xl flex-shrink-0 border border-ink-200 dark:border-ink-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-ink-900 dark:text-ink-100 leading-tight">{qtyModal.producto.descripcion}</p>
                <p className="text-xs text-ink-500 font-mono mt-1">{qtyModal.producto.codigo}</p>
                <p className="text-[11px] text-ink-500 mt-1">
                  Stock disponible:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {qtyModal.producto.stock_actual} {qtyModal.producto.unidad}
                  </strong>
                </p>
              </div>
            </div>

            <QtyStepper
              value={qtyModal.cantidad}
              onChange={(v) => setQtyModal({ ...qtyModal, cantidad: v })}
              step={1}
              min={0.1}
              unidad={qtyModal.producto.unidad}
            />
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
            <div className="flex gap-4 items-center p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50">
              <SafeImage
                src={herrModal.herr.imagen_url}
                alt={herrModal.herr.descripcion}
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/50">
                    <Hammer size={28} strokeWidth={1.5} className="text-amber-600 dark:text-amber-300" />
                  </div>
                }
                className="w-20 h-20 rounded-xl flex-shrink-0 border border-amber-200 dark:border-amber-800/50"
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-ink-900 dark:text-ink-100 leading-tight">{herrModal.herr.descripcion}</p>
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
              <label className="text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1.5 block inline-flex items-center gap-1.5">
                <FileText size={11} /> Justificación <span className="text-rose-500">*</span>
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
