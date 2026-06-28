import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Settings2, Eye } from 'lucide-react'
import {
  Card, PageHeader, Modal, Skeleton, Badge, Button, Select, Input, EmptyState, InfoTip,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { getMantenimientos, cerrarMantenimiento } from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { formatDateTime } from './herramientasShared'

export default function MantenimientosHerramienta() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('ABIERTO')
  const [cierre, setCierre] = useState(null)

  const load = () => {
    setLoading(true)
    const params = estado ? { estado } : {}
    getMantenimientos(params).then(setItems)
      .catch((e) => toast.error(extractApiError(e, 'Error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [estado])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">
          Mantenimientos de Herramientas
          <InfoTip text="Unidades enviadas a reparación/servicio. Un mantenimiento abierto deja la unidad EN_MANTENIMIENTO; al cerrarlo defines en qué estado regresa. El envío se inicia desde la ficha de la unidad." />
        </span>}
        description="Registro de envíos y cierres de mantenimiento" />

      <Card className="p-4 flex gap-3 items-end">
        <div className="min-w-[200px]">
          <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="ABIERTO">Abiertos</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="CERRADO">Cerrados</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Settings2} title="Sin mantenimientos"
                      description="No hay registros con esos filtros." />
        ) : (
          <Table>
            <THead>
              <TH>Unidad</TH>
              <TH>Tipo</TH>
              <TH>Motivo</TH>
              <TH>Proveedor</TH>
              <TH>Inicio</TH>
              <TH>Cierre</TH>
              <TH>Costo</TH>
              <TH>Estado</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {items.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link to={`/inventario/herramientas/unidades/${m.unidad_id}`}
                          className="text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 font-mono text-xs inline-flex items-center gap-1">
                      <Eye size={12} /> #{m.unidad_id}
                    </Link>
                  </TD>
                  <TD><Badge tone={m.tipo === 'PREVENTIVO' ? 'info' : 'warning'}>{m.tipo}</Badge></TD>
                  <TD className="text-sm">{m.motivo}</TD>
                  <TD className="text-sm">{m.proveedor || '—'}</TD>
                  <TD className="text-xs">{formatDateTime(m.fecha_inicio)}</TD>
                  <TD className="text-xs">{formatDateTime(m.fecha_fin)}</TD>
                  <TD className="text-sm font-mono">{m.costo != null ? `$${m.costo.toLocaleString('es-MX')}` : '—'}</TD>
                  <TD><Badge tone={m.estado === 'CERRADO' ? 'success' : 'warning'} dot>{m.estado}</Badge></TD>
                  <TD align="right">
                    {m.estado !== 'CERRADO' && (
                      <Button size="sm" onClick={() => setCierre(m)} title="Cerrar el mantenimiento y definir en qué estado regresa la unidad">Cerrar</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {cierre && (
        <ModalCierre mant={cierre} onClose={() => setCierre(null)}
                      onDone={() => { setCierre(null); load() }} />
      )}
    </div>
  )
}

function ModalCierre({ mant, onClose, onDone }) {
  const [estadoFinal, setEstadoFinal] = useState('DISPONIBLE')
  const [costo, setCosto] = useState(mant.costo || '')
  const [obs, setObs] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await cerrarMantenimiento(mant.id, {
        estado_final_unidad: estadoFinal,
        costo_real: costo ? Number(costo) : null,
        observaciones: obs.trim() || null,
      })
      toast.success('Mantenimiento cerrado')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Cerrar mantenimiento #${mant.id}`}>
      <div className="space-y-3">
        <Select label="Estado final de la unidad" value={estadoFinal}
                onChange={(e) => setEstadoFinal(e.target.value)}>
          <option value="DISPONIBLE">Disponible (reparada)</option>
          <option value="DAÑADA">Dañada (necesita más trabajo)</option>
          <option value="DADA_DE_BAJA">Dada de baja (irrecuperable)</option>
        </Select>
        <Input label="Costo real" type="number" min={0} step={0.01} value={costo}
               onChange={(e) => setCosto(e.target.value)} />
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Observaciones</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} maxLength={1000}
                    className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar mantenimiento'}</Button>
        </div>
      </div>
    </Modal>
  )
}
