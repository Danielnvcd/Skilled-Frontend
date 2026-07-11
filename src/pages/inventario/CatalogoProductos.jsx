import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Package, PackageSearch, Plus, Search, Trash2, Edit2, Image as ImageIcon, Warehouse, History, SlidersHorizontal, X, Cable, ChevronRight, ChevronLeft, LayoutGrid, List } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Select, Badge, CableTag, Pagination,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getProductosPaginado, getCategoriasResumen, createProducto, updateProducto, deleteProducto,
  getCategorias, getCategoriasConfig, upsertCategoriaConfig, deleteCategoriaConfig,
  deleteCategoriaConProductos,
  getProductoStocks, getProductosConCompraActiva, getUnidadesProductos,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { unidadPermiteDecimales } from '../../utils/unidades'
import { esCategoriaCable, CABLE_UNIDAD } from '../../utils/cable'
import { useResource } from '../../hooks/useResource'
import { invalidate } from '../../utils/resourceCache'
import { Upload } from 'lucide-react'

export default function CatalogoProductos() {
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [categorias, setCategorias] = useState([])

  // "Ver todos los materiales": lista el catálogo completo (todas las categorías)
  // sin entrar a una. La cuadrícula de categorías es la vista por defecto.
  const [verTodos, setVerTodos] = useState(false)
  // Modo de vista de la lista: 'galeria' (fotos grandes) o 'tabla'. Se recuerda.
  const [vista, setVista] = useState(() => {
    try { return localStorage.getItem('catalogo_vista') || 'galeria' } catch { return 'galeria' }
  })
  useEffect(() => {
    try { localStorage.setItem('catalogo_vista', vista) } catch { /* ignore */ }
  }, [vista])

  // Filtros avanzados del catálogo (server-side, combinables con categoría/búsqueda).
  const [stockFiltro, setStockFiltro] = useState('')   // '' | 'bajo' | 'sin'
  const [imagenFiltro, setImagenFiltro] = useState('') // '' | 'con' | 'sin'
  const [unidadFiltro, setUnidadFiltro] = useState('') // '' | <unidad>
  const [compraFiltro, setCompraFiltro] = useState(false) // solo con compra en curso
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [unidades, setUnidades] = useState([])
  useEffect(() => {
    getUnidadesProductos().then(setUnidades).catch(() => {})
  }, [])
  const nFiltros = (stockFiltro ? 1 : 0) + (imagenFiltro ? 1 : 0) + (unidadFiltro ? 1 : 0) + (compraFiltro ? 1 : 0)
  const limpiarFiltros = () => { setStockFiltro(''); setImagenFiltro(''); setUnidadFiltro(''); setCompraFiltro(false) }

  const [openForm, setOpenForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    codigo: '', descripcion: '', categoria: '', unidad: 'pza', stock_actual: 0, stock_minimo: 0, precio_unitario: 0, imagen_url: '', cable_tipo: '', cable_calibre: ''
  })
  // ¿La categoría elegida es de cable? Activa los campos Tipo/Tamaño y fuerza unidad M.
  const esCable = esCategoriaCable(form.categoria)

  // Preview de imagen con debounce 500ms: evita disparar requests por cada tecla
  const [imagePreview, setImagePreview] = useState('')
  const [imageError, setImageError] = useState(false)
  useEffect(() => {
    const url = (form.imagen_url || '').trim()
    setImageError(false)
    if (!url) { setImagePreview(''); return }
    const t = setTimeout(() => setImagePreview(url), 500)
    return () => clearTimeout(t)
  }, [form.imagen_url])
  
  // Modal de categoría: { mode: 'new' | 'edit', nombre, imagen_url, original? }
  const [catModal, setCatModal] = useState(null)
  // Mapa { nombreCategoria: imagen_url } persistido en localStorage.
  // Se aplica a TODAS las categorías (incluidas las del backend), no solo a las custom.
  const [catImages, setCatImages] = useState({})

  // Preview de imagen del modal de categoría (debounce 500ms)
  const [catPreview, setCatPreview] = useState('')
  const [catPreviewError, setCatPreviewError] = useState(false)
  useEffect(() => {
    const url = (catModal?.imagen_url || '').trim()
    setCatPreviewError(false)
    if (!url) { setCatPreview(''); return }
    const t = setTimeout(() => setCatPreview(url), 500)
    return () => clearTimeout(t)
  }, [catModal?.imagen_url])

  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Eliminar categoría con todos sus productos: { nombre, total }.
  const [confirmDelCat, setConfirmDelCat] = useState(null)
  const [deletingCat, setDeletingCat] = useState(false)

  // Desglose de stock por bodega (Pausa 2): null = cerrado, objeto = producto seleccionado.
  const [stocksModal, setStocksModal] = useState(null)
  const [stocksData, setStocksData] = useState(null)
  const [loadingStocks, setLoadingStocks] = useState(false)

  useEffect(() => {
    if (!stocksModal) { setStocksData(null); return }
    let cancel = false
    setLoadingStocks(true)
    getProductoStocks(stocksModal.id, { incluirVacios: true })
      .then((d) => { if (!cancel) setStocksData(d) })
      .catch(() => { if (!cancel) setStocksData(null) })
      .finally(() => { if (!cancel) setLoadingStocks(false) })
    return () => { cancel = true }
  }, [stocksModal])

  // Búsqueda con debounce: no le pegamos al server en cada tecla.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Vista de lista cuando se pide "ver todos", hay categoría, texto de búsqueda o
  // algún filtro avanzado. Si no, se muestra la cuadrícula de categorías.
  const mostrarLista = !!(verTodos || categoriaFiltro || search.trim() || nFiltros > 0)
  // El fetch se habilita con el término ya "asentado" (debounced) o filtros activos.
  const fetchHabilitado = !!(verTodos || categoriaFiltro || debouncedSearch || nFiltros > 0)

  // Volver a la cuadrícula de categorías: limpia todo lo que fuerza la lista.
  const volverACategorias = () => {
    setVerTodos(false)
    setCategoriaFiltro('')
    setSearch('')
    setDebouncedSearch('')
    limpiarFiltros()
  }

  // Resumen de categorías (conteos) para las tarjetas — server-side.
  const {
    data: resumen,
    loading: loadingResumen,
  } = useResource(
    ['categorias-resumen'],
    () => getCategoriasResumen(),
    { staleMs: 30_000, invalidateOn: ['producto:changed', 'movimiento:changed'] },
  )
  const categoriasResumen = resumen ?? []

  // Productos filtrados + paginados por páginas (server-side): con miles de
  // productos un `limit` fijo dejaba inalcanzables los que sobraran del tope.
  // Ahora se pide una página a la vez a /productos/paginado (con total y nº de
  // páginas) y el paginador numérico navega TODO el catálogo sin bajarlo entero.
  // Solo pide cuando hay filtro/búsqueda activa (la vista por defecto son las
  // tarjetas de categoría). Sigue por useResource → cache + tiempo real.
  const PROD_PAGE_SIZE = 50
  const [pageProd, setPageProd] = useState(0)  // 0-based (para <Pagination>)
  // Cambiar cualquier filtro/búsqueda vuelve a la primera página.
  useEffect(() => { setPageProd(0) }, [verTodos, categoriaFiltro, debouncedSearch, stockFiltro, imagenFiltro, unidadFiltro, compraFiltro])

  const {
    data: rawProductos,
    loading: loadingProductos,
    error,
    refetch,
  } = useResource(
    ['productos', { page: pageProd, categoria: categoriaFiltro, q: debouncedSearch, stock: stockFiltro, imagen: imagenFiltro, unidad: unidadFiltro, compra: compraFiltro }],
    () => getProductosPaginado({ page: pageProd + 1, perPage: PROD_PAGE_SIZE, categoria: categoriaFiltro, q: debouncedSearch, stock: stockFiltro, imagen: imagenFiltro, unidad: unidadFiltro, compra: compraFiltro }),
    {
      enabled: fetchHabilitado,
      staleMs: 30_000,
      invalidateOn: ['producto:changed', 'movimiento:changed'],
    },
  )
  const pageData = rawProductos ?? { items: [], total: 0, pages: 1 }
  const filtered = fetchHabilitado ? pageData.items : []
  const totalProductos = pageData.total || 0
  const totalPagesProd = pageData.pages || 1
  // Las columnas Tipo/Tamaño (cable) solo se muestran si en la vista hay algún
  // producto de cable — en categorías normales no aparecen (sin "—" de relleno).
  const hayCableEnLista = filtered.some(
    (p) => esCategoriaCable(p.categoria) || p.cable_tipo || p.cable_calibre,
  )

  // Productos con solicitud de compra activa (PENDIENTE/ORDENADA) → badge "En compra".
  const { data: comprasActivas } = useResource(
    ['solicitudes-compra', 'productos-activos'],
    () => getProductosConCompraActiva(),
    { staleMs: 60_000, invalidateOn: ['compra:changed'], enabled: fetchHabilitado },
  )
  const compraPorProducto = useMemo(() => {
    const m = new Map()
    for (const c of (comprasActivas ?? [])) {
      if (!m.has(c.producto_id)) m.set(c.producto_id, c)  // la más reciente (orden desc del backend)
    }
    return m
  }, [comprasActivas])
  // Mientras el debounce se asienta mostramos el skeleton para no parpadear
  // "Sin productos".
  const buscando = search.trim() !== debouncedSearch
  const loading = mostrarLista ? (loadingProductos || buscando) : loadingResumen

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar productos'))
  }, [error])

  // Tras crear/editar/borrar refrescamos productos + conteos de categorías.
  const load = () => {
    refetch()
    invalidate('productos')
    invalidate('categorias-resumen')
  }

  const loadCategorias = async () => {
    try {
      const [cats, cfgs] = await Promise.all([
        getCategorias(),
        getCategoriasConfig().catch(() => []),
      ])
      // getCategorias ya hace la unión productos ∪ categorias_config en backend
      setCategorias(cats)
      const map = {}
      cfgs.forEach((c) => { if (c.imagen_url) map[c.nombre] = c.imagen_url })
      setCatImages(map)
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    loadCategorias()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Cable: la unidad efectiva es siempre M (metros), aunque el campo esté bloqueado.
    const unidadEfectiva = esCable ? CABLE_UNIDAD : form.unidad
    // Cable: Tipo y Tamaño son obligatorios (espeja la validación del backend).
    if (esCable && (!form.cable_tipo.trim() || !form.cable_calibre.trim())) {
      toast.error('Los productos de cable requieren Tipo y Tamaño (mm²/AWG)')
      return
    }
    // Decimales según unidad: pieza/caja → enteros; kg/m/litro → admiten decimales.
    if (!unidadPermiteDecimales(unidadEfectiva)) {
      const sa = Number(form.stock_actual)
      const sm = Number(form.stock_minimo)
      if (!Number.isInteger(sa) || !Number.isInteger(sm)) {
        toast.error(`La unidad "${unidadEfectiva || 'pza'}" maneja cantidades enteras (sin decimales en el stock)`)
        return
      }
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        unidad: unidadEfectiva,
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
        precio_unitario: Number(form.precio_unitario),
        // Imagen opcional: '' es "sin imagen". Mandar null (no '') para no chocar
        // con la validación de URL del backend.
        imagen_url: form.imagen_url?.trim() || null,
        // Atributos de cable: valores para cable, null para no-cable (el backend
        // también los limpia, pero lo mandamos explícito para no arrastrar datos).
        cable_tipo: esCable ? form.cable_tipo.trim() : null,
        cable_calibre: esCable ? form.cable_calibre.trim() : null,
      }

      if (editingId) {
        await updateProducto(editingId, payload)
        toast.success('Producto actualizado')
      } else {
        await createProducto(payload)
        toast.success('Producto creado')
      }
      setOpenForm(false)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar el producto'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await deleteProducto(confirmDel.id)
      refetch()
      toast.success('Producto eliminado')
      setConfirmDel(null)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar el producto'))
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCat = async () => {
    if (!confirmDelCat) return
    setDeletingCat(true)
    try {
      const res = await deleteCategoriaConProductos(confirmDelCat.nombre)
      // Si la categoría borrada estaba seleccionada, vuelve a la grilla.
      if (categoriaFiltro === confirmDelCat.nombre) setCategoriaFiltro('')
      await loadCategorias()
      load()
      toast.success(
        `Categoría "${confirmDelCat.nombre}" eliminada (${res?.productos_eliminados ?? 0} producto${(res?.productos_eliminados ?? 0) === 1 ? '' : 's'})`
      )
      setConfirmDelCat(null)
    } catch (err) {
      const data = err?.response?.data
      // Bloqueo por entregas pendientes (409): mensaje detallado y persistente
      // para que el almacenista sepa qué solicitudes resolver primero.
      if (err?.response?.status === 409 && data?.codigo === 'ENTREGAS_PENDIENTES') {
        const folios = (data.solicitudes || []).join(', ')
        toast.error(
          `${data.detail}${folios ? `\nSolicitudes: ${folios}` : ''}`,
          { duration: 8000 }
        )
      } else {
        toast.error(extractApiError(err, 'No se pudo eliminar la categoría'))
      }
    } finally {
      setDeletingCat(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ codigo: '', descripcion: '', categoria: '', unidad: 'pza', stock_actual: 0, stock_minimo: 0, precio_unitario: 0, imagen_url: '', proveedor_default_nombre: '', proveedor_default_contacto: '', cable_tipo: '', cable_calibre: '' })
    setOpenForm(true)
  }

  const openEdit = (p) => {
    setEditingId(p.id)
    setForm({
      codigo: p.codigo,
      descripcion: p.descripcion,
      categoria: p.categoria,
      unidad: p.unidad,
      stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo,
      precio_unitario: p.precio_unitario ?? 0,
      imagen_url: p.imagen_url || '',
      proveedor_default_nombre: p.proveedor_default_nombre || '',
      proveedor_default_contacto: p.proveedor_default_contacto || '',
      cable_tipo: p.cable_tipo || '',
      cable_calibre: p.cable_calibre || '',
    })
    setOpenForm(true)
  }

  const [savingCat, setSavingCat] = useState(false)

  const handleSaveCat = async (e) => {
    e.preventDefault()
    if (!catModal) return
    const nombre = (catModal.nombre || '').trim()
    const imagen = (catModal.imagen_url || '').trim()
    if (!nombre) return

    if (catModal.mode === 'new' && categorias.map(c => c.toLowerCase()).includes(nombre.toLowerCase())) {
      toast.error('La categoría ya existe')
      return
    }

    setSavingCat(true)
    try {
      const target = catModal.mode === 'edit' ? (catModal.original || nombre) : nombre

      if (catModal.mode === 'edit' && !imagen && catImages[target]) {
        await deleteCategoriaConfig(target)
      } else {
        await upsertCategoriaConfig(target, imagen || null)
      }

      // Refresca catálogo + config (single source of truth en backend)
      await loadCategorias()
      toast.success(
        catModal.mode === 'new'
          ? `Categoría "${nombre}" agregada`
          : (imagen ? 'Imagen de categoría actualizada' : 'Imagen eliminada')
      )
      setCatModal(null)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar la categoría'))
    } finally {
      setSavingCat(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={PackageSearch}
        title="Catálogo de Productos"
        description="Gestión del catálogo maestro de inventario."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCatModal({ mode: 'new', nombre: '', imagen_url: '' })}>
              <Plus size={15} className="mr-1 sm:hidden" /><span className="sm:hidden">Categoría</span><span className="hidden sm:inline">+ Nueva Categoría</span>
            </Button>
            <Link to="/inventario/importar">
              <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />}>
                <span className="sm:hidden">Importar</span><span className="hidden sm:inline">Importar Excel</span>
              </Button>
            </Link>
            <Button size="sm" leftIcon={<Plus size={15} />} onClick={openNew}>
              <span className="sm:hidden">Producto</span><span className="hidden sm:inline">Nuevo producto</span>
            </Button>
          </div>
        }
      />

      <Card className="!p-3 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código, descripción o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="h-9 px-3 w-full sm:w-auto rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<SlidersHorizontal size={14} />}
            onClick={() => setFiltrosAbiertos((v) => !v)}
          >
            Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
          </Button>
          {nFiltros > 0 && (
            <Button variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={limpiarFiltros}>
              Limpiar
            </Button>
          )}
        </div>

        {filtrosAbiertos && (
          <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Estado de stock" value={stockFiltro} onChange={(e) => setStockFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="bajo">Stock bajo (≤ mínimo)</option>
              <option value="sin">Sin existencias</option>
            </Select>
            <Select label="Imagen" value={imagenFiltro} onChange={(e) => setImagenFiltro(e.target.value)}>
              <option value="">Todas</option>
              <option value="con">Con imagen</option>
              <option value="sin">Sin imagen</option>
            </Select>
            <Select label="Unidad" value={unidadFiltro} onChange={(e) => setUnidadFiltro(e.target.value)}>
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300 sm:col-span-3">
              <input
                type="checkbox"
                checked={compraFiltro}
                onChange={(e) => setCompraFiltro(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              Solo productos con compra en curso (pendiente u ordenada)
            </label>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : !mostrarLista ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Categorías</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">Explora por categoría o revisa el catálogo completo.</p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={<LayoutGrid size={15} />} onClick={() => setVerTodos(true)}>
              Ver todos los materiales
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {categoriasResumen.map((c) => {
              const cat = c.nombre
              const bajos = c.bajo_minimo
              const img = catImages[cat]
              return (
                <Card
                  key={cat}
                  className="group relative overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  onClick={() => setCategoriaFiltro(cat)}
                >
                  {/* Hero imagen o placeholder con degradado corporativo */}
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-ink-100 to-ink-200 dark:from-ink-800 dark:to-ink-900">
                    {img ? (
                      <img
                        src={img}
                        alt={cat}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-ink-300 dark:text-ink-600">
                        <Package size={40} strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Scrim inferior para legibilidad y acabado premium */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCatModal({ mode: 'edit', nombre: cat, imagen_url: img || '', original: cat })
                        }}
                        title="Editar imagen"
                        className="w-8 h-8 rounded-md bg-white/90 dark:bg-ink-900/90 backdrop-blur text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-700 flex items-center justify-center hover:bg-white dark:hover:bg-ink-900"
                      >
                        <ImageIcon size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelCat({ nombre: cat, total: c.total })
                        }}
                        title="Eliminar categoría y sus productos"
                        className="w-8 h-8 rounded-md bg-white/90 dark:bg-ink-900/90 backdrop-blur text-red-600 dark:text-red-400 border border-ink-200 dark:border-ink-700 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                    {bajos > 0 && (
                      <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-semibold backdrop-blur ring-1 ring-white/15">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {bajos} stock bajo
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{cat}</h3>
                      <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 tabular-nums">{c.total} ítem{c.total === 1 ? '' : 's'}</p>
                    </div>
                    <div className="shrink-0 w-7 h-7 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <ChevronRight size={15} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <Package size={48} className="text-ink-300 mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 dark:text-ink-100">Sin productos</h3>
            <p className="text-ink-500 max-w-md mt-2">No hay productos que coincidan con la búsqueda. Puedes registrar uno nuevo con el botón superior.</p>
            {(categoriaFiltro || verTodos) && (
              <Button variant="secondary" className="mt-4" onClick={volverACategorias}>
                Ver todas las categorías
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Volver: enlace discreto arriba, para no estorbar con el título */}
          {(categoriaFiltro || verTodos) && (
            <button
              type="button"
              onClick={volverACategorias}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm font-medium text-ink-700 dark:text-ink-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-colors"
            >
              <ChevronLeft size={15} /> Volver a categorías
            </button>
          )}
          {/* Barra: título + conteo + toggle de vista */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100 truncate">
                {categoriaFiltro || (verTodos ? 'Todos los materiales' : 'Resultados')}
              </h2>
              <span className="text-xs text-ink-500 dark:text-ink-400 tabular-nums">
                {totalProductos} producto{totalProductos === 1 ? '' : 's'}
              </span>
            </div>
            {/* Toggle Galería / Tabla */}
            <div className="inline-flex rounded-md border border-ink-200 dark:border-ink-700 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setVista('galeria')}
                title="Vista de galería (fotos)"
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${vista === 'galeria' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
              >
                <LayoutGrid size={14} /> <span className="hidden sm:inline">Galería</span>
              </button>
              <button
                type="button"
                onClick={() => setVista('tabla')}
                title="Vista de tabla"
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium border-l border-ink-200 dark:border-ink-700 transition-colors ${vista === 'tabla' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
              >
                <List size={14} /> <span className="hidden sm:inline">Tabla</span>
              </button>
            </div>
          </div>

          {vista === 'galeria' ? (
            /* Galería: cuadrícula con fotos grandes en todos los tamaños */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filtered.map((p) => {
                const bajoStock = p.stock_actual <= p.stock_minimo
                const compra = compraPorProducto.get(p.id)
                return (
                  <Card key={p.id} className="group overflow-hidden flex flex-col">
                    <div className="relative aspect-square bg-ink-50 dark:bg-ink-800/50 border-b border-ink-200 dark:border-ink-800 overflow-hidden">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.descripcion}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-ink-300 dark:text-ink-600">
                          <Package size={40} strokeWidth={1.5} />
                        </div>
                      )}
                      {compra && (
                        <div className="absolute top-2 left-2">
                          <Badge tone={compra.estatus === 'ORDENADA' ? 'info' : 'warning'}>
                            {compra.estatus === 'ORDENADA' ? 'Ordenada' : 'En compra'}
                          </Badge>
                        </div>
                      )}
                      {bajoStock && (
                        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-semibold backdrop-blur">
                          Stock bajo
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-0.5 flex-1">
                      <p className="font-mono text-[11px] text-brand-700 dark:text-brand-300 truncate">{p.codigo}</p>
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-snug line-clamp-2">{p.descripcion}</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.categoria}</p>
                      <CableTag tipo={p.cable_tipo} calibre={p.cable_calibre} size="xs" className="mt-0.5" />
                      <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold tabular-nums ${bajoStock ? 'text-red-600 dark:text-red-400' : 'text-ink-800 dark:text-ink-100'}`}>
                            {p.stock_disponible ?? p.stock_actual} {p.unidad}
                          </p>
                          <p className="text-[10px] text-ink-500 tabular-nums">Mín {p.stock_minimo}</p>
                        </div>
                        <p className="font-mono tabular-nums text-xs text-ink-700 dark:text-ink-200">
                          {(Number(p.precio_unitario) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-0.5 px-1.5 py-1 border-t border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-900/30">
                      <Link to={`/inventario/productos/${p.id}/kardex`}>
                        <Button variant="ghost" size="icon-sm" title="Ver kardex (historial)"><History size={14} /></Button>
                      </Link>
                      <Button variant="ghost" size="icon-sm" title="Ver stock por bodega" onClick={() => setStocksModal(p)}><Warehouse size={14} /></Button>
                      <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => openEdit(p)}><Edit2 size={14} /></Button>
                      <Button variant="danger-ghost" size="icon-sm" title="Eliminar" onClick={() => setConfirmDel({ id: p.id, name: p.descripcion })}><Trash2 size={14} /></Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
          <>
          {/* Escritorio: tabla completa */}
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <THead>
              <TH>Foto</TH>
              <TH>Código</TH>
              <TH>Descripción</TH>
              <TH>Categoría</TH>
              {hayCableEnLista && <TH align="center">Tipo</TH>}
              {hayCableEnLista && <TH align="center">Tamaño (mm²/AWG)</TH>}
              <TH>Stock</TH>
              <TH align="right">Precio</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {filtered.map((p) => (
                <TR key={p.id}>
                  <TD>
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.descripcion} className="w-10 h-10 rounded-md object-cover bg-ink-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400">
                        <Package size={20} />
                      </div>
                    )}
                  </TD>
                  <TD className="font-mono text-sm text-brand-700 dark:text-brand-300">{p.codigo}</TD>
                  <TD className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{p.descripcion}</span>
                      {compraPorProducto.has(p.id) && (() => {
                        const c = compraPorProducto.get(p.id)
                        return (
                          <Badge
                            tone={c.estatus === 'ORDENADA' ? 'info' : 'warning'}
                            title={`${c.folio} · ${c.estatus}`}
                          >
                            {c.estatus === 'ORDENADA' ? 'Ordenada' : 'En compra'}
                          </Badge>
                        )
                      })()}
                    </div>
                  </TD>
                  <TD className="text-sm text-ink-600 dark:text-ink-300">{p.categoria}</TD>
                  {hayCableEnLista && (
                    <TD align="center" className="text-sm text-ink-600 dark:text-ink-300">
                      {p.cable_tipo || <span className="text-ink-300 dark:text-ink-600">—</span>}
                    </TD>
                  )}
                  {hayCableEnLista && (
                    <TD align="center" className="text-sm text-ink-600 dark:text-ink-300 tabular-nums">
                      {p.cable_calibre || <span className="text-ink-300 dark:text-ink-600">—</span>}
                    </TD>
                  )}
                  <TD>
                    <div className="flex flex-col">
                      <span
                        className={`tabular-nums ${p.stock_actual <= p.stock_minimo ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}
                        title={
                          (p.stock_reservado || 0) > 0
                            ? `Stock total: ${p.stock_actual} · Apartado: ${p.stock_reservado} · Disponible: ${p.stock_disponible}`
                            : `Stock: ${p.stock_actual}`
                        }
                      >
                        {p.stock_disponible ?? p.stock_actual} {p.unidad}
                        {(p.stock_reservado || 0) > 0 && (
                          <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            ({p.stock_reservado} apart.)
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-ink-500 tabular-nums">Mín: {p.stock_minimo}</span>
                    </div>
                  </TD>
                  <TD align="right" className="font-mono tabular-nums text-sm">
                    {(Number(p.precio_unitario) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                  </TD>
                  <TD align="right">
                    <div className="inline-flex items-center gap-1">
                      <Link to={`/inventario/productos/${p.id}/kardex`}>
                        <Button variant="ghost" size="icon-sm" title="Ver kardex (historial)">
                          <History size={14} />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon-sm" title="Ver stock por bodega" onClick={() => setStocksModal(p)}>
                        <Warehouse size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => openEdit(p)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="danger-ghost" size="icon-sm" title="Eliminar" onClick={() => setConfirmDel({ id: p.id, name: p.descripcion })}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-2">
            {filtered.map((p) => {
              const bajoStock = p.stock_actual <= p.stock_minimo
              const compra = compraPorProducto.get(p.id)
              return (
                <Card key={p.id} className="!p-3">
                  <div className="flex gap-3">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.descripcion} className="w-12 h-12 rounded-md object-cover bg-ink-100 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 flex-shrink-0">
                        <Package size={22} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-ink-900 dark:text-ink-100 leading-tight truncate">{p.descripcion}</p>
                          <p className="font-mono text-[11px] text-brand-700 dark:text-brand-300">{p.codigo}</p>
                          <p className="text-[11px] text-ink-500 dark:text-ink-400 truncate">{p.categoria}</p>
                          <CableTag tipo={p.cable_tipo} calibre={p.cable_calibre} size="xs" className="mt-1" />
                        </div>
                        {compra && (
                          <Badge tone={compra.estatus === 'ORDENADA' ? 'info' : 'warning'}>
                            {compra.estatus === 'ORDENADA' ? 'Ordenada' : 'En compra'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className={`text-xs tabular-nums ${bajoStock ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-ink-600 dark:text-ink-300'}`}>
                          {p.stock_disponible ?? p.stock_actual} {p.unidad}
                          <span className="text-ink-400 font-normal"> · Mín {p.stock_minimo}</span>
                        </span>
                        <span className="font-mono tabular-nums text-xs text-ink-700 dark:text-ink-200">
                          {(Number(p.precio_unitario) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 border-t border-ink-100 dark:border-ink-800 pt-2">
                        <Link to={`/inventario/productos/${p.id}/kardex`}>
                          <Button variant="ghost" size="icon-sm" title="Ver kardex (historial)"><History size={15} /></Button>
                        </Link>
                        <Button variant="ghost" size="icon-sm" title="Ver stock por bodega" onClick={() => setStocksModal(p)}><Warehouse size={15} /></Button>
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => openEdit(p)}><Edit2 size={15} /></Button>
                        <Button variant="danger-ghost" size="icon-sm" title="Eliminar" onClick={() => setConfirmDel({ id: p.id, name: p.descripcion })}><Trash2 size={15} /></Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          </>
          )}
          <Pagination
            page={pageProd}
            totalPages={totalPagesProd}
            totalElements={totalProductos}
            size={PROD_PAGE_SIZE}
            onChange={setPageProd}
          />
        </div>
      )}

      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editingId ? 'Editar producto' : 'Nuevo producto'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenForm(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="producto-form" loading={saving}>Guardar</Button>
          </>
        }
      >
        <form id="producto-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required placeholder="Ej. RES-10K-1/4W" />
          <Input label="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required placeholder="Ej. Resistencia 10kΩ 1/4W" />
          
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Categoría"
              value={form.categoria}
              onChange={(e) => {
                const categoria = e.target.value
                const eraCable = esCategoriaCable(form.categoria)
                const seraCable = esCategoriaCable(categoria)
                // Al pasar a cable forzamos unidad M; al salir de cable (donde
                // estaba bloqueada en M) volvemos a un default editable.
                setForm((f) => ({
                  ...f,
                  categoria,
                  unidad: seraCable ? CABLE_UNIDAD : (eraCable ? 'pza' : f.unidad),
                }))
              }}
              required
            >
              <option value="">Seleccione Categoría</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input
              label="Unidad (ej. pza, m, rollo)"
              value={esCable ? CABLE_UNIDAD : form.unidad}
              onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              required
              placeholder="pza"
              disabled={esCable}
              hint={esCable ? 'Cable: se mide en metros (M)' : undefined}
            />
          </div>

          {/* Cable: apartados extra resaltados en ámbar para no confundir con lo demás */}
          {esCable && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                <Cable size={13} /> Datos del cable
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tipo"
                  value={form.cable_tipo}
                  onChange={(e) => setForm({ ...form, cable_tipo: e.target.value })}
                  required
                  placeholder="THHN, THW, desnudo…"
                  maxLength={60}
                />
                <Input
                  label="Tamaño (mm²/AWG)"
                  value={form.cable_calibre}
                  onChange={(e) => setForm({ ...form, cable_calibre: e.target.value })}
                  required
                  placeholder="12, 2/0, 500 kcmil"
                  maxLength={40}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock Actual" type="number" min="0"
              step={unidadPermiteDecimales(form.unidad) ? '0.01' : 1}
              value={form.stock_actual}
              onChange={(e) => setForm({ ...form, stock_actual: unidadPermiteDecimales(form.unidad) ? e.target.value : e.target.value.replace(/[.,].*$/, '') })}
              required />
            <Input label="Stock Mínimo" type="number" min="0"
              step={unidadPermiteDecimales(form.unidad) ? '0.01' : 1}
              value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: unidadPermiteDecimales(form.unidad) ? e.target.value : e.target.value.replace(/[.,].*$/, '') })}
              required />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Input label="Precio Unitario ($)" type="number" step="0.01" min="0" value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })} placeholder="0.00" />
          </div>

          <Input label="Foto del Producto (URL — opcional)" value={form.imagen_url || ''} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://ejemplo.com/imagen.jpg" />

          {/* Proveedor default (Pausa 9) — usado para Compras express */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Proveedor (opcional)"
              value={form.proveedor_default_nombre || ''}
              onChange={(e) => setForm({ ...form, proveedor_default_nombre: e.target.value })}
              placeholder="Ej. Electrónica Steren"
            />
            <Input
              label="Contacto (tel/email — opcional)"
              value={form.proveedor_default_contacto || ''}
              onChange={(e) => setForm({ ...form, proveedor_default_contacto: e.target.value })}
              placeholder="5512345678"
            />
          </div>

          {imagePreview && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
              {imageError ? (
                <div className="w-16 h-16 rounded-md bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center flex-shrink-0">
                  <Package size={24} />
                </div>
              ) : (
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="w-16 h-16 rounded-md object-cover bg-white flex-shrink-0 border border-ink-200 dark:border-ink-700"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
              )}
              <div className="text-xs">
                <p className="font-semibold text-ink-700 dark:text-ink-200">
                  {imageError ? 'No se pudo cargar la imagen' : 'Vista previa'}
                </p>
                <p className="text-ink-500 break-all line-clamp-2">{imagePreview}</p>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={!!catModal}
        onClose={() => setCatModal(null)}
        title={catModal?.mode === 'edit' ? `Imagen de "${catModal?.original}"` : 'Nueva categoría'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModal(null)} disabled={savingCat}>Cancelar</Button>
            <Button type="submit" form="cat-form" loading={savingCat}>
              {catModal?.mode === 'edit' ? 'Guardar' : 'Agregar categoría'}
            </Button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleSaveCat} className="space-y-4">
          {catModal?.mode === 'new' && (
            <Input
              label="Nombre de la categoría"
              value={catModal?.nombre || ''}
              onChange={(e) => setCatModal({ ...catModal, nombre: e.target.value })}
              placeholder="Ej. Herramientas, Tornillería..."
              required
            />
          )}
          <Input
            label="Imagen (URL — opcional)"
            value={catModal?.imagen_url || ''}
            onChange={(e) => setCatModal({ ...catModal, imagen_url: e.target.value })}
            placeholder="https://ejemplo.com/categoria.jpg"
          />

          {catPreview && (
            <div className="rounded-lg overflow-hidden border border-ink-200 dark:border-ink-700">
              {catPreviewError ? (
                <div className="h-32 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 text-sm">
                  No se pudo cargar la imagen
                </div>
              ) : (
                <img
                  src={catPreview}
                  alt="Vista previa"
                  className="w-full h-32 object-cover bg-ink-100"
                  onError={() => setCatPreviewError(true)}
                  onLoad={() => setCatPreviewError(false)}
                />
              )}
            </div>
          )}

          {catModal?.mode === 'edit' && catModal?.imagen_url && (
            <button
              type="button"
              onClick={() => setCatModal({ ...catModal, imagen_url: '' })}
              className="text-xs text-red-500 hover:underline"
            >
              Quitar imagen
            </button>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar producto"
        description={`Se desactivará el producto "${confirmDel?.name}".`}
        confirmLabel="Eliminar"
        tone="danger"
      />

      <ConfirmDialog
        open={!!confirmDelCat}
        onClose={() => setConfirmDelCat(null)}
        onConfirm={handleDeleteCat}
        loading={deletingCat}
        title={`Eliminar categoría "${confirmDelCat?.nombre}"`}
        description={
          confirmDelCat?.total > 0
            ? `⚠ Esta acción eliminará la categoría y sus ${confirmDelCat.total} producto${confirmDelCat.total === 1 ? '' : 's'}. Los productos se desactivarán y dejarán de aparecer en el catálogo. Esta acción no se puede deshacer.`
            : 'Se eliminará la categoría. No tiene productos asociados.'
        }
        confirmLabel={confirmDelCat?.total > 0 ? `Eliminar categoría y ${confirmDelCat.total} producto${confirmDelCat.total === 1 ? '' : 's'}` : 'Eliminar categoría'}
        tone="danger"
      />

      {/* Modal de desglose por bodega (Pausa 2) */}
      <Modal
        open={!!stocksModal}
        onClose={() => setStocksModal(null)}
        title={stocksModal ? `Stock por bodega — ${stocksModal.codigo}` : ''}
      >
        {stocksModal && (
          <div className="space-y-3">
            <div className="text-sm text-ink-600 dark:text-ink-300">
              <strong>{stocksModal.descripcion}</strong>
              <div className="text-xs text-ink-500 mt-0.5">
                Total global: <span className="font-mono font-bold">{stocksModal.stock_actual} {stocksModal.unidad}</span>
                {' · '}Mínimo: <span className="font-mono">{stocksModal.stock_minimo}</span>
              </div>
            </div>

            {loadingStocks ? (
              <Skeleton className="h-32 rounded-lg" />
            ) : !stocksData || stocksData.stocks.length === 0 ? (
              <p className="text-sm text-ink-400 italic">
                Sin registros de stock en bodega. Importa o registra un movimiento ENTRADA para iniciar.
              </p>
            ) : (
              <div className="rounded-lg border border-ink-200 dark:border-ink-800 overflow-hidden">
                <Table>
                  <THead>
                    <TH>Bodega</TH>
                    <TH>Ubicación</TH>
                    <TH align="right">Cantidad</TH>
                  </THead>
                  <TBody>
                    {stocksData.stocks
                      .slice()
                      .sort((a, b) => b.cantidad - a.cantidad)
                      .map((s) => (
                        <TR key={s.almacen_id}>
                          <TD className="font-medium">{s.almacen_nombre}</TD>
                          <TD className="text-xs text-ink-500">{s.almacen_ubicacion || '—'}</TD>
                          <TD align="right" className={`font-mono font-bold tabular-nums ${s.cantidad > 0 ? '' : 'text-ink-400'}`}>
                            {s.cantidad} {stocksModal.unidad}
                          </TD>
                        </TR>
                      ))}
                  </TBody>
                </Table>
              </div>
            )}

            {stocksData && Math.abs(stocksData.total - Number(stocksModal.stock_actual)) > 0.01 && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                <strong>Aviso:</strong> el total por bodega ({stocksData.total}) no coincide con el cache global ({stocksModal.stock_actual}). Esto indica un desfase — al registrar el próximo movimiento se recalculará automáticamente.
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  )
}
