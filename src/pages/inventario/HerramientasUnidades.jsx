import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Hammer, Plus, Search } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, EmptyState,
  Input, Select, Skeleton, Badge, AuthImage,
} from '../../components/ui'
import {
  getUnidades, createUnidad, getHerramientas, authFotoPath,
} from '../../api/herramientas'
import { getAlmacenes, getEstantesPorAlmacen } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { ESTADOS_UNIDAD, ESTADO_LABEL, ESTADO_TONE, formatDate } from './herramientasShared'

const FORM_INICIAL = {
  herramienta_id: '',
  no_serie: '',
  almacen_id: '',
  estante_id: '',
  cantidad: 1,
  complementos: '',
  fecha_adquisicion: '',
  costo_adquisicion: '',
  vida_util_meses: '',
  observaciones: '',
}

export default function HerramientasUnidades() {
  const [searchParams, setSearchParams] = useSearchParams()
  const herramientaFiltro = searchParams.get('herramienta_id') || ''

  const [herramientas, setHerramientas] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [estantes, setEstantes] = useState([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [serializadaSel, setSerializadaSel] = useState(true)

  const unidadParams = { herramienta_id: herramientaFiltro || null, estado: estadoFiltro || null }
  const {
    data: rawUnidades,
    loading,
    error,
    refetch,
  } = useResource(
    ['herramientas-unidades', unidadParams],
    () => {
      const params = {}
      if (herramientaFiltro) params.herramienta_id = herramientaFiltro
      if (estadoFiltro) params.estado = estadoFiltro
      return getUnidades(params)
    },
    {
      staleMs: 30_000,
      invalidateOn: ['herramienta:changed', 'asignacion:changed', 'mantenimiento:changed', 'incidencia:changed', 'baja:changed'],
    },
  )
  const unidades = rawUnidades ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error cargando unidades'))
  }, [error])

  const load = () => { refetch() }

  useEffect(() => {
    getHerramientas().then(setHerramientas).catch(() => {})
    getAlmacenes().then(setAlmacenes).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.almacen_id) {
      getEstantesPorAlmacen(form.almacen_id).then(setEstantes).catch(() => setEstantes([]))
    } else {
      setEstantes([])
    }
  }, [form.almacen_id])

  const filtered = useMemo(() => {
    if (!search.trim()) return unidades
    const s = search.toLowerCase()
    return unidades.filter((u) => (
      u.codigo_interno?.toLowerCase().includes(s) ||
      u.no_serie?.toLowerCase().includes(s) ||
      u.herramienta?.descripcion?.toLowerCase().includes(s) ||
      u.complementos?.toLowerCase().includes(s)
    ))
  }, [unidades, search])

  const handleHerramientaChange = (e) => {
    const id = e.target.value
    setForm({ ...form, herramienta_id: id })
    const h = herramientas.find((x) => String(x.id) === String(id))
    setSerializadaSel(h?.serializada ?? true)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.herramienta_id) return toast.error('Selecciona la herramienta')
    if (serializadaSel && !form.no_serie.trim()) {
      return toast.error('No. de serie es obligatorio para herramientas serializadas')
    }
    setSaving(true)
    try {
      const payload = {
        herramienta_id: Number(form.herramienta_id),
        no_serie: form.no_serie.trim() || null,
        almacen_id: form.almacen_id ? Number(form.almacen_id) : null,
        estante_id: form.estante_id ? Number(form.estante_id) : null,
        cantidad: Number(form.cantidad) || 1,
        complementos: form.complementos.trim() || null,
        fecha_adquisicion: form.fecha_adquisicion || null,
        costo_adquisicion: form.costo_adquisicion ? Number(form.costo_adquisicion) : null,
        vida_util_meses: form.vida_util_meses ? Number(form.vida_util_meses) : null,
        observaciones: form.observaciones.trim() || null,
      }
      await createUnidad(payload)
      toast.success('Unidad creada')
      setOpenForm(false)
      setForm(FORM_INICIAL)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo crear la unidad'))
    } finally {
      setSaving(false)
    }
  }

  const limpiarFiltros = () => {
    setSearchParams({})
    setEstadoFiltro('')
    setSearch('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Unidades de Herramientas"
        description="Instancias físicas rastreables del catálogo"
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <Plus size={16} className="mr-1.5" /> Nueva unidad
          </Button>
        }
      />

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Código interno, No. serie, descripción…"
            leftIcon={<Search size={16} />}
          />
        </div>
        <div className="min-w-[200px]">
          <Select label="Estado" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_UNIDAD.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </Select>
        </div>
        <div className="min-w-[240px]">
          <Select label="Herramienta"
                  value={herramientaFiltro}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) setSearchParams({ herramienta_id: v })
                    else setSearchParams({})
                  }}>
            <option value="">Todas</option>
            {herramientas.map((h) => (
              <option key={h.id} value={h.id}>{h.sku} — {h.descripcion}</option>
            ))}
          </Select>
        </div>
        {(herramientaFiltro || estadoFiltro || search) && (
          <Button variant="ghost" onClick={limpiarFiltros}>Limpiar</Button>
        )}
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Hammer}
            title="Sin unidades"
            description="Aún no hay unidades físicas registradas con esos filtros."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((u) => (
            <Link key={u.id} to={`/inventario/herramientas/unidades/${u.id}`} className="block">
              <Card className="!p-4 h-full flex flex-col gap-3 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all">
                <div className="flex items-start gap-3">
                  {u.foto_principal_id ? (
                    <AuthImage src={authFotoPath(u.id, u.foto_principal_id)} alt={u.codigo_interno}
                         className="h-14 w-14 rounded-lg object-cover ring-1 ring-ink-200 dark:ring-ink-700 flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-ink-100 dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700 inline-flex items-center justify-center text-ink-400 dark:text-ink-500 flex-shrink-0">
                      <Hammer size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink-900 dark:text-ink-100 truncate" title={u.herramienta?.descripcion}>
                      {u.herramienta?.descripcion || '—'}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-ink-500 dark:text-ink-400 mt-0.5 font-mono">
                      {u.codigo_interno}
                    </div>
                  </div>
                  <Badge tone={ESTADO_TONE[u.estado] || 'neutral'} dot>
                    {ESTADO_LABEL[u.estado] || u.estado}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-500 dark:text-ink-400">SKU</div>
                    <div className="font-mono text-ink-700 dark:text-ink-200 truncate">{u.herramienta?.sku || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-500 dark:text-ink-400">No. serie</div>
                    <div className="font-mono text-ink-700 dark:text-ink-200 truncate">{u.no_serie || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-500 dark:text-ink-400">Ubicación</div>
                    <div className="text-ink-700 dark:text-ink-200 truncate">
                      {u.almacen_nombre || '—'}
                      {u.estante_nombre && <span className="text-ink-500 dark:text-ink-400"> · {u.estante_nombre}</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-500 dark:text-ink-400">Asignado a</div>
                    <div className="text-ink-700 dark:text-ink-200 truncate">{u.trabajador_nombre || '—'}</div>
                  </div>
                </div>

                {u.fecha_adquisicion && (
                  <div className="text-[10px] text-ink-500 dark:text-ink-400 mt-auto pt-2 border-t border-ink-200 dark:border-ink-800">
                    Adquirida: {formatDate(u.fecha_adquisicion)}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Nueva unidad física" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Herramienta *" value={form.herramienta_id} onChange={handleHerramientaChange}>
            <option value="">Selecciona…</option>
            {herramientas.map((h) => (
              <option key={h.id} value={h.id}>
                {h.sku} — {h.descripcion} {h.serializada ? '[Serie]' : '[Sin serie]'}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={serializadaSel ? 'No. serie *' : 'No. serie (opcional)'}
              value={form.no_serie}
              onChange={(e) => setForm({ ...form, no_serie: e.target.value })}
              maxLength={100}
            />
            <Input label="Cantidad" type="number" min={1} value={form.cantidad}
                   onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />

            <Select label="Almacén" value={form.almacen_id}
                    onChange={(e) => setForm({ ...form, almacen_id: e.target.value, estante_id: '' })}>
              <option value="">Sin almacén</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
            <Select label="Estante" value={form.estante_id}
                    onChange={(e) => setForm({ ...form, estante_id: e.target.value })}
                    disabled={!form.almacen_id}>
              <option value="">Sin estante</option>
              {estantes.map((es) => <option key={es.id} value={es.id}>{es.nombre}</option>)}
            </Select>

            <Input label="Fecha adquisición" type="date"
                   value={form.fecha_adquisicion}
                   onChange={(e) => setForm({ ...form, fecha_adquisicion: e.target.value })} />
            <Input label="Costo adquisición ($)" type="number" min={0} step={0.01}
                   value={form.costo_adquisicion}
                   onChange={(e) => setForm({ ...form, costo_adquisicion: e.target.value })} />
            <Input label="Vida útil (meses)" type="number" min={0}
                   value={form.vida_util_meses}
                   onChange={(e) => setForm({ ...form, vida_util_meses: e.target.value })} />
          </div>

          <Input label="Complementos" value={form.complementos}
                 onChange={(e) => setForm({ ...form, complementos: e.target.value })}
                 placeholder="Maletín, broca SDS 8mm, batería extra…"
                 maxLength={500} />
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">
              Observaciones
            </label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={3} maxLength={1000}
              className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear unidad'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
