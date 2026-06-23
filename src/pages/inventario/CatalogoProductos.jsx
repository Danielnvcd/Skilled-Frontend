import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Package, PackageSearch, Plus, Search, Trash2, Edit2, Image as ImageIcon, Warehouse, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Select,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getProductos, getCategoriasResumen, createProducto, updateProducto, deleteProducto,
  getCategorias, getCategoriasConfig, upsertCategoriaConfig, deleteCategoriaConfig,
  getProductoStocks,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { invalidate } from '../../utils/resourceCache'
import { Upload } from 'lucide-react'

export default function CatalogoProductos() {
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [categorias, setCategorias] = useState([])

  const [openForm, setOpenForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    codigo: '', descripcion: '', categoria: '', unidad: 'pza', stock_actual: 0, stock_minimo: 0, imagen_url: ''
  })

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

  // Vista de lista cuando hay categoría seleccionada o texto de búsqueda.
  const mostrarLista = !!(categoriaFiltro || search.trim())
  // El fetch se habilita con el término ya "asentado" (debounced).
  const fetchHabilitado = !!(categoriaFiltro || debouncedSearch)

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

  // Productos filtrados server-side. Solo se piden cuando hay filtro/búsqueda.
  const {
    data: rawProductos,
    loading: loadingProductos,
    error,
    refetch,
  } = useResource(
    ['productos', { categoria: categoriaFiltro, q: debouncedSearch }],
    () => getProductos({ categoria: categoriaFiltro, q: debouncedSearch, limit: 1000 }),
    {
      enabled: fetchHabilitado,
      staleMs: 30_000,
      invalidateOn: ['producto:changed', 'movimiento:changed'],
    },
  )
  const filtered = fetchHabilitado ? (rawProductos ?? []) : []
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
    setSaving(true)
    try {
      const payload = {
        ...form,
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo)
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
      await refetch()
      toast.success('Producto eliminado')
      setConfirmDel(null)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar el producto'))
    } finally {
      setDeleting(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ codigo: '', descripcion: '', categoria: '', unidad: 'pza', stock_actual: 0, stock_minimo: 0, imagen_url: '', proveedor_default_nombre: '', proveedor_default_contacto: '' })
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
      imagen_url: p.imagen_url || '',
      proveedor_default_nombre: p.proveedor_default_nombre || '',
      proveedor_default_contacto: p.proveedor_default_contacto || '',
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setCatModal({ mode: 'new', nombre: '', imagen_url: '' })}>+ Nueva Categoría</Button>
            <Link to="/inventario/importar">
              <Button variant="secondary" leftIcon={<Upload size={15} />}>Importar Excel</Button>
            </Link>
            <Button leftIcon={<Plus size={15} />} onClick={openNew}>Nuevo producto</Button>
          </div>
        }
      />

      <Card className="!p-3 mb-5">
        <div className="flex items-center gap-3">
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
            className="h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm text-ink-700 dark:text-ink-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : !mostrarLista ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoriasResumen.map((c) => {
            const cat = c.nombre
            const bajos = c.bajo_minimo
            const img = catImages[cat]
            return (
              <Card
                key={cat}
                className="overflow-hidden cursor-pointer hover:border-ink-300 dark:hover:border-ink-700 hover:shadow-sm transition-all group"
                onClick={() => setCategoriaFiltro(cat)}
              >
                {/* Hero imagen o placeholder neutro */}
                <div className="relative h-32 bg-ink-50 dark:bg-ink-800/50 overflow-hidden border-b border-ink-200 dark:border-ink-800">
                  {img ? (
                    <img
                      src={img}
                      alt={cat}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-ink-300 dark:text-ink-600">
                      <Package size={44} strokeWidth={1.5} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCatModal({ mode: 'edit', nombre: cat, imagen_url: img || '', original: cat })
                    }}
                    title="Editar imagen"
                    className="absolute top-2 right-2 w-8 h-8 rounded-md bg-white/90 dark:bg-ink-900/90 backdrop-blur text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-ink-900"
                  >
                    <ImageIcon size={15} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">{cat}</h3>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 tabular-nums">{c.total} ítem{c.total === 1 ? '' : 's'}</p>
                  {bajos > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[11px] font-semibold rounded-full ring-1 ring-inset ring-red-200 dark:ring-red-800/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {bajos} stock bajo
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <Package size={48} className="text-ink-300 mb-4" />
            <h3 className="text-lg font-semibold text-ink-900 dark:text-ink-100">Sin productos</h3>
            <p className="text-ink-500 max-w-md mt-2">No hay productos que coincidan con la búsqueda. Puedes registrar uno nuevo con el botón superior.</p>
            {categoriaFiltro && (
              <Button variant="secondary" className="mt-4" onClick={() => setCategoriaFiltro('')}>
                Ver todas las categorías
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {categoriaFiltro && (
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setCategoriaFiltro('')}>
                ← Volver a categorías
              </Button>
              <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">{categoriaFiltro}</h2>
              <span className="text-xs text-ink-500 dark:text-ink-400 tabular-nums">
                {filtered.length} producto{filtered.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {filtered.length >= 1000 && (
            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
              Mostrando los primeros 1000 resultados. Afina la búsqueda para ver el resto.
            </div>
          )}
          <Table>
            <THead>
              <TH>Foto</TH>
              <TH>Código</TH>
              <TH>Descripción</TH>
              <TH>Categoría</TH>
              <TH>Stock</TH>
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
                  <TD className="font-medium">{p.descripcion}</TD>
                  <TD className="text-sm text-ink-600 dark:text-ink-300">{p.categoria}</TD>
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
          <Input label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          <Input label="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          
          <div className="grid grid-cols-2 gap-4">
            <Select label="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} required>
              <option value="">Seleccione Categoría</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Unidad (ej. pza, kg)" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock Actual" type="number" step="0.01" value={form.stock_actual} onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} required />
            <Input label="Stock Mínimo" type="number" step="0.01" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} required />
          </div>

          <Input label="Foto del Producto (URL — opcional)" value={form.imagen_url || ''} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://ejemplo.com/imagen.jpg" />

          {/* Proveedor default (Pausa 9) — usado para Compras express */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Proveedor (opcional)"
              value={form.proveedor_default_nombre || ''}
              onChange={(e) => setForm({ ...form, proveedor_default_nombre: e.target.value })}
              placeholder="Ej. Cementos del Norte"
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
