import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { HardHat, Plus, Search, Eye } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Skeleton, Badge,
  Input, Select, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getAsignaciones, crearAsignacion, getUnidades,
} from '../../api/herramientas'
import { listarProyectos } from '../../api/proyectos'
import { extractApiError } from '../../utils/apiError'
import { CONDICION, formatDateTime } from './herramientasShared'
import api from '../../api/axios'

async function getTrabajadores() {
  const { data } = await api.get('/trabajadores?activo=true&page_size=500')
  return Array.isArray(data) ? data : (data.items || data.results || [])
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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [estadoFiltro, setEstadoFiltro] = useState('ACTIVA')
  const [search, setSearch] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [unidadesDisp, setUnidadesDisp] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [proyectos, setProyectos] = useState([])

  const load = () => {
    setLoading(true)
    const params = {}
    if (estadoFiltro) params.estado = estadoFiltro
    getAsignaciones(params)
      .then(setItems)
      .catch((e) => toast.error(extractApiError(e, 'Error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [estadoFiltro])

  useEffect(() => {
    if (openForm) {
      getUnidades({ estado: 'DISPONIBLE' }).then(setUnidadesDisp).catch(() => {})
      getTrabajadores().then(setTrabajadores).catch(() => setTrabajadores([]))
      listarProyectos({ estado: 'activos' })
        .then((res) => setProyectos(res.items || []))
        .catch(() => setProyectos([]))
    }
  }, [openForm])

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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Asignaciones de Herramientas"
        description="Préstamo de unidades a trabajadores"
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <Plus size={16} className="mr-1.5" /> Nueva asignación
          </Button>
        } />

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
              <TH align="right">Ficha</TH>
            </THead>
            <TBody>
              {filtered.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <div className="font-mono text-xs">{a.unidad_codigo}</div>
                    <div className="text-xs opacity-70">{a.unidad_no_serie || ''}</div>
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
                    <Link to={`/inventario/herramientas/unidades/${a.unidad_id}`}
                          className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white inline-flex">
                      <Eye size={16} />
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Nueva asignación" size="lg">
        <form onSubmit={submit} className="space-y-3">
          <Select label="Unidad disponible *" value={form.unidad_id}
                  onChange={(e) => setForm({ ...form, unidad_id: e.target.value })}>
            <option value="">Selecciona…</option>
            {unidadesDisp.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo_interno} · {u.herramienta?.descripcion} {u.no_serie ? `(${u.no_serie})` : ''}
              </option>
            ))}
          </Select>
          <Select label="Trabajador *" value={form.trabajador_id}
                  onChange={(e) => setForm({ ...form, trabajador_id: e.target.value })}>
            <option value="">Selecciona…</option>
            {trabajadores.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_completo || `${t.nombre} ${t.nombre_apellidos || ''}`}</option>
            ))}
          </Select>
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
    </div>
  )
}
