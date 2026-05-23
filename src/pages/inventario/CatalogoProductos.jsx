import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Package, Plus, Search, Trash2, Edit2, Image as ImageIcon } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  EmptyState, Input, Skeleton, Select,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getProductos, createProducto, updateProducto, deleteProducto,
  getCategorias, getCategoriasConfig, upsertCategoriaConfig, deleteCategoriaConfig,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'

export default function CatalogoProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
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

  const load = () => {
    setLoading(true)
    getProductos()
      .then(setProductos)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar productos')))
      .finally(() => setLoading(false))
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
    load()
    loadCategorias()
  }, [])

  const filtered = useMemo(() => {
    let result = productos
    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter((p) =>
        p.codigo?.toLowerCase().includes(s) ||
        p.descripcion?.toLowerCase().includes(s) ||
        p.categoria?.toLowerCase().includes(s)
      )
    }
    if (categoriaFiltro) {
      result = result.filter((p) => p.categoria === categoriaFiltro)
    }
    return result
  }, [productos, search, categoriaFiltro])

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
      setProductos((prev) => prev.filter((p) => p.id !== confirmDel.id))
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
    setForm({ codigo: '', descripcion: '', categoria: '', unidad: 'pza', stock_actual: 0, stock_minimo: 0, imagen_url: '' })
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
      imagen_url: p.imagen_url || ''
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
        icon={Package}
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
      ) : (!search && !categoriaFiltro) ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categorias.map((cat) => {
            const prods = productos.filter((p) => p.categoria === cat)
            const bajos = prods.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo)).length
            const img = catImages[cat]
            return (
              <Card
                key={cat}
                className="overflow-hidden cursor-pointer hover:border-brand-500 transition-colors group"
                onClick={() => setCategoriaFiltro(cat)}
              >
                {/* Hero imagen o placeholder */}
                <div className="relative h-32 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/30 dark:to-brand-800/20 overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={cat}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-brand-300 dark:text-brand-700">
                      <Package size={48} strokeWidth={1.5} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCatModal({ mode: 'edit', nombre: cat, imagen_url: img || '', original: cat })
                    }}
                    title="Editar imagen"
                    className="absolute top-2 right-2 w-8 h-8 rounded-md bg-white/90 dark:bg-ink-900/90 backdrop-blur text-ink-700 dark:text-ink-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white dark:hover:bg-ink-900"
                  >
                    <ImageIcon size={15} />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-ink-900 dark:text-ink-100">{cat}</h3>
                  <p className="text-sm text-ink-500 mt-0.5">{prods.length} items</p>
                  {bajos > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-md border border-red-200 dark:border-red-800">
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
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCategoriaFiltro('')}>
                ← Volver a categorías
              </Button>
              <h2 className="text-lg font-bold text-ink-900 dark:text-ink-100 ml-2">{categoriaFiltro}</h2>
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
                  <TD className="font-mono text-sm">{p.codigo}</TD>
                  <TD className="font-medium">{p.descripcion}</TD>
                  <TD>{p.categoria}</TD>
                  <TD>
                    <div className="flex flex-col">
                      <span className={p.stock_actual <= p.stock_minimo ? 'text-red-600 font-bold' : ''}>
                        {p.stock_actual} {p.unidad}
                      </span>
                      <span className="text-[10px] text-ink-500">Mín: {p.stock_minimo}</span>
                    </div>
                  </TD>
                  <TD align="right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDel({ id: p.id, name: p.descripcion })}>
                        <Trash2 size={14} className="text-red-600" />
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

    </div>
  )
}
