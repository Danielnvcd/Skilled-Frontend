import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ClipboardCheck, Plus, ChevronRight, Filter } from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Select, Skeleton,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { listTomas, createToma, getAlmacenes } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const ESTATUS_LABEL = {
  ABIERTA:   'En curso',
  CERRADA:   'Terminada',
  CANCELADA: 'Descartada',
}

const ESTATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ABIERTA', label: 'En curso' },
  { value: 'CERRADA', label: 'Terminadas' },
  { value: 'CANCELADA', label: 'Descartadas' },
]

function EstadoBadge({ estatus }) {
  const map = {
    ABIERTA:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    CERRADA:   'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
    CANCELADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${map[estatus] || ''}`}>
      {ESTATUS_LABEL[estatus] || estatus}
    </span>
  )
}

export default function Tomas() {
  const [tomas, setTomas] = useState([])
  const [almacenes, setAlmacenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstatus, setFiltroEstatus] = useState('')
  const [filtroAlmacen, setFiltroAlmacen] = useState('')

  const [nuevaForm, setNuevaForm] = useState(null)
  const [creando, setCreando] = useState(false)
  const navigate = useNavigate()

  const cargar = () => {
    setLoading(true)
    const params = {}
    if (filtroEstatus) params.estatus = filtroEstatus
    if (filtroAlmacen) params.almacen_id = filtroAlmacen
    listTomas(params)
      .then(setTomas)
      .catch(err => toast.error(extractApiError(err, 'Error al cargar tomas')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
  }, [filtroEstatus, filtroAlmacen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getAlmacenes().then(setAlmacenes).catch(() => setAlmacenes([]))
  }, [])

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!nuevaForm?.almacen_id) {
      toast.error('Selecciona un almacén')
      return
    }
    setCreando(true)
    try {
      const t = await createToma({
        almacen_id: Number(nuevaForm.almacen_id),
        notas: nuevaForm.notas || null,
      })
      toast.success(`Conteo #${t.id} listo — ${t.total_lineas} producto(s) por contar`)
      setNuevaForm(null)
      navigate(`/inventario/tomas/${t.id}`)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al iniciar toma'))
    } finally {
      setCreando(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={ClipboardCheck}
        title="Conteos de inventario (tomas físicas)"
        description="Cuenta lo que hay de verdad en un almacén y el sistema corrige las diferencias por ti."
        actions={
          <Button leftIcon={<Plus size={15} />} onClick={() => setNuevaForm({ almacen_id: '', notas: '' })}>
            Empezar conteo
          </Button>
        }
      />

      <Card className="mt-4 border-brand-200 dark:border-brand-900 bg-brand-50/60 dark:bg-brand-900/10">
        <div className="p-3 text-sm text-ink-700 dark:text-ink-300">
          <p className="font-semibold mb-1">¿Para qué sirve esto?</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">
            Con el tiempo lo que dice el sistema y lo que hay en la bodega se desajusta (mermas, errores, etc.).
            Un conteo sirve para revisar producto por producto y dejar el inventario al día. Pasos:
            <strong> 1)</strong> Empieza un conteo y elige el almacén.
            <strong> 2)</strong> Cuenta y anota lo que hay de cada producto.
            <strong> 3)</strong> Termina el conteo y el sistema corrige solo las diferencias.
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="p-3 border-b border-ink-200 dark:border-ink-800 flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-1 text-xs text-ink-500"><Filter size={14} /> Filtros:</div>
          <Select
            label="Estatus"
            value={filtroEstatus}
            onChange={e => setFiltroEstatus(e.target.value)}
            className="w-40"
          >
            {ESTATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select
            label="Almacén"
            value={filtroAlmacen}
            onChange={e => setFiltroAlmacen(e.target.value)}
            className="w-56"
          >
            <option value="">Todos</option>
            {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="p-6"><Skeleton className="h-40 w-full rounded-md" /></div>
        ) : tomas.length === 0 ? (
          <p className="p-8 text-center text-sm italic text-ink-500">
            Todavía no hay conteos. Pulsa <strong>"Empezar conteo"</strong> para hacer el primero.
          </p>
        ) : (
          <Table>
            <THead>
              <TH>#</TH>
              <TH>Almacén</TH>
              <TH>Iniciada</TH>
              <TH>Por</TH>
              <TH>Estatus</TH>
              <TH align="right">Progreso</TH>
              <TH align="right"></TH>
            </THead>
            <TBody>
              {tomas.map(t => {
                const pct = Math.round((t.progreso || 0) * 100)
                return (
                  <TR key={t.id}>
                    <TD className="font-mono">#{t.id}</TD>
                    <TD>{t.almacen_nombre}</TD>
                    <TD className="text-xs text-ink-500">
                      {t.fecha_inicio ? new Date(t.fecha_inicio).toLocaleString() : '—'}
                    </TD>
                    <TD className="text-xs">{t.usuario_nombre}</TD>
                    <TD><EstadoBadge estatus={t.estatus} /></TD>
                    <TD align="right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-medium">{t.lineas_capturadas}/{t.total_lineas}</span>
                        <div className="w-24 h-1.5 bg-ink-100 dark:bg-ink-800 rounded overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </TD>
                    <TD align="right">
                      <Link to={`/inventario/tomas/${t.id}`}>
                        <Button variant="ghost" size="sm" rightIcon={<ChevronRight size={14} />}>
                          Abrir
                        </Button>
                      </Link>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!nuevaForm}
        onClose={() => setNuevaForm(null)}
        title="Empezar un conteo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNuevaForm(null)}>Cancelar</Button>
            <Button type="submit" form="form-toma" loading={creando}>Empezar</Button>
          </>
        }
      >
        <form id="form-toma" onSubmit={handleCrear} className="space-y-4">
          <Select
            label="Almacén"
            value={nuevaForm?.almacen_id || ''}
            onChange={e => setNuevaForm({ ...nuevaForm, almacen_id: e.target.value })}
            required
          >
            <option value="">Selecciona…</option>
            {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Select>
          <div>
            <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={nuevaForm?.notas || ''}
              onChange={e => setNuevaForm({ ...nuevaForm, notas: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ej. Conteo de abril 2026."
            />
          </div>
          <p className="text-xs text-ink-500">
            Al empezar, el sistema guarda cuánto hay registrado ahora de cada producto; luego tú lo
            comparas con lo que cuentes. Solo puede haber un conteo abierto por almacén a la vez.
          </p>
        </form>
      </Modal>
    </div>
  )
}
