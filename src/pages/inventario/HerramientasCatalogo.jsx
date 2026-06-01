import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Wrench, Plus, Search, Trash2, Edit2, Eye } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  EmptyState, Input, Select, Skeleton, Badge,
} from '../../components/ui'
import {
  getHerramientas, createHerramienta, updateHerramienta, deleteHerramienta,
  getClasificaciones,
} from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { USO_HERRAMIENTA, ESTADO_LABEL, ESTADO_TONE } from './herramientasShared'

const FORM_INICIAL = {
  sku: '', descripcion: '', clasificacion: '', marca: '', modelo: '',
  uso: 'OTRO', unidad: 'pieza', piezas: 1, serializada: true, imagen_url: '',
}

export default function HerramientasCatalogo() {
  const [clasifs, setClasifs] = useState([])
  const [search, setSearch] = useState('')
  const [clasifFiltro, setClasifFiltro] = useState('')
  const [serFiltro, setSerFiltro] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const {
    data: rawItems,
    loading,
    error,
    refetch,
  } = useResource(
    ['herramientas', 'catalogo'],
    () => getHerramientas(),
    { staleMs: 30_000, invalidateOn: ['herramienta:changed'] },
  )
  const items = rawItems ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error cargando herramientas'))
  }, [error])

  const load = () => { refetch() }

  useEffect(() => {
    getClasificaciones().then(setClasifs).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let r = items
    if (search.trim()) {
      const s = search.toLowerCase()
      r = r.filter((h) => (
        h.sku?.toLowerCase().includes(s) ||
        h.descripcion?.toLowerCase().includes(s) ||
        h.marca?.toLowerCase().includes(s) ||
        h.modelo?.toLowerCase().includes(s)
      ))
    }
    if (clasifFiltro) r = r.filter((h) => h.clasificacion === clasifFiltro)
    if (serFiltro === 'true') r = r.filter((h) => h.serializada)
    if (serFiltro === 'false') r = r.filter((h) => !h.serializada)
    return r
  }, [items, search, clasifFiltro, serFiltro])

  const handleOpenNuevo = () => {
    setForm(FORM_INICIAL)
    setEditingId(null)
    setOpenForm(true)
  }

  const handleEditar = (h) => {
    setForm({
      sku: h.sku || '',
      descripcion: h.descripcion || '',
      clasificacion: h.clasificacion || '',
      marca: h.marca || '',
      modelo: h.modelo || '',
      uso: h.uso || 'OTRO',
      unidad: h.unidad || 'pieza',
      piezas: h.piezas || 1,
      serializada: !!h.serializada,
      imagen_url: h.imagen_url || '',
    })
    setEditingId(h.id)
    setOpenForm(true)
  }

  const handleSave = async (e) => {
    e?.preventDefault?.()
    if (!form.sku.trim() || !form.descripcion.trim() || !form.clasificacion.trim()) {
      toast.error('SKU, descripción y clasificación son obligatorios')
      return
    }
    setSaving(true)
    try {
      const payload = {
        sku: form.sku.trim(),
        descripcion: form.descripcion.trim(),
        clasificacion: form.clasificacion.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        uso: form.uso,
        unidad: form.unidad.trim() || 'pieza',
        piezas: Number(form.piezas) || 1,
        serializada: !!form.serializada,
        imagen_url: form.imagen_url.trim() || null,
      }
      if (editingId) {
        await updateHerramienta(editingId, payload)
        toast.success('Herramienta actualizada')
      } else {
        await createHerramienta(payload)
        toast.success('Herramienta creada')
      }
      setOpenForm(false)
      load()
      getClasificaciones().then(setClasifs).catch(() => {})
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await deleteHerramienta(confirmDel.id)
      toast.success('Herramienta desactivada')
      setConfirmDel(null)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo desactivar'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Catálogo de Herramientas"
        description="Tipos de herramienta del inventario corporativo"
        actions={
          <Button onClick={handleOpenNuevo}>
            <Plus size={16} className="mr-1.5" /> Nueva herramienta
          </Button>
        }
      />

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SKU, descripción, marca, modelo…"
            leftIcon={<Search size={16} />}
          />
        </div>
        <div className="min-w-[200px]">
          <Select
            label="Clasificación"
            value={clasifFiltro}
            onChange={(e) => setClasifFiltro(e.target.value)}
          >
            <option value="">Todas</option>
            {clasifs.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select
            label="Tipo"
            value={serFiltro}
            onChange={(e) => setSerFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="true">Serializadas (con No. serie)</option>
            <option value="false">No serializadas</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wrench}
            title="Sin herramientas"
            description="Aún no has registrado herramientas. Crea la primera para empezar."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((h) => {
            const stats = h.stats_estados || {}
            const total = h.total_unidades || 0
            const disp = stats.DISPONIBLE || 0
            const asig = stats.ASIGNADA || 0
            const otros = total - disp - asig
            return (
              <Card key={h.id} className="!p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  {h.imagen_url ? (
                    <img src={h.imagen_url} alt={h.sku}
                         className="h-14 w-14 rounded-lg object-cover ring-1 ring-ink-200 dark:ring-ink-700 flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-ink-100 dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700 inline-flex items-center justify-center text-ink-400 flex-shrink-0">
                      <Wrench size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900 dark:text-ink-100 leading-tight truncate"
                         title={h.descripcion}>
                      {h.descripcion}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-ink-500 dark:text-ink-400 mt-0.5 font-mono">
                      {h.sku}
                    </div>
                    {(h.marca || h.modelo) && (
                      <div className="text-xs text-ink-600 dark:text-ink-300 mt-1 truncate">
                        {h.marca || ''} {h.modelo || ''}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{h.clasificacion}</Badge>
                  {h.uso && h.uso !== 'OTRO' && (
                    <Badge tone="neutral">{h.uso}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1 text-center text-xs border-t border-ink-200 dark:border-ink-800 pt-3">
                  <div>
                    <div className="font-bold text-ink-900 dark:text-ink-100">{total}</div>
                    <div className="text-[9px] uppercase text-ink-500 dark:text-ink-400">Total</div>
                  </div>
                  <div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{disp}</div>
                    <div className="text-[9px] uppercase text-ink-500 dark:text-ink-400">Disp.</div>
                  </div>
                  <div>
                    <div className="font-bold text-sky-600 dark:text-sky-400">{asig}</div>
                    <div className="text-[9px] uppercase text-ink-500 dark:text-ink-400">Asig.</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-600 dark:text-amber-400">{otros}</div>
                    <div className="text-[9px] uppercase text-ink-500 dark:text-ink-400">Otros</div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-auto">
                  <Link
                    to={`/inventario/herramientas/unidades?herramienta_id=${h.id}`}
                    className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-brand-600 dark:hover:text-brand-300"
                    title="Ver unidades"
                  >
                    <Eye size={16} />
                  </Link>
                  <button onClick={() => handleEditar(h)}
                    className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-brand-600 dark:hover:text-brand-300"
                    title="Editar">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => setConfirmDel(h)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-ink-500 dark:text-ink-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Desactivar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editingId ? 'Editar herramienta' : 'Nueva herramienta'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                   maxLength={50} placeholder="HRR-001" />
            <Input label="Descripción *" value={form.descripcion}
                   onChange={(e) => setForm({ ...form, descripcion: e.target.value })} maxLength={250} />
            <Input label="Clasificación *" value={form.clasificacion}
                   onChange={(e) => setForm({ ...form, clasificacion: e.target.value })}
                   maxLength={100} list="clasifs" placeholder="Ej: Eléctrica, Manual, Medición…" />
            <datalist id="clasifs">
              {clasifs.map((c) => <option key={c} value={c} />)}
            </datalist>
            <Input label="Marca" value={form.marca}
                   onChange={(e) => setForm({ ...form, marca: e.target.value })} maxLength={100} />
            <Input label="Modelo" value={form.modelo}
                   onChange={(e) => setForm({ ...form, modelo: e.target.value })} maxLength={100} />
            <Select label="Uso" value={form.uso} onChange={(e) => setForm({ ...form, uso: e.target.value })}>
              {USO_HERRAMIENTA.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Unidad" value={form.unidad}
                   onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                   maxLength={50} placeholder="pieza / kit / juego" />
            <Input label="Piezas que conforman 1 unidad" type="number" min={1}
                   value={form.piezas} onChange={(e) => setForm({ ...form, piezas: e.target.value })} />
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="serializada" checked={form.serializada}
                     onChange={(e) => setForm({ ...form, serializada: e.target.checked })}
                     className="h-4 w-4 rounded" />
              <label htmlFor="serializada" className="text-sm">
                Serializada (con número de serie único)
              </label>
            </div>
          </div>
          <Input label="URL de imagen (https:// o ruta local)"
                 value={form.imagen_url}
                 onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                 maxLength={500} placeholder="https://..." />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : (editingId ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Desactivar herramienta"
        description={`¿Desactivar "${confirmDel?.descripcion}" del catálogo? Esto no afecta sus unidades activas; solo la oculta de las búsquedas.`}
        confirmLabel={deleting ? 'Desactivando…' : 'Desactivar'}
        tone="danger"
      />
    </div>
  )
}
