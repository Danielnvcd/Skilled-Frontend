import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Eye, CheckCircle2, XCircle, Ban } from 'lucide-react'
import {
  Card, PageHeader, Modal, Skeleton, Badge, Button, Select, EmptyState,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import {
  getIncidencias, atenderIncidencia,
  getSolicitudesBaja, autorizarBaja, rechazarBaja, ejecutarBaja,
} from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'
import { TIPO_INCIDENCIA_LABEL, formatDateTime } from './herramientasShared'

const TABS = ['incidencias', 'bajas']

export default function IncidenciasYBajas() {
  const [tab, setTab] = useState('incidencias')
  const [estadoInc, setEstadoInc] = useState('ABIERTA')
  const [estadoBaja, setEstadoBaja] = useState('PENDIENTE')
  const [atender, setAtender] = useState(null)
  const [busy, setBusy] = useState(false)

  const {
    data: rawIncs,
    loading: loadingIncs,
    error: errorIncs,
    refetch: refetchIncs,
  } = useResource(
    ['incidencias-herramienta', { estado: estadoInc || null }],
    () => getIncidencias(estadoInc ? { estado: estadoInc } : {}),
    { staleMs: 30_000, invalidateOn: ['incidencia:changed'] },
  )
  const {
    data: rawBajas,
    loading: loadingBajas,
    error: errorBajas,
    refetch: refetchBajas,
  } = useResource(
    ['solicitudes-baja-herramienta', { estado: estadoBaja || null }],
    () => getSolicitudesBaja(estadoBaja ? { estado: estadoBaja } : {}),
    { staleMs: 30_000, invalidateOn: ['baja:changed'] },
  )
  const incs = rawIncs ?? []
  const bajas = rawBajas ?? []
  const loading = loadingIncs || loadingBajas

  useEffect(() => {
    const err = errorIncs || errorBajas
    if (err) toast.error(extractApiError(err, 'Error'))
  }, [errorIncs, errorBajas])

  const load = () => { refetchIncs(); refetchBajas() }

  const handleEjecutar = async (id) => {
    if (!confirm('¿Ejecutar la baja? La unidad quedará DADA_DE_BAJA.')) return
    setBusy(true)
    try {
      await ejecutarBaja(id)
      toast.success('Baja ejecutada')
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  const handleAutorizar = async (id) => {
    setBusy(true)
    try {
      await autorizarBaja(id, {})
      toast.success('Solicitud autorizada')
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  const handleRechazar = async (id) => {
    const obs = prompt('Motivo del rechazo:')
    if (obs === null) return
    setBusy(true)
    try {
      await rechazarBaja(id, { observaciones: obs || null })
      toast.success('Solicitud rechazada')
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader icon={AlertTriangle}
                  title="Incidencias y Solicitudes de Baja"
                  description="Bandeja de entrada para inventario" />

      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-800">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-brand-700 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200'
            }`}>
            {t === 'incidencias' ? 'Incidencias' : 'Solicitudes de baja'}
          </button>
        ))}
      </div>

      {tab === 'incidencias' && (
        <>
          <Card className="p-4">
            <Select label="Estado" value={estadoInc} onChange={(e) => setEstadoInc(e.target.value)}>
              <option value="">Todas</option>
              <option value="ABIERTA">Abiertas</option>
              <option value="REVISION">En revisión</option>
              <option value="RESUELTA">Resueltas</option>
              <option value="RECHAZADA">Rechazadas</option>
            </Select>
          </Card>
          <Card>
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : incs.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Sin incidencias" />
            ) : (
              <Table>
                <THead>
                  <TH>Unidad</TH>
                  <TH>Tipo</TH>
                  <TH>Reportado por</TH>
                  <TH>Descripción</TH>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH align="right">Acciones</TH>
                </THead>
                <TBody>
                  {incs.map((i) => (
                    <TR key={i.id}>
                      <TD>
                        <Link to={`/inventario/herramientas/unidades/${i.unidad_id}`}
                              className="text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 font-mono font-semibold text-xs">
                          #{i.unidad_id}
                        </Link>
                      </TD>
                      <TD><Badge tone="warning">{TIPO_INCIDENCIA_LABEL[i.tipo] || i.tipo}</Badge></TD>
                      <TD className="text-sm">{i.reportado_por_username}</TD>
                      <TD className="text-sm max-w-md truncate" title={i.descripcion}>{i.descripcion}</TD>
                      <TD className="text-xs">{formatDateTime(i.fecha_reporte)}</TD>
                      <TD>
                        <Badge tone={i.estado === 'RESUELTA' ? 'success' : i.estado === 'RECHAZADA' ? 'neutral' : 'warning'} dot>
                          {i.estado}
                        </Badge>
                      </TD>
                      <TD align="right">
                        {['ABIERTA', 'REVISION'].includes(i.estado) && (
                          <Button size="sm" onClick={() => setAtender(i)}>Atender</Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {tab === 'bajas' && (
        <>
          <Card className="p-4">
            <Select label="Estado" value={estadoBaja} onChange={(e) => setEstadoBaja(e.target.value)}>
              <option value="">Todas</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADA">Aprobadas (listas para ejecutar)</option>
              <option value="EJECUTADA">Ejecutadas</option>
              <option value="RECHAZADA">Rechazadas</option>
            </Select>
          </Card>
          <Card>
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : bajas.length === 0 ? (
              <EmptyState icon={Ban} title="Sin solicitudes de baja" />
            ) : (
              <Table>
                <THead>
                  <TH>Unidad</TH>
                  <TH>Solicitante</TH>
                  <TH>Motivo</TH>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH align="right">Acciones</TH>
                </THead>
                <TBody>
                  {bajas.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <Link to={`/inventario/herramientas/unidades/${b.unidad_id}`}
                              className="text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 font-mono font-semibold text-xs">
                          #{b.unidad_id}
                        </Link>
                      </TD>
                      <TD className="text-sm">{b.solicitante_username}</TD>
                      <TD className="text-sm max-w-md truncate" title={b.motivo}>{b.motivo}</TD>
                      <TD className="text-xs">{formatDateTime(b.fecha_solicitud)}</TD>
                      <TD>
                        <Badge tone={b.estado === 'EJECUTADA' ? 'neutral' : b.estado === 'PENDIENTE' ? 'warning' : b.estado === 'APROBADA' ? 'info' : 'danger'} dot>
                          {b.estado}
                        </Badge>
                      </TD>
                      <TD align="right">
                        <div className="inline-flex gap-1">
                          {b.estado === 'PENDIENTE' && (
                            <>
                              <Button size="sm" onClick={() => handleAutorizar(b.id)} disabled={busy}>
                                <CheckCircle2 size={14} className="mr-1" /> Autorizar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleRechazar(b.id)} disabled={busy}>
                                <XCircle size={14} className="mr-1" /> Rechazar
                              </Button>
                            </>
                          )}
                          {b.estado === 'APROBADA' && (
                            <Button size="sm" onClick={() => handleEjecutar(b.id)} disabled={busy}>
                              <Ban size={14} className="mr-1" /> Ejecutar baja
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {atender && (
        <ModalAtender inc={atender} onClose={() => setAtender(null)}
                       onDone={() => { setAtender(null); load() }} />
      )}
    </div>
  )
}

function ModalAtender({ inc, onClose, onDone }) {
  const [estado, setEstado] = useState('RESUELTA')
  const [resolucion, setResolucion] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await atenderIncidencia(inc.id, { estado, resolucion: resolucion.trim() || null })
      toast.success('Incidencia atendida')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Atender incidencia #${inc.id}`}>
      <div className="space-y-3">
        <div className="text-xs p-3 rounded bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
          <div className="opacity-60 mb-1">Reportado por {inc.reportado_por_username}</div>
          <div>{inc.descripcion}</div>
        </div>
        <Select label="Nuevo estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="REVISION">En revisión</option>
          <option value="RESUELTA">Resuelta</option>
          <option value="RECHAZADA">Rechazada</option>
        </Select>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Resolución</label>
          <textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={3} maxLength={2000}
                    className="w-full rounded-md bg-white dark:bg-ink-800/50 border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none resize-none" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
