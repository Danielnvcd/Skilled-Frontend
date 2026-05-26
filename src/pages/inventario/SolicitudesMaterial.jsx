import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ClipboardList, CheckCircle2, XCircle, PackageCheck, Search, Clock,
  ListTodo, ThumbsUp, ThumbsDown, PackageOpen, Printer, Pencil, AlertTriangle,
} from 'lucide-react'
import {
  Button, Card, PageHeader, ConfirmDialog,
  Skeleton, Table, THead, TH, TBody, TR, TD, Badge, Modal, Select,
} from '../../components/ui'
import {
  getSolicitudes, updateSolicitudEstado, imprimirSolicitud,
  patchSolicitudDetalle, entregarSolicitud, getAlmacenes,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { key: 'TODAS',     label: 'Todas',      icon: ListTodo,   color: 'text-ink-600' },
  { key: 'PENDIENTE', label: 'Pendientes', icon: Clock,      color: 'text-amber-600' },
  { key: 'APROBADA',  label: 'Aprobadas',  icon: ThumbsUp,   color: 'text-emerald-600' },
  { key: 'RECHAZADA', label: 'Rechazadas', icon: ThumbsDown, color: 'text-red-600' },
  { key: 'ENTREGADA', label: 'Entregadas', icon: PackageOpen, color: 'text-blue-600' },
]

const num = (v) => Number(v ?? 0)

export default function SolicitudesMaterial() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'inventario'

  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('TODAS')

  const [confirmStatus, setConfirmStatus] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [viewDetails, setViewDetails] = useState(null)
  const [printingId, setPrintingId] = useState(null)

  // Pausa 8b — modal de entrega parcial.
  const [entregaTarget, setEntregaTarget] = useState(null) // solicitud

  const handlePrint = async (solId) => {
    setPrintingId(solId)
    try {
      await imprimirSolicitud(solId)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el PDF'))
    } finally {
      setPrintingId(null)
    }
  }

  const load = () => {
    setLoading(true)
    getSolicitudes({ limit: 200 })
      .then(setSolicitudes)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar solicitudes')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const acc = { TOTAL: solicitudes.length, PENDIENTE: 0, APROBADA: 0, RECHAZADA: 0, ENTREGADA: 0 }
    solicitudes.forEach((s) => { acc[s.estatus] = (acc[s.estatus] || 0) + 1 })
    return acc
  }, [solicitudes])

  const filtered = useMemo(() => {
    let res = solicitudes
    if (activeTab !== 'TODAS') {
      res = res.filter((s) => s.estatus === activeTab)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      res = res.filter((s) =>
        String(s.id).includes(q) ||
        s.solicitante_nombre?.toLowerCase().includes(q) ||
        s.proyecto?.toLowerCase().includes(q) ||
        s.detalles?.some((d) =>
          d.producto_descripcion?.toLowerCase().includes(q) ||
          d.producto_codigo?.toLowerCase().includes(q)
        )
      )
    }
    return res
  }, [solicitudes, activeTab, search])

  const handleChangeStatus = async () => {
    if (!confirmStatus) return
    setSavingStatus(true)
    try {
      await updateSolicitudEstado(confirmStatus.id, confirmStatus.newStatus)
      toast.success('Estado de solicitud actualizado')
      setConfirmStatus(null)
      load()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo cambiar el estado'))
    } finally {
      setSavingStatus(false)
    }
  }

  const getStatusTone = (estatus) => {
    switch (estatus) {
      case 'PENDIENTE': return 'warning'
      case 'APROBADA':  return 'success'
      case 'RECHAZADA': return 'danger'
      case 'ENTREGADA': return 'info'
      default: return 'neutral'
    }
  }

  const STAT_CARDS = [
    { key: 'TOTAL',     label: 'Total',      value: stats.TOTAL,     icon: ListTodo,    color: 'text-ink-600',    bg: 'bg-ink-50 dark:bg-ink-800' },
    { key: 'PENDIENTE', label: 'Pendientes', value: stats.PENDIENTE, icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { key: 'APROBADA',  label: 'Aprobadas',  value: stats.APROBADA,  icon: ThumbsUp,    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { key: 'RECHAZADA', label: 'Rechazadas', value: stats.RECHAZADA, icon: ThumbsDown,  color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
    { key: 'ENTREGADA', label: 'Entregadas', value: stats.ENTREGADA, icon: PackageOpen, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ]

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title={isAdmin ? 'Solicitudes de Material' : 'Mis solicitudes'}
        description={
          isAdmin
            ? 'Gestión de solicitudes realizadas por los empleados.'
            : 'Tus solicitudes y su estado actual.'
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon
          const isActive = activeTab === s.key || (s.key === 'TOTAL' && activeTab === 'TODAS')
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveTab(s.key === 'TOTAL' ? 'TODAS' : s.key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-ink-900'
                  : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:border-brand-300'
              }`}
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${s.bg} ${s.color} mb-2`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-extrabold text-ink-900 dark:text-ink-100 leading-none">{s.value}</p>
              <p className="text-xs text-ink-500 mt-1">{s.label}</p>
            </button>
          )
        })}
      </div>

      {/* Tabs + buscador */}
      <Card className="mt-6 !p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white border-brand-600'
                      : `bg-white dark:bg-ink-900 ${t.color} border-ink-200 dark:border-ink-700 hover:border-brand-400`
                  }`}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="relative flex-1 sm:ml-auto sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por ID, solicitante, proyecto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="mt-4">
        {loading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-ink-500">
            {solicitudes.length === 0
              ? 'No hay solicitudes registradas.'
              : 'Sin solicitudes para los filtros seleccionados.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>ID</TH>
                <TH>Fecha</TH>
                <TH>Solicitante</TH>
                <TH>Proyecto</TH>
                <TH>Ítems</TH>
                <TH>Estado</TH>
                <TH align="right">Acciones</TH>
              </THead>
              <TBody>
                {filtered.map((s) => {
                  const tienePendiente = isAprobadaConPendiente(s)
                  return (
                  <TR key={s.id}>
                    <TD className="font-mono text-sm">#{s.id}</TD>
                    <TD className="text-sm">
                      {new Date(s.fecha_creacion).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </TD>
                    <TD className="font-medium">{s.solicitante_nombre}</TD>
                    <TD>{s.proyecto || '—'}</TD>
                    <TD className="text-sm text-ink-500">{s.detalles?.length || 0}</TD>
                    <TD>
                      <div className="flex flex-col gap-1">
                        <Badge tone={getStatusTone(s.estatus)}>{s.estatus}</Badge>
                        {s.estatus === 'APROBADA' && tienePendiente && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wide">
                            Entrega parcial
                          </span>
                        )}
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewDetails(s)}>Ver detalles</Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Imprimir PDF"
                          onClick={() => handlePrint(s.id)}
                          loading={printingId === s.id}
                          disabled={printingId === s.id}
                        >
                          <Printer size={16} className="text-brand-600 dark:text-brand-300" />
                        </Button>

                        {isAdmin && s.estatus === 'PENDIENTE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Aprobar"
                              onClick={() => setConfirmStatus({ id: s.id, newStatus: 'APROBADA', title: 'Aprobar solicitud', text: '¿Confirmas la aprobación de esta solicitud?' })}
                            >
                              <CheckCircle2 size={16} className="text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Rechazar"
                              onClick={() => setConfirmStatus({ id: s.id, newStatus: 'RECHAZADA', title: 'Rechazar solicitud', text: '¿Confirmas el rechazo de esta solicitud?' })}
                            >
                              <XCircle size={16} className="text-red-600" />
                            </Button>
                          </>
                        )}
                        {isAdmin && s.estatus === 'APROBADA' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setEntregaTarget(s)}
                          >
                            <PackageCheck size={16} className="mr-1.5" /> Entregar
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )})}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleChangeStatus}
        loading={savingStatus}
        title={confirmStatus?.title}
        description={confirmStatus?.text}
        confirmLabel="Confirmar"
        tone={confirmStatus?.newStatus === 'RECHAZADA' ? 'danger' : 'primary'}
      />

      {/* Modal de detalles (lectura + edición de cantidad_aprobada) */}
      <DetallesModal
        solicitud={viewDetails}
        onClose={() => setViewDetails(null)}
        onChanged={load}
        isAdmin={isAdmin}
        getStatusTone={getStatusTone}
      />

      {/* Modal de entrega parcial */}
      <EntregaModal
        solicitud={entregaTarget}
        onClose={() => setEntregaTarget(null)}
        onDone={() => { setEntregaTarget(null); load() }}
      />
    </div>
  )
}


// ─── helpers ───────────────────────────────────────────────────────────────────

function isAprobadaConPendiente(s) {
  if (s?.estatus !== 'APROBADA') return false
  return (s.detalles || []).some((d) => {
    if ((d.tipo_item || 'MATERIAL') !== 'MATERIAL') return false
    const aprob = num(d.cantidad_aprobada)
    const ent = num(d.cantidad_entregada)
    return aprob > 0 && ent < aprob
  })
}


// ─── DetallesModal ─────────────────────────────────────────────────────────────

function DetallesModal({ solicitud, onClose, onChanged, isAdmin, getStatusTone }) {
  const [editing, setEditing] = useState(null)   // detalle id
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!solicitud) return null
  const puedeEditar = isAdmin && solicitud.estatus === 'APROBADA'

  const beginEdit = (det) => {
    setEditing(det.id)
    setEditValue(String(det.cantidad_aprobada ?? det.cantidad_solicitada ?? 0))
  }
  const cancelEdit = () => { setEditing(null); setEditValue('') }
  const saveEdit = async (det) => {
    const valor = Number(editValue)
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error('Cantidad inválida')
      return
    }
    setSaving(true)
    try {
      await patchSolicitudDetalle(solicitud.id, det.id, { cantidad_aprobada: valor })
      toast.success('Cantidad aprobada actualizada')
      setEditing(null)
      onChanged?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo actualizar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!solicitud}
      onClose={onClose}
      title={`Solicitud #${solicitud.id}`}
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm bg-ink-50 dark:bg-ink-900 p-3 rounded-lg">
          <div>
            <span className="text-ink-500 block">Solicitante</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{solicitud.solicitante_nombre}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Fecha</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{new Date(solicitud.fecha_creacion).toLocaleString('es-MX')}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Proyecto</span>
            <span className="font-medium text-ink-900 dark:text-ink-100">{solicitud.proyecto || 'N/A'}</span>
          </div>
          <div>
            <span className="text-ink-500 block">Estado actual</span>
            <Badge tone={getStatusTone(solicitud.estatus)}>{solicitud.estatus}</Badge>
          </div>
        </div>

        {isAprobadaConPendiente(solicitud) && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>Esta solicitud tiene entregas pendientes. Usa el botón <strong>Entregar</strong> para registrar lo que se va surtiendo.</span>
          </div>
        )}

        <h4 className="font-semibold text-ink-900 dark:text-ink-100 mt-4">Artículos solicitados:</h4>
        <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Ítem</th>
                <th className="text-right px-2 py-2">Solicitada</th>
                <th className="text-right px-2 py-2">Aprobada</th>
                <th className="text-right px-2 py-2">Entregada</th>
                <th className="text-right px-2 py-2">Pendiente</th>
                {puedeEditar && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
              {solicitud.detalles.map((d) => {
                const sol = num(d.cantidad_solicitada)
                const aprob = num(d.cantidad_aprobada)
                const ent = num(d.cantidad_entregada)
                const baseline = aprob > 0 ? aprob : sol
                const pendiente = Math.max(0, baseline - ent)
                const editable = puedeEditar && (d.tipo_item || 'MATERIAL') === 'MATERIAL' && d.producto_id
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-900 dark:text-ink-100">{d.producto_descripcion}</p>
                      <p className="text-xs text-ink-500">{d.producto_codigo} · {d.producto_unidad}</p>
                    </td>
                    <td className="px-2 py-2 text-right text-ink-700 dark:text-ink-300">{sol}</td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {editable && editing === d.id ? (
                        <input
                          type="number"
                          min={ent}
                          max={sol}
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-20 px-2 py-1 rounded border border-brand-400 text-right"
                          autoFocus
                        />
                      ) : (
                        aprob || (sol)
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{ent}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>
                      {pendiente}
                    </td>
                    {puedeEditar && (
                      <td className="px-2 py-2 text-right">
                        {editable && editing === d.id ? (
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="primary" onClick={() => saveEdit(d)} loading={saving} disabled={saving}>OK</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>X</Button>
                          </div>
                        ) : editable ? (
                          <Button size="icon-sm" variant="ghost" title="Editar cantidad aprobada" onClick={() => beginEdit(d)}>
                            <Pencil size={14} />
                          </Button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}


// ─── EntregaModal ──────────────────────────────────────────────────────────────

function EntregaModal({ solicitud, onClose, onDone }) {
  const [almacenes, setAlmacenes] = useState([])
  const [almacenId, setAlmacenId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [fechaDevolucionPrevista, setFechaDevolucionPrevista] = useState('')
  const [cantidades, setCantidades] = useState({}) // detalle_id → string (aplica a material Y herramienta)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!solicitud) return
    getAlmacenes()
      .then((arr) => {
        const activos = (arr || []).filter((a) => a.activo)
        setAlmacenes(activos)
        if (activos.length === 1) setAlmacenId(String(activos[0].id))
      })
      .catch(() => toast.error('No se pudieron cargar almacenes'))
    // Precargar cantidades = pendiente por línea (material y herramienta).
    const init = {}
    ;(solicitud.detalles || []).forEach((d) => {
      const tipo = (d.tipo_item || 'MATERIAL').toUpperCase()
      if (tipo === 'HERRAMIENTA' && !d.herramienta_id) return
      if (tipo === 'MATERIAL' && !d.producto_id) return
      const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
      const pendiente = Math.max(0, baseline - num(d.cantidad_entregada))
      init[d.id] = pendiente > 0 ? String(pendiente) : '0'
    })
    setCantidades(init)
    setMotivo('')
    setFechaDevolucionPrevista('')
  }, [solicitud?.id])

  if (!solicitud) return null

  const lineasMaterial = (solicitud.detalles || []).filter(
    (d) => (d.tipo_item || 'MATERIAL') === 'MATERIAL' && d.producto_id,
  )
  const lineasHerramienta = (solicitud.detalles || []).filter(
    (d) => (d.tipo_item || 'MATERIAL').toUpperCase() === 'HERRAMIENTA' && d.herramienta_id,
  )

  const totalAEntregar = Object.values(cantidades).reduce((acc, v) => acc + (Number(v) || 0), 0)
  const todasLasLineas = [...lineasMaterial, ...lineasHerramienta]
  const algunaEntregaIncompleta = todasLasLineas.some((d) => {
    const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
    const pendienteActual = Math.max(0, baseline - num(d.cantidad_entregada))
    const aEntregar = Number(cantidades[d.id] || 0)
    return aEntregar < pendienteActual
  })

  const handleSubmit = async () => {
    // Almacén SOLO es obligatorio si hay material a entregar.
    const hayMaterial = lineasMaterial.some((d) => Number(cantidades[d.id] || 0) > 0)
    if (hayMaterial && !almacenId) {
      toast.error('Selecciona el almacén de origen')
      return
    }
    const entregas = todasLasLineas
      .map((d) => ({
        detalle_id: d.id,
        cantidad_entregada: Number(cantidades[d.id] || 0),
      }))
      .filter((e) => e.cantidad_entregada > 0)

    if (entregas.length === 0) {
      toast.error('Captura al menos una cantidad mayor a 0')
      return
    }

    const payload = {
      motivo: motivo.trim() || undefined,
      entregas,
    }
    if (hayMaterial) payload.almacen_origen_id = Number(almacenId)
    if (fechaDevolucionPrevista) payload.fecha_devolucion_prevista = fechaDevolucionPrevista

    setSaving(true)
    try {
      const res = await entregarSolicitud(solicitud.id, payload)
      if (res.estatus === 'ENTREGADA') {
        toast.success(`Solicitud #${solicitud.id} entregada completa`)
      } else {
        toast.success(`Entrega parcial registrada (solicitud #${solicitud.id} sigue APROBADA)`)
      }
      onDone?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo registrar la entrega'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!solicitud}
      onClose={onClose}
      title={`Entregar solicitud #${solicitud.id}`}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={saving || totalAEntregar <= 0}>
            <PackageCheck size={16} className="mr-1.5" />
            Registrar entrega
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Captura cuánto se entrega de cada línea ahora. El sistema crea una SALIDA por cada cantidad &gt; 0,
          descuenta stock del almacén seleccionado y libera la reserva correspondiente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lineasMaterial.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
                Almacén de origen
              </label>
              <Select value={almacenId} onChange={(e) => setAlmacenId(e.target.value)}>
                <option value="">Selecciona…</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </Select>
            </div>
          )}
          {lineasHerramienta.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
                Devolución prevista (herramientas)
              </label>
              <input
                type="datetime-local"
                value={fechaDevolucionPrevista}
                onChange={(e) => setFechaDevolucionPrevista(e.target.value)}
                className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          )}
          <div className={lineasMaterial.length > 0 && lineasHerramienta.length > 0 ? 'sm:col-span-2' : ''}>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={250}
              placeholder={`Entrega solicitud #${solicitud.id}`}
              className="block w-full h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
        </div>

        {lineasMaterial.length > 0 && (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <div className="bg-indigo-50/60 dark:bg-indigo-900/10 px-3 py-1.5 text-[11px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Materiales
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Ítem</th>
                  <th className="text-right px-2 py-2">Aprobada</th>
                  <th className="text-right px-2 py-2">Ya entregada</th>
                  <th className="text-right px-2 py-2">Pendiente</th>
                  <th className="text-right px-2 py-2 w-28">Entregar ahora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {lineasMaterial.map((d) => {
                  const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
                  const yaEnt = num(d.cantidad_entregada)
                  const pendiente = Math.max(0, baseline - yaEnt)
                  const valor = cantidades[d.id] ?? ''
                  const numVal = Number(valor) || 0
                  const excede = numVal > pendiente
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-900 dark:text-ink-100">{d.producto_descripcion}</p>
                        <p className="text-xs text-ink-500">{d.producto_codigo} · {d.producto_unidad}</p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{baseline}</td>
                      <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{yaEnt}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>
                        {pendiente}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={pendiente}
                          step="0.01"
                          value={valor}
                          onChange={(e) => setCantidades((s) => ({ ...s, [d.id]: e.target.value }))}
                          disabled={pendiente <= 0}
                          className={`w-24 px-2 py-1 rounded border text-right text-sm ${
                            excede
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {lineasHerramienta.length > 0 && (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <div className="bg-amber-50/60 dark:bg-amber-900/10 px-3 py-1.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
              Herramientas — se asignan al trabajador del solicitante
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Ítem</th>
                  <th className="text-right px-2 py-2">Aprobada</th>
                  <th className="text-right px-2 py-2">Ya entregada</th>
                  <th className="text-right px-2 py-2">Pendiente</th>
                  <th className="text-right px-2 py-2 w-28">Unidades a entregar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {lineasHerramienta.map((d) => {
                  const baseline = num(d.cantidad_aprobada) > 0 ? num(d.cantidad_aprobada) : num(d.cantidad_solicitada)
                  const yaEnt = num(d.cantidad_entregada)
                  const pendiente = Math.max(0, baseline - yaEnt)
                  const valor = cantidades[d.id] ?? ''
                  const numVal = Number(valor) || 0
                  const excede = numVal > pendiente
                  const decimal = numVal !== Math.floor(numVal)
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-900 dark:text-ink-100">{d.item_descripcion || d.producto_descripcion}</p>
                        <p className="text-xs text-ink-500">{d.item_codigo || d.producto_codigo} · {d.item_unidad || 'pieza'}</p>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{baseline}</td>
                      <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-300">{yaEnt}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${pendiente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-400'}`}>
                        {pendiente}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={pendiente}
                          step={1}
                          value={valor}
                          onChange={(e) => setCantidades((s) => ({ ...s, [d.id]: e.target.value }))}
                          disabled={pendiente <= 0}
                          className={`w-24 px-2 py-1 rounded border text-right text-sm ${
                            excede || decimal
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {algunaEntregaIncompleta && totalAEntregar > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>Vas a registrar una <strong>entrega parcial</strong>. La solicitud queda en APROBADA y podrás entregar el resto después.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
