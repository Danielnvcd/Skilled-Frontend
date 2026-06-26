import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { HardHat, Plus, Search, Eye, Info, Undo2, ChevronsUpDown } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Skeleton, Badge,
  Input, Select, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getAsignaciones, crearAsignacion, getUnidades, devolverAsignacion,
} from '../../api/herramientas'
import { getProyectosInventario } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { CONDICION, formatDateTime } from './herramientasShared'
import api from '../../api/axios'

async function getTrabajadores() {
  // Picker ligero: el listado normal de /trabajadores bloquea al rol inventario
  // (expone PII del padrón). /para-asignar devuelve solo id/nº empleado/nombre,
  // abierto a inventario, que es quien crea las asignaciones.
  const { data } = await api.get('/trabajadores/para-asignar?per_page=500')
  return Array.isArray(data) ? data : (data.items || data.results || [])
}

// Selector con búsqueda integrada en el propio desplegable. El panel se expande
// dentro del flujo (no es absolute) para no recortarse dentro del Modal, que tiene
// overflow-y-auto en su cuerpo.
function ComboBox({ label, value, onChange, options, getKey, getLabel, placeholder, emptyText = 'Sin coincidencias' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim()
    if (!s) return options
    return options.filter((o) => getLabel(o).toLowerCase().includes(s))
  }, [options, q, getLabel])

  const selected = options.find((o) => String(getKey(o)) === String(value))

  return (
    <div ref={boxRef} className="relative">
      {label && (
        <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">{label}</label>
      )}
      <button type="button" onClick={() => { setQ(''); setOpen((o) => !o) }}
        className="w-full flex items-center justify-between gap-2 rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm text-left focus-ring">
        <span className={selected ? 'truncate' : 'truncate text-ink-400'}>
          {selected ? getLabel(selected) : (placeholder || 'Selecciona…')}
        </span>
        <ChevronsUpDown size={15} className="opacity-60 flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-ink-100 dark:border-ink-800">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Buscar…" leftIcon={<Search size={15} />} />
          </div>
          <ul className="max-h-48 overflow-y-auto scrollbar-thin py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-400">{emptyText}</li>
            ) : filtered.map((o) => {
              const k = getKey(o)
              const isSel = String(k) === String(value)
              return (
                <li key={k}>
                  <button type="button"
                    onClick={() => { onChange(String(k)); setOpen(false); setQ('') }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-800 ${isSel ? 'bg-brand-50 dark:bg-brand-900/20 font-medium' : ''}`}>
                    {getLabel(o)}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

const FORM_INICIAL = {
  unidad_id: '',
  trabajador_id: '',
  proyecto: '',
  fecha_devolucion_prevista: '',
  condicion_entrega: 'BUENA',
  observaciones_entrega: '',
}

export default function AsignacionesHerramienta() {
  const [estadoFiltro, setEstadoFiltro] = useState('ACTIVA')
  const [search, setSearch] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [unidadesDisp, setUnidadesDisp] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [proyectos, setProyectos] = useState([])

  // Devolución inline desde la tabla (antes había que ir a la ficha de la unidad).
  const DEV_INICIAL = { condicion_devolucion: 'BUENA', nuevo_estado_unidad: 'DISPONIBLE', observaciones_devolucion: '' }
  const [devolver, setDevolver] = useState(null)   // asignación a devolver
  const [devForm, setDevForm] = useState(DEV_INICIAL)
  const [devSaving, setDevSaving] = useState(false)

  const {
    data: rawItems,
    loading,
    error,
    refetch,
  } = useResource(
    ['asignaciones-herramienta', { estado: estadoFiltro || null }],
    () => {
      const params = {}
      if (estadoFiltro) params.estado = estadoFiltro
      return getAsignaciones(params)
    },
    { staleMs: 30_000, invalidateOn: ['asignacion:changed'] },
  )
  const items = rawItems ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error'))
  }, [error])

  const load = () => { refetch() }

  useEffect(() => {
    if (openForm) {
      getUnidades({ estado: 'DISPONIBLE' }).then(setUnidadesDisp).catch(() => {})
      getTrabajadores().then(setTrabajadores).catch(() => setTrabajadores([]))
      getProyectosInventario()
        .then((res) => setProyectos(Array.isArray(res) ? res : (res?.items || [])))
        .catch(() => setProyectos([]))
    }
  }, [openForm])

  const trabLabel = (t) => {
    const base = t.nombre_completo || `${t.nombre || ''} ${t.nombre_apellidos || ''}`.trim()
    return t.numero_empleado ? `${base} · #${t.numero_empleado}` : base
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const s = search.toLowerCase()
    return items.filter((a) => (
      a.trabajador_nombre?.toLowerCase().includes(s) ||
      a.unidad_codigo?.toLowerCase().includes(s) ||
      a.proyecto?.toLowerCase().includes(s)
    ))
  }, [items, search])

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!form.unidad_id || !form.trabajador_id) {
      return toast.error('Selecciona unidad y trabajador')
    }
    setSaving(true)
    try {
      await crearAsignacion({
        unidad_id: Number(form.unidad_id),
        trabajador_id: Number(form.trabajador_id),
        proyecto: form.proyecto.trim() || null,
        fecha_devolucion_prevista: form.fecha_devolucion_prevista || null,
        condicion_entrega: form.condicion_entrega,
        observaciones_entrega: form.observaciones_entrega.trim() || null,
      })
      toast.success('Herramienta asignada')
      setOpenForm(false)
      setForm(FORM_INICIAL)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo asignar'))
    } finally { setSaving(false) }
  }

  const abrirDevolver = (a) => {
    setDevForm(DEV_INICIAL)
    setDevolver(a)
  }

  const submitDevolver = async (e) => {
    e?.preventDefault?.()
    if (!devolver) return
    setDevSaving(true)
    try {
      await devolverAsignacion(devolver.id, {
        condicion_devolucion: devForm.condicion_devolucion,
        nuevo_estado_unidad: devForm.nuevo_estado_unidad,
        observaciones_devolucion: devForm.observaciones_devolucion.trim() || null,
      })
      toast.success('Herramienta devuelta')
      setDevolver(null)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la devolución'))
    } finally { setDevSaving(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Asignaciones de Herramientas"
        description="Préstamo de unidades a trabajadores"
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <Plus size={16} className="mr-1.5" /> Nueva asignación
          </Button>
        } />

      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          Para entregar una <strong>herramienta solicitada</strong> desde un pedido, el usuario que la pidió debe tener
          un <strong>empleado ligado a su cuenta</strong> (desde <strong>Usuarios</strong>). Si no lo tiene, liga la cuenta
          primero o crea la asignación manualmente aquí con <strong>Nueva asignación</strong>.
        </span>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <Input label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Trabajador, código, proyecto…" leftIcon={<Search size={16} />} />
        </div>
        <div className="min-w-[180px]">
          <Select label="Estado" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            <option value="ACTIVA">Activas</option>
            <option value="DEVUELTA">Devueltas</option>
            <option value="VENCIDA">Vencidas</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={HardHat} title="Sin asignaciones"
                      description="Ninguna asignación coincide con los filtros." />
        ) : (
          <Table>
            <THead>
              <TH>Unidad</TH>
              <TH>Trabajador</TH>
              <TH>Proyecto</TH>
              <TH>Entrega</TH>
              <TH>Devolución prevista</TH>
              <TH>Estado</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {filtered.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <div className="text-sm font-medium">{a.unidad_descripcion || '—'}</div>
                    <div className="font-mono text-xs opacity-70">
                      {a.unidad_codigo}{a.unidad_no_serie ? ` · ${a.unidad_no_serie}` : ''}
                    </div>
                  </TD>
                  <TD>{a.trabajador_nombre}</TD>
                  <TD className="text-sm">{a.proyecto || '—'}</TD>
                  <TD className="text-xs">{formatDateTime(a.fecha_entrega)}</TD>
                  <TD className="text-xs">{formatDateTime(a.fecha_devolucion_prevista)}</TD>
                  <TD>
                    <Badge tone={a.estado === 'ACTIVA' ? 'info' : a.estado === 'DEVUELTA' ? 'success' : 'warning'} dot>
                      {a.estado}
                    </Badge>
                  </TD>
                  <TD align="right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {a.estado === 'ACTIVA' && (
                        <Button size="sm" variant="ghost" onClick={() => abrirDevolver(a)}>
                          <Undo2 size={15} className="mr-1" /> Devolver
                        </Button>
                      )}
                      <Link to={`/inventario/herramientas/unidades/${a.unidad_id}`}
                            title="Ver ficha de la unidad"
                            className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white inline-flex">
                        <Eye size={16} />
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Nueva asignación" size="lg">
        <form onSubmit={submit} className="space-y-3">
          <ComboBox
            label="Unidad disponible *"
            value={form.unidad_id}
            onChange={(v) => setForm({ ...form, unidad_id: v })}
            options={unidadesDisp}
            getKey={(u) => u.id}
            getLabel={(u) => `${u.codigo_interno} · ${u.herramienta?.descripcion || ''}${u.no_serie ? ` (${u.no_serie})` : ''}`}
            placeholder="Selecciona una unidad…"
            emptyText="Sin unidades disponibles"
          />
          <ComboBox
            label="Trabajador *"
            value={form.trabajador_id}
            onChange={(v) => setForm({ ...form, trabajador_id: v })}
            options={trabajadores}
            getKey={(t) => t.id}
            getLabel={trabLabel}
            placeholder="Selecciona un trabajador…"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Proyecto" value={form.proyecto}
                    onChange={(e) => setForm({ ...form, proyecto: e.target.value })}>
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => {
                const etiqueta = `${p.numero_proyecto} — ${p.nombre}`
                return <option key={p.id} value={etiqueta}>{etiqueta}</option>
              })}
            </Select>
            <Input label="Devolución prevista" type="datetime-local"
                   value={form.fecha_devolucion_prevista}
                   onChange={(e) => setForm({ ...form, fecha_devolucion_prevista: e.target.value })} />
            <Select label="Condición de entrega" value={form.condicion_entrega}
                    onChange={(e) => setForm({ ...form, condicion_entrega: e.target.value })}>
              {CONDICION.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Observaciones</label>
            <textarea value={form.observaciones_entrega}
                      onChange={(e) => setForm({ ...form, observaciones_entrega: e.target.value })}
                      rows={3} maxLength={1000}
                      className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Asignando…' : 'Asignar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!devolver} onClose={() => setDevolver(null)} title="Registrar devolución" size="md">
        {devolver && (
          <form onSubmit={submitDevolver} className="space-y-3">
            <div className="rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 p-3 text-sm">
              <div className="font-medium">{devolver.unidad_descripcion || devolver.unidad_codigo}</div>
              <div className="text-xs opacity-70 font-mono">
                {devolver.unidad_codigo}{devolver.unidad_no_serie ? ` · ${devolver.unidad_no_serie}` : ''}
              </div>
              <div className="text-xs mt-1">Asignada a <strong>{devolver.trabajador_nombre}</strong></div>
            </div>
            <Select label="Condición de devolución *" value={devForm.condicion_devolucion}
                    onChange={(e) => setDevForm({ ...devForm, condicion_devolucion: e.target.value })}>
              {CONDICION.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Nuevo estado de la unidad *" value={devForm.nuevo_estado_unidad}
                    onChange={(e) => setDevForm({ ...devForm, nuevo_estado_unidad: e.target.value })}>
              <option value="DISPONIBLE">Disponible (vuelve al inventario)</option>
              <option value="DAÑADA">Dañada</option>
              <option value="EXTRAVIADA">Extraviada</option>
            </Select>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Observaciones</label>
              <textarea value={devForm.observaciones_devolucion}
                        onChange={(e) => setDevForm({ ...devForm, observaciones_devolucion: e.target.value })}
                        rows={3} maxLength={1000}
                        placeholder="Estado en que regresa, detalles del daño, etc."
                        className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDevolver(null)}>Cancelar</Button>
              <Button type="submit" disabled={devSaving}>{devSaving ? 'Guardando…' : 'Confirmar devolución'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
