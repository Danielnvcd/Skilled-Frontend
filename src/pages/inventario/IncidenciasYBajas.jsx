import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Eye, CheckCircle2, XCircle, Ban } from 'lucide-react'
import {
  Card, PageHeader, Modal, Skeleton, Badge, Button, Select, EmptyState,
  Table, THead, TH, TBody, TR, TD, ConfirmDialog, Textarea, InfoTip,
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
  // Confirmaciones con UI propia (sin confirm()/prompt() nativos del navegador).
  const [confirmAccion, setConfirmAccion] = useState(null)  // { id, tipo: 'aceptar' | 'ejecutar' }
  const [rechazo, setRechazo] = useState(null)              // { id, motivo }

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

  const handleAutorizar = async (id) => {
    setBusy(true)
    try {
      await autorizarBaja(id, {})
      toast.success('Solicitud autorizada')
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  // Ejecuta la confirmación del diálogo. 'aceptar' = autorizar + ejecutar en un
  // paso (la unidad queda DADA_DE_BAJA y se libera su asignación de inmediato);
  // 'ejecutar' = solo ejecutar una baja ya APROBADA.
  const confirmarAccion = async () => {
    if (!confirmAccion) return
    const { id, tipo } = confirmAccion
    setBusy(true)
    try {
      if (tipo === 'aceptar') {
        await autorizarBaja(id, {})
        await ejecutarBaja(id)
        toast.success('Baja aceptada y ejecutada')
      } else {
        await ejecutarBaja(id)
        toast.success('Baja ejecutada')
      }
      setConfirmAccion(null)
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  const confirmarRechazo = async () => {
    if (!rechazo) return
    setBusy(true)
    try {
      await rechazarBaja(rechazo.id, { observaciones: rechazo.motivo?.trim() || null })
      toast.success('Solicitud rechazada')
      setRechazo(null)
      load()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader icon={AlertTriangle}
                  title={<span className="inline-flex items-center gap-1.5">
                    Incidencias y Solicitudes de Baja
                    <InfoTip text="Bandeja de inventario para atender lo que reportan los demás. En bajas: “Aceptar y dar de baja” autoriza y ejecuta en un paso; “Solo autorizar” deja la baja pendiente de ejecutar." />
                  </span>}
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
                              <Button size="sm" onClick={() => setConfirmAccion({ id: b.id, tipo: 'aceptar' })} disabled={busy}
                                      title="Autoriza y da de baja la unidad de inmediato">
                                <CheckCircle2 size={14} className="mr-1" /> Aceptar y dar de baja
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleAutorizar(b.id)} disabled={busy}
                                      title="Solo autoriza; la baja se ejecuta después con “Ejecutar baja”">
                                Solo autorizar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setRechazo({ id: b.id, motivo: '' })} disabled={busy}>
                                <XCircle size={14} className="mr-1" /> Rechazar
                              </Button>
                            </>
                          )}
                          {b.estado === 'APROBADA' && (
                            <Button size="sm" onClick={() => setConfirmAccion({ id: b.id, tipo: 'ejecutar' })} disabled={busy}>
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

      {/* Confirmación de aceptar / ejecutar baja (sin confirm() nativo) */}
      <ConfirmDialog
        open={!!confirmAccion}
        onClose={() => !busy && setConfirmAccion(null)}
        onConfirm={confirmarAccion}
        loading={busy}
        tone="danger"
        title={confirmAccion?.tipo === 'aceptar' ? 'Aceptar y dar de baja' : 'Ejecutar baja'}
        description="La unidad quedará DADA_DE_BAJA y se cerrará su asignación. Esta acción no se puede deshacer."
        confirmLabel={confirmAccion?.tipo === 'aceptar' ? 'Aceptar y dar de baja' : 'Ejecutar baja'}
      />

      {/* Rechazo con motivo (sin prompt() nativo) */}
      <Modal
        open={!!rechazo}
        onClose={() => !busy && setRechazo(null)}
        title="Rechazar solicitud de baja"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRechazo(null)} disabled={busy}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarRechazo} loading={busy}>Rechazar</Button>
          </>
        }
      >
        <Textarea
          label="Motivo del rechazo (opcional)"
          rows={3}
          value={rechazo?.motivo || ''}
          onChange={(e) => setRechazo((r) => ({ ...r, motivo: e.target.value }))}
          placeholder="Explica por qué se rechaza la baja…"
        />
      </Modal>
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
