import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Wrench, ArrowLeft, QrCode, Camera, History, Settings2,
  AlertTriangle, ImagePlus, UserCheck, ChevronRight, FileText,
  HardHat, Send, Ban,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Badge, Skeleton, Input, Select, AuthImage, ImageViewer, InfoTip,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import {
  getUnidad, getEventosUnidad, authFotoPath, authQrPath,
  subirFotoUnidad, devolverAsignacion, crearMantenimiento,
  crearIncidencia, crearSolicitudBaja, darBajaDirecta,
  getMantenimientos, getIncidencias, getSolicitudesBaja,
} from '../../api/herramientas'
import { extractApiError } from '../../utils/apiError'
import { subirConProgreso } from '../../utils/subida'
import {
  ESTADO_LABEL, ESTADO_TONE, TIPO_EVENTO_LABEL, formatDateTime,
  TIPO_INCIDENCIA, TIPO_INCIDENCIA_LABEL, TIPO_MANTENIMIENTO, CONDICION,
} from './herramientasShared'

const TABS = ['general', 'timeline', 'mantenimientos', 'incidencias', 'bajas', 'fotos']
const TAB_LABEL = {
  general: 'General',
  timeline: 'Línea de tiempo',
  mantenimientos: 'Mantenimientos',
  incidencias: 'Incidencias',
  bajas: 'Solicitudes de baja',
  fotos: 'Fotos / evidencia',
}

export default function HerramientaUnidadFicha() {
  const { id } = useParams()
  const { user } = useAuth()
  const esInventario = ['inventario', 'admin', 'super_admin'].includes(user?.role)
  // El coordinador solo necesita lo indispensable para identificar la herramienta
  // y solicitar su baja: nada de costos, vida útil, ubicación ni bitácoras.
  const esCoordinador = user?.role === 'coordinador'

  // Pestañas visibles según rol. El coordinador solo ve General y sus bajas.
  const tabs = esCoordinador ? ['general', 'bajas'] : TABS

  const [unidad, setUnidad] = useState(null)
  const [eventos, setEventos] = useState([])
  const [mants, setMants] = useState([])
  const [incs, setIncs] = useState([])
  const [bajas, setBajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('general')

  const [modal, setModal] = useState(null)  // 'devolver' | 'mant' | 'inc' | 'baja' | 'baja-directa'
  const [showQrViewer, setShowQrViewer] = useState(false)
  const [busy, setBusy] = useState(false)

  const recarga = useCallback(async () => {
    setLoading(true)
    try {
      // El coordinador solo ve General + sus bajas: omitimos timeline,
      // mantenimientos e incidencias para no hacer peticiones de más.
      const [u, e, m, i, b] = await Promise.all([
        getUnidad(id),
        esCoordinador ? Promise.resolve([]) : getEventosUnidad(id),
        esInventario ? getMantenimientos({ unidad_id: id }) : Promise.resolve([]),
        esCoordinador ? Promise.resolve([]) : getIncidencias({ unidad_id: id }),
        getSolicitudesBaja({ unidad_id: id }).catch(() => []),
      ])
      setUnidad(u)
      setEventos(e)
      setMants(m)
      setIncs(i)
      setBajas(b)
    } catch (err) {
      toast.error(extractApiError(err, 'Error cargando ficha'))
    } finally {
      setLoading(false)
    }
  }, [id, esInventario, esCoordinador])

  useEffect(() => { recarga() }, [recarga])

  if (loading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>
  if (!unidad) return <div className="p-6">Unidad no encontrada</div>

  const asig = unidad.asignacion_activa
  const fotoPrincipal = (unidad.fotos || []).find((f) => f.tipo === 'FOTO_HERRAMIENTA')

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
        <Link to="/inventario/herramientas/unidades" className="hover:text-ink-900 dark:hover:text-white inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Unidades
        </Link>
        <ChevronRight size={12} />
        <span className="font-mono">{unidad.codigo_interno}</span>
      </div>

      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">
          {unidad.herramienta?.descripcion || 'Herramienta'}
          <InfoTip text="Ficha de una unidad física. Desde aquí se asigna, se manda a mantenimiento, se reportan incidencias o se solicita/ejecuta su baja, según tu rol." />
        </span>}
        description={`SKU ${unidad.herramienta?.sku} · ${unidad.herramienta?.marca || ''} ${unidad.herramienta?.modelo || ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={ESTADO_TONE[unidad.estado]} dot className="text-sm px-3 py-1">
              {ESTADO_LABEL[unidad.estado]}
            </Badge>
            {esInventario && unidad.estado === 'ASIGNADA' && asig && (
              <Button size="sm" onClick={() => setModal('devolver')} title="Registrar que el trabajador devolvió esta unidad">
                <UserCheck size={14} className="mr-1" /> Recibir devolución
              </Button>
            )}
            {esInventario && ['DISPONIBLE', 'ASIGNADA', 'DAÑADA'].includes(unidad.estado) && (
              <Button size="sm" variant="ghost" onClick={() => setModal('mant')} title="Mandar esta unidad a mantenimiento (quedará EN_MANTENIMIENTO)">
                <Settings2 size={14} className="mr-1" /> Enviar a mantenimiento
              </Button>
            )}
            {(['solicitante_material', 'inventario', 'admin', 'super_admin'].includes(user?.role)) && (
              <Button size="sm" variant="ghost" onClick={() => setModal('inc')} title="Reportar una incidencia (daño, extravío, etc.) de esta unidad">
                <AlertTriangle size={14} className="mr-1" /> Reportar incidencia
              </Button>
            )}
            {unidad.estado !== 'DADA_DE_BAJA' && (
              esInventario ? (
                <Button size="sm" variant="ghost" onClick={() => setModal('baja-directa')} title="Dar de baja la unidad ahora mismo (autoriza y ejecuta en un paso)">
                  <Ban size={14} className="mr-1" /> Dar de baja
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setModal('baja')} title="Enviar a inventario una solicitud de baja para esta unidad">
                  <Send size={14} className="mr-1" /> Solicitar baja
                </Button>
              )
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-ink-800">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-brand-400 text-ink-900 dark:text-white font-medium'
                : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-1 flex flex-col items-center gap-3">
            {fotoPrincipal ? (
              <AuthImage src={authFotoPath(unidad.id, fotoPrincipal.id)}
                   alt="Herramienta"
                   className="h-56 w-56 rounded-xl object-cover ring-1 ring-ink-200 dark:ring-ink-700" />
            ) : unidad.herramienta?.imagen_url ? (
              <img src={unidad.herramienta.imagen_url} alt=""
                   className="h-56 w-56 rounded-xl object-cover ring-1 ring-ink-200 dark:ring-ink-700" />
            ) : (
              <div className="h-56 w-56 rounded-xl bg-ink-50 dark:bg-ink-800/50 ring-1 ring-ink-200 dark:ring-ink-700 inline-flex items-center justify-center text-ink-400 dark:text-ink-500">
                <Wrench size={64} />
              </div>
            )}
            {esInventario && (
              <FotoUpload unidadId={unidad.id} onUploaded={recarga} />
            )}
            <button type="button" onClick={() => setShowQrViewer(true)}
               className="text-xs text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white inline-flex items-center gap-1.5">
              <QrCode size={14} /> Ver / imprimir QR
            </button>
          </Card>

          <Card className="p-4 lg:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold border-b border-ink-200 dark:border-ink-800 pb-2">
              {esCoordinador ? 'Identificación' : 'Datos físicos'}
            </h3>
            <DataRow k="Código interno" v={<span className="font-mono">{unidad.codigo_interno}</span>} />
            <DataRow k="No. de serie" v={unidad.no_serie || '—'} />
            <DataRow k="Estado" v={ESTADO_LABEL[unidad.estado] || unidad.estado} />
            {!esCoordinador && <>
              <DataRow k="Cantidad" v={unidad.cantidad} />
              <DataRow k="Almacén" v={unidad.almacen_nombre || '—'} />
              <DataRow k="Estante" v={unidad.estante_nombre || '—'} />
              <DataRow k="Complementos" v={unidad.complementos || '—'} />
              <DataRow k="Fecha adquisición" v={unidad.fecha_adquisicion || '—'} />
              <DataRow k="Costo adquisición" v={unidad.costo_adquisicion ? `$${unidad.costo_adquisicion.toLocaleString('es-MX')}` : '—'} />
              <DataRow k="Vida útil" v={unidad.vida_util_meses ? `${unidad.vida_util_meses} meses` : '—'} />
              {unidad.observaciones && (
                <div className="text-sm">
                  <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">Observaciones</div>
                  <div className="whitespace-pre-wrap">{unidad.observaciones}</div>
                </div>
              )}
            </>}

            {asig && (
              <div className="mt-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-sky-700 dark:text-sky-200 mb-2">
                  <HardHat size={16} /> Asignación activa
                </h4>
                <DataRow k="Trabajador" v={asig.trabajador_nombre} />
                <DataRow k="Proyecto" v={asig.proyecto || '—'} />
                <DataRow k="Entrega" v={formatDateTime(asig.fecha_entrega)} />
                <DataRow k="Devolución prevista" v={formatDateTime(asig.fecha_devolucion_prevista)} />
                <DataRow k="Condición entrega" v={asig.condicion_entrega || '—'} />
                {asig.observaciones_entrega && (
                  <DataRow k="Notas" v={asig.observaciones_entrega} />
                )}
              </div>
            )}

            {unidad.estado === 'DADA_DE_BAJA' && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-200">Unidad dada de baja</h4>
                <DataRow k="Fecha" v={formatDateTime(unidad.fecha_baja)} />
                <DataRow k="Motivo" v={unidad.motivo_baja || '—'} />
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'timeline' && <Timeline eventos={eventos} />}
      {tab === 'mantenimientos' && <ListaSimple items={mants} render={(m) => (
        <div className="flex justify-between items-start gap-3">
          <div>
            <Badge tone={m.estado === 'CERRADO' ? 'success' : 'warning'} dot>{m.estado}</Badge>
            <span className="ml-2 text-sm font-medium">{m.tipo}</span>
            <div className="text-xs opacity-70 mt-1">{m.motivo}</div>
            <div className="text-[11px] opacity-50 mt-1">
              {formatDateTime(m.fecha_inicio)}{m.fecha_fin ? ` → ${formatDateTime(m.fecha_fin)}` : ''}
            </div>
          </div>
          {m.costo != null && <div className="text-sm font-mono">${m.costo.toLocaleString('es-MX')}</div>}
        </div>
      )} />}
      {tab === 'incidencias' && <ListaSimple items={incs} render={(i) => (
        <div>
          <Badge tone={i.estado === 'RESUELTA' ? 'success' : i.estado === 'RECHAZADA' ? 'neutral' : 'warning'} dot>{i.estado}</Badge>
          <span className="ml-2 text-sm font-medium">{TIPO_INCIDENCIA_LABEL[i.tipo] || i.tipo}</span>
          <div className="text-xs opacity-70 mt-1">{i.descripcion}</div>
          <div className="text-[11px] opacity-50 mt-1">
            Reportado por {i.reportado_por_username} · {formatDateTime(i.fecha_reporte)}
          </div>
          {i.resolucion && <div className="text-xs mt-2 italic opacity-80">→ {i.resolucion}</div>}
        </div>
      )} />}
      {tab === 'bajas' && <ListaSimple items={bajas} render={(b) => (
        <div>
          <Badge tone={b.estado === 'EJECUTADA' ? 'neutral' : b.estado === 'PENDIENTE' ? 'warning' : b.estado === 'APROBADA' ? 'info' : 'danger'} dot>{b.estado}</Badge>
          <span className="ml-2 text-xs opacity-70">Solicitado por {b.solicitante_username}</span>
          <div className="text-sm mt-1">{b.motivo}</div>
          <div className="text-[11px] opacity-50 mt-1">{formatDateTime(b.fecha_solicitud)}</div>
        </div>
      )} />}
      {tab === 'fotos' && <Galeria unidad={unidad} onChange={recarga} esInventario={esInventario} />}

      {modal === 'devolver' && asig && (
        <ModalDevolucion asig={asig} onClose={() => setModal(null)}
                          onDone={() => { setModal(null); recarga() }} />
      )}
      {modal === 'mant' && (
        <ModalMantenimiento unidadId={unidad.id} onClose={() => setModal(null)}
                             onDone={() => { setModal(null); recarga() }} />
      )}
      {modal === 'inc' && (
        <ModalIncidencia unidadId={unidad.id} onClose={() => setModal(null)}
                          onDone={() => { setModal(null); recarga() }} />
      )}
      {modal === 'baja' && (
        <ModalSolicitudBaja unidadId={unidad.id} onClose={() => setModal(null)}
                             onDone={() => { setModal(null); recarga() }} />
      )}
      {modal === 'baja-directa' && (
        <ModalBajaDirecta unidadId={unidad.id} onClose={() => setModal(null)}
                          onDone={() => { setModal(null); recarga() }} />
      )}
      <ImageViewer 
        open={showQrViewer} 
        authPath={showQrViewer ? authQrPath(unidad.id) : null} 
        onClose={() => setShowQrViewer(false)} 
        alt={`QR ${unidad?.codigo_interno}`} 
      />
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function DataRow({ k, v }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1">
      <span className="text-ink-500 dark:text-ink-400 col-span-1">{k}</span>
      <span className="col-span-2">{v}</span>
    </div>
  )
}

function Timeline({ eventos }) {
  if (eventos.length === 0) {
    return <Card className="p-6 text-center text-ink-500 dark:text-ink-400">Sin eventos registrados</Card>
  }
  return (
    <Card className="p-4">
      <ol className="space-y-3">
        {eventos.map((e) => (
          <li key={e.id} className="flex gap-3 border-b border-ink-200 dark:border-ink-800 pb-3 last:border-0">
            <div className="h-8 w-8 rounded-full bg-brand-500/20 ring-1 ring-brand-400/30 inline-flex items-center justify-center flex-shrink-0">
              <History size={14} className="text-brand-700 dark:text-brand-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <span className="font-medium">{TIPO_EVENTO_LABEL[e.tipo_evento] || e.tipo_evento}</span>
                {e.estado_anterior && e.estado_nuevo && (
                  <span className="ml-2 text-xs text-ink-500 dark:text-ink-400">
                    {ESTADO_LABEL[e.estado_anterior]} → {ESTADO_LABEL[e.estado_nuevo]}
                  </span>
                )}
              </div>
              {e.observaciones && <div className="text-xs text-ink-600 dark:text-ink-300 mt-0.5">{e.observaciones}</div>}
              <div className="text-[11px] text-ink-400 dark:text-ink-500 mt-1">
                {formatDateTime(e.fecha)} · {e.usuario_username}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function ListaSimple({ items, render }) {
  if (!items || items.length === 0) {
    return <Card className="p-6 text-center text-ink-500 dark:text-ink-400">Sin registros</Card>
  }
  return (
    <Card className="p-4 space-y-3">
      {items.map((it) => (
        <div key={it.id} className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800">
          {render(it)}
        </div>
      ))}
    </Card>
  )
}

function FotoUpload({ unidadId, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const handle = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await subirConProgreso(
        (onProgress) => subirFotoUnidad(unidadId, file, { tipo: 'FOTO_HERRAMIENTA' }, onProgress),
        { archivo: file, exito: 'Foto subida' },
      )
      onUploaded?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo subir'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  return (
    <label className="cursor-pointer text-xs text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink-200 dark:border-white/20 hover:bg-ink-100 dark:hover:bg-ink-800">
      <ImagePlus size={14} /> {uploading ? 'Subiendo…' : 'Cambiar foto'}
      <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp"
             onChange={handle} disabled={uploading} />
    </label>
  )
}

function Galeria({ unidad, onChange, esInventario }) {
  const fotos = unidad.fotos || []
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerMedia, setViewerMedia] = useState(null)

  return (
    <Card className="p-4">
      {esInventario && (
        <div className="mb-3"><FotoUpload unidadId={unidad.id} onUploaded={onChange} /></div>
      )}
      {fotos.length === 0 ? (
        <div className="text-center text-ink-500 dark:text-ink-400 py-8">Sin fotos</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fotos.map((f) => (
            <button key={f.id} onClick={() => { setViewerMedia(f); setViewerOpen(true) }}
               className="block aspect-square rounded-lg overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700 hover:ring-brand-400/50 transition cursor-zoom-in">
              <AuthImage src={authFotoPath(unidad.id, f.id)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <ImageViewer 
        open={viewerOpen} 
        authPath={viewerMedia ? authFotoPath(unidad.id, viewerMedia.id) : null} 
        onClose={() => setViewerOpen(false)} 
        alt="Foto" 
      />
    </Card>
  )
}

function ModalDevolucion({ asig, onClose, onDone }) {
  const [cond, setCond] = useState('BUENA')
  const [obs, setObs] = useState('')
  const [nuevoEstado, setNuevoEstado] = useState('DISPONIBLE')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await devolverAsignacion(asig.id, {
        condicion_devolucion: cond,
        observaciones_devolucion: obs || null,
        nuevo_estado_unidad: nuevoEstado,
      })
      toast.success('Devolución registrada')
      onDone()
    } catch (e) {
      toast.error(extractApiError(e, 'No se pudo devolver'))
    } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Recibir devolución">
      <div className="space-y-3">
        <Select label="Condición de devolución" value={cond} onChange={(e) => setCond(e.target.value)}>
          {CONDICION.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select label="Nuevo estado de la unidad" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
          <option value="DISPONIBLE">Disponible</option>
          <option value="DAÑADA">Dañada</option>
          <option value="EXTRAVIADA">Extraviada</option>
        </Select>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Observaciones</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} maxLength={1000}
                    className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar devolución'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalMantenimiento({ unidadId, onClose, onDone }) {
  const [tipo, setTipo] = useState('PREVENTIVO')
  const [motivo, setMotivo] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [costo, setCosto] = useState('')
  const [obs, setObs] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (motivo.trim().length < 3) return toast.error('Motivo requerido')
    setBusy(true)
    try {
      await crearMantenimiento({
        unidad_id: unidadId, tipo, motivo: motivo.trim(),
        proveedor: proveedor.trim() || null,
        costo: costo ? Number(costo) : null,
        observaciones: obs.trim() || null,
      })
      toast.success('Mantenimiento abierto')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Enviar a mantenimiento">
      <div className="space-y-3">
        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPO_MANTENIMIENTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Input label="Motivo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={250} />
        <Input label="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={150} />
        <Input label="Costo estimado" type="number" min={0} step={0.01} value={costo}
               onChange={(e) => setCosto(e.target.value)} />
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Notas</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} maxLength={1000}
                    className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Enviar'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalIncidencia({ unidadId, onClose, onDone }) {
  const [tipo, setTipo] = useState('DAÑO')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (desc.trim().length < 5) return toast.error('Descripción muy corta')
    setBusy(true)
    try {
      await crearIncidencia({ unidad_id: unidadId, tipo, descripcion: desc.trim() })
      toast.success('Incidencia reportada')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Reportar incidencia">
      <div className="space-y-3">
        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPO_INCIDENCIA.map((t) => <option key={t} value={t}>{TIPO_INCIDENCIA_LABEL[t]}</option>)}
        </Select>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Descripción *</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={2000}
                    placeholder="Describe qué pasó, cuándo, dónde…"
                    className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Enviando…' : 'Reportar'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalSolicitudBaja({ unidadId, onClose, onDone }) {
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (motivo.trim().length < 10) return toast.error('Motivo debe tener al menos 10 caracteres')
    setBusy(true)
    try {
      await crearSolicitudBaja({ unidad_id: unidadId, motivo: motivo.trim() })
      toast.success('Solicitud de baja enviada')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Solicitar baja">
      <div className="space-y-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">Tu solicitud será revisada por inventario antes de ejecutarse.</p>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Motivo *</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} maxLength={2000}
                    placeholder="Explica por qué solicitas la baja (mínimo 10 caracteres)…"
                    className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Enviando…' : 'Solicitar'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ModalBajaDirecta({ unidadId, onClose, onDone }) {
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const submit = async () => {
    if (motivo.trim().length < 10) return toast.error('Motivo debe tener al menos 10 caracteres')
    setBusy(true)
    try {
      await darBajaDirecta(unidadId, motivo.trim())
      toast.success('Unidad dada de baja')
      onDone()
    } catch (e) { toast.error(extractApiError(e, 'Error')) }
    finally { setBusy(false); setConfirm(false) }
  }
  return (
    <>
      <Modal open onClose={onClose} title="Dar de baja directamente">
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
            <strong className="inline-flex items-center gap-1 text-red-700 dark:text-red-200"><AlertTriangle size={14} /> Esta acción es irreversible.</strong> La unidad quedará
            marcada como dada de baja y no podrá volver a usarse. Se conservará todo el historial.
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-1 block">Motivo *</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} maxLength={2000}
                      placeholder="Equipo obsoleto, irreparable, robado, etc."
                      className="w-full rounded-md bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-800 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => setConfirm(true)} disabled={motivo.trim().length < 10}>
              Dar de baja
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={submit}
                      title="Confirmar baja"
                      description="Esta acción marcará la unidad como DADA_DE_BAJA. ¿Continuar?"
                      confirmLabel={busy ? 'Procesando…' : 'Sí, dar de baja'} tone="danger" />
    </>
  )
}
