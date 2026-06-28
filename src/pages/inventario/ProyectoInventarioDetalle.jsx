import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FolderOpen, ArrowLeft, Save, Plus, Trash2, RefreshCw, AlertTriangle,
  History, PlusCircle, PencilLine, MinusCircle, User as UserIcon,
  ClipboardList, FileText, Package, Wrench, ChevronRight,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Skeleton, EmptyState, Modal, InfoTip,
  Table, THead, TH, TBody, TR, TD, Badge,
} from '../../components/ui'
import ProductoPicker from '../../components/ProductoPicker'
import {
  getProyectoMaterialDetalle, guardarPlanMateriales, getProyectoPlanHistorial,
  getProyectoPedidos, imprimirSolicitud,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'
import { useResource } from '../../hooks/useResource'

const money = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const num = (v) =>
  (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

// Unidades contables: no admiten fracciones (no se planean 2.5 piezas). El
// resto (kg, m, l…) sí. Mantener en sintonía con `_UNIDADES_ENTERAS` del backend
// (proyectos_materiales.py).
const ENTERO_UNIDS = new Set([
  'pza', 'pz', 'pieza', 'piezas', 'pieza(s)',
  'unidad', 'unidades', 'u', 'und', 'uds', 'caja', 'cajas',
])
const esUnidadEntera = (u) => ENTERO_UNIDS.has((u || '').trim().toLowerCase())

// ¿El plan editable difiere de lo guardado? (líneas nuevas, modificadas o quitadas)
function planArrayHasChanges(plan, guardado) {
  const ids = new Set([...Object.keys(plan), ...Object.keys(guardado)])
  for (const id of ids) {
    const a = plan[id]
    const b = guardado[id]
    if (!a || !b) return true  // agregada o quitada
    if (Number(a.cantidad_planeada) !== Number(b.cantidad_planeada)) return true
    if ((a.notas || '') !== (b.notas || '')) return true
  }
  return false
}

export default function ProyectoInventarioDetalle() {
  const { id } = useParams()
  const proyectoId = Number(id)

  const { data: detalle, loading, error, refetch } = useResource(
    ['proyecto-material', proyectoId],
    () => getProyectoMaterialDetalle(proyectoId),
    {
      staleMs: 30_000,
      invalidateOn: [
        'proyecto_material:changed', 'solicitud:changed',
        'movimiento:changed', 'producto:changed',
      ],
    },
  )

  const { data: rawHistorial } = useResource(
    ['proyecto-plan-historial', proyectoId],
    () => getProyectoPlanHistorial(proyectoId),
    { staleMs: 30_000, invalidateOn: ['proyecto_material:changed'] },
  )
  const historial = rawHistorial ?? []

  const { data: rawPedidos } = useResource(
    ['proyecto-pedidos', proyectoId],
    () => getProyectoPedidos(proyectoId),
    { staleMs: 30_000, invalidateOn: ['solicitud:changed'] },
  )
  const pedidos = rawPedidos ?? []

  useEffect(() => {
    if (error) toast.error(extractApiError(error, 'Error al cargar el proyecto'))
  }, [error])

  // Estado editable del plan: { producto_id -> { producto_id, codigo, descripcion,
  // unidad, precio_unitario, cantidad_planeada, notas } }. Se siembra desde las
  // líneas que están en el plan (en_plan === true) cada vez que llega el detalle.
  const [plan, setPlan] = useState({})
  // Snapshot del plan tal como está GUARDADO, para detectar qué líneas son
  // nuevas o modificadas respecto a lo persistido. { producto_id -> {cantidad, notas} }
  const [planGuardado, setPlanGuardado] = useState({})
  const [guardando, setGuardando] = useState(false)
  // El plan arranca en modo lectura; se entra a edición con el botón "Editar".
  const [editando, setEditando] = useState(false)
  // Pestaña activa, para no apilar todo en una sola página.
  const [tab, setTab] = useState('plan')

  // Siembra el estado editable y el snapshot guardado desde el detalle.
  const seedPlan = useCallback((det) => {
    const next = {}
    const base = {}
    for (const m of det.materiales) {
      if (!m.en_plan) continue
      next[m.producto_id] = {
        producto_id: m.producto_id,
        codigo: m.codigo,
        descripcion: m.descripcion,
        imagen_url: m.imagen_url || null,
        unidad: m.unidad,
        precio_unitario: m.precio_unitario,
        cantidad_planeada: String(m.cantidad_planeada ?? 0),
        notas: m.notas || '',
      }
      base[m.producto_id] = {
        cantidad_planeada: String(m.cantidad_planeada ?? 0),
        notas: m.notas || '',
      }
    }
    setPlan(next)
    setPlanGuardado(base)
  }, [])

  useEffect(() => {
    if (detalle) seedPlan(detalle)
  }, [detalle, seedPlan])

  // Estado de cada línea vs. lo guardado: 'nuevo' (no estaba), 'modificado'
  // (cambió cantidad o notas) o null (sin cambios). Base de los badges.
  const estadoLinea = (l) => {
    const orig = planGuardado[l.producto_id]
    if (!orig) return 'nuevo'
    const cantCambio = Number(orig.cantidad_planeada) !== Number(l.cantidad_planeada)
    const notasCambio = (orig.notas || '') !== (l.notas || '')
    return cantCambio || notasCambio ? 'modificado' : null
  }
  const hayCambios = planArrayHasChanges(plan, planGuardado)

  const planArray = useMemo(
    () => Object.values(plan).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')),
    [plan],
  )

  const agregarProducto = (p) => {
    setPlan((prev) => {
      if (prev[p.id]) {
        toast('Ese material ya está en el plan')
        return prev
      }
      return {
        ...prev,
        [p.id]: {
          producto_id: p.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          imagen_url: p.imagen_url || null,
          unidad: p.unidad,
          precio_unitario: p.precio_unitario ?? 0,
          cantidad_planeada: '1',
          notas: '',
        },
      }
    })
  }

  const setCampo = (pid, campo, valor) => {
    setPlan((prev) => ({ ...prev, [pid]: { ...prev[pid], [campo]: valor } }))
  }

  const quitar = (pid) => {
    setPlan((prev) => {
      const next = { ...prev }
      delete next[pid]
      return next
    })
  }

  const guardar = async () => {
    // Las unidades contables (pza, caja…) no admiten decimales.
    const invalida = planArray.find(
      (l) => esUnidadEntera(l.unidad) && !Number.isInteger(Number(l.cantidad_planeada)),
    )
    if (invalida) {
      toast.error(`"${invalida.codigo}" se mide en ${invalida.unidad}: usa una cantidad entera (sin decimales).`)
      return
    }
    const lineas = planArray.map((l) => ({
      producto_id: l.producto_id,
      cantidad_planeada: Number(l.cantidad_planeada) || 0,
      notas: l.notas?.trim() || null,
    }))
    setGuardando(true)
    try {
      await guardarPlanMateriales(proyectoId, lineas)
      toast.success('Plan de materiales guardado')
      setEditando(false)
      refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar el plan'))
    } finally {
      setGuardando(false)
    }
  }

  // Cancelar: descarta los cambios sin guardar y vuelve a modo lectura.
  const cancelar = () => {
    if (detalle) seedPlan(detalle)
    setEditando(false)
  }

  // Pedido seleccionado para ver en modal (pedidos grandes no caben inline).
  const [pedidoSel, setPedidoSel] = useState(null)

  // Abre el PDF de un pedido en otra pestaña (descarga con auth vía blob).
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const abrirPdf = async (solId) => {
    setPdfLoadingId(solId)
    try {
      await imprimirSolicitud(solId)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo abrir el PDF'))
    } finally {
      setPdfLoadingId(null)
    }
  }

  const costoPlanEditado = useMemo(
    () => planArray.reduce((acc, l) => acc + (Number(l.cantidad_planeada) || 0) * (Number(l.precio_unitario) || 0), 0),
    [planArray],
  )

  if (loading && !detalle) {
    return <Skeleton className="h-96 rounded-xl" />
  }
  if (!detalle) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Proyecto no encontrado"
        description="No se pudo cargar la información de este proyecto."
      />
    )
  }

  const { proyecto, materiales, totales } = detalle

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        title={`${proyecto.numero_proyecto} — materiales`}
        description={proyecto.nombre || 'Plan de materiales, consumo y costos del proyecto.'}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/inventario/proyectos">
              <Button variant="ghost" leftIcon={<ArrowLeft size={14} />}>Volver</Button>
            </Link>
            <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={() => refetch()}>
              Actualizar
            </Button>
          </div>
        }
      />

      {/* KPIs del proyecto */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        <KpiCard label="Cant. planeada" value={num(totales.cantidad_planeada)} />
        <KpiCard label="Cant. consumida" value={num(totales.cantidad_consumida)} bold />
        <KpiCard label="Costo planeado" value={money(totales.costo_planeado)} />
        <KpiCard
          label="Costo consumido"
          value={money(totales.costo_consumido)}
          bold
          tone={totales.sobre_presupuesto ? 'rose' : 'emerald'}
          hint={totales.porcentaje_consumido !== null ? `${num(totales.porcentaje_consumido)}% del plan` : null}
        />
      </div>

      {totales.sobre_presupuesto && (
        <Card className="p-3 mb-4 flex items-center gap-2 ring-2 ring-rose-500/30 bg-rose-50/40 dark:bg-rose-900/10">
          <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
          <span className="text-sm text-rose-700 dark:text-rose-300">
            Este proyecto consumió <strong>más material del planeado</strong>.
          </span>
        </Card>
      )}

      {/* ── Pestañas ── */}
      <div className="flex flex-wrap gap-1 border-b border-ink-200 dark:border-ink-800 mb-4">
        {[
          { id: 'plan', label: 'Plan', icon: FolderOpen },
          { id: 'consumo', label: 'Seguimiento', icon: Package },
          { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, count: pedidos.length },
          { id: 'historial', label: 'Historial', icon: History, count: historial.length },
        ].map((t) => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                activo
                  ? 'border-brand-400 text-ink-900 dark:text-white font-medium'
                  : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
              }`}
            >
              <Icon size={14} /> {t.label}
              {t.count > 0 && <Badge tone={activo ? 'brand' : 'neutral'} className="ml-0.5">{t.count}</Badge>}
            </button>
          )
        })}
      </div>

      {/* ── Plan: editor de materiales ── */}
      {tab === 'plan' && (
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-700 dark:text-ink-200 flex items-center gap-1.5">
              Plan de materiales
              <InfoTip text="Toca “Editar plan”, agrega materiales con el buscador, escribe la cantidad planeada y guarda. Es el presupuesto base contra el que se mide el consumo." />
            </h3>
            <p className="text-xs text-ink-500">Define qué materiales y cuánto se planean usar. Es la base del % de avance.</p>
          </div>
          <div className="flex items-center gap-2">
            {editando && hayCambios && (
              <Badge tone="warning" className="whitespace-nowrap">Cambios sin guardar</Badge>
            )}
            {!editando ? (
              <Button variant="secondary" leftIcon={<PencilLine size={14} />} onClick={() => setEditando(true)}>
                Editar plan
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={cancelar} disabled={guardando}>
                  Cancelar
                </Button>
                <Button variant="primary" leftIcon={<Save size={14} />} onClick={guardar} disabled={guardando || !hayCambios}>
                  {guardando ? 'Guardando…' : 'Guardar plan'}
                </Button>
              </>
            )}
          </div>
        </div>

        {editando && (
          <div className="max-w-xl mb-3">
            <ProductoPicker
              label="Agregar material al plan"
              placeholder="Busca por código o descripción…"
              value={null}
              excludeIds={Object.keys(plan).map(Number)}
              onSelect={agregarProducto}
            />
          </div>
        )}

        {planArray.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Plan vacío"
            description={editando
              ? 'Agrega materiales con el buscador de arriba y guarda.'
              : 'Aún no hay materiales en el plan. Toca "Editar plan" para capturarlo.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TH>Código</TH>
                <TH><span className="sr-only">Imagen</span></TH>
                <TH>Descripción</TH>
                <TH align="right">Precio</TH>
                <TH align="right">Cant. planeada</TH>
                <TH align="right">Costo</TH>
                <TH>Notas</TH>
                <TH align="right"></TH>
              </THead>
              <TBody>
                {planArray.map((l) => {
                  const estado = estadoLinea(l)
                  return (
                  <TR key={l.producto_id} className={estado === 'nuevo' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : estado === 'modificado' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                    <TD className="font-mono text-xs">{l.codigo}</TD>
                    <TD>
                      <ProductoThumb src={l.imagen_url} alt={l.descripcion} />
                    </TD>
                    <TD className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{l.descripcion}</span>
                        {estado === 'nuevo' && <Badge tone="success">Nuevo</Badge>}
                        {estado === 'modificado' && <Badge tone="warning">Modificado</Badge>}
                      </div>
                    </TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">{money(l.precio_unitario)}</TD>
                    <TD align="right" style={{ width: 130 }}>
                      {editando ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step={esUnidadEntera(l.unidad) ? 1 : '0.01'}
                            value={l.cantidad_planeada}
                            onChange={(e) => setCampo(l.producto_id, 'cantidad_planeada', e.target.value)}
                            className="w-20 text-right font-mono tabular-nums rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm"
                          />
                          <span className="text-[10px] text-ink-400 w-8 text-left">{l.unidad}</span>
                        </div>
                      ) : (
                        <span className="font-mono tabular-nums">
                          {num(l.cantidad_planeada)} <span className="text-[10px] text-ink-400">{l.unidad}</span>
                        </span>
                      )}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">
                      {money((Number(l.cantidad_planeada) || 0) * (Number(l.precio_unitario) || 0))}
                    </TD>
                    <TD style={{ minWidth: 160 }}>
                      {editando ? (
                        <input
                          type="text"
                          value={l.notas}
                          onChange={(e) => setCampo(l.producto_id, 'notas', e.target.value)}
                          placeholder="Opcional"
                          className="w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-xs text-ink-600 dark:text-ink-300">{l.notas || <span className="text-ink-400">—</span>}</span>
                      )}
                    </TD>
                    <TD align="right">
                      {editando && (
                        <Button variant="ghost" size="icon-sm" title="Quitar" onClick={() => quitar(l.producto_id)}>
                          <Trash2 size={14} className="text-rose-500" />
                        </Button>
                      )}
                    </TD>
                  </TR>
                  )
                })}
              </TBody>
            </Table>
            <div className="text-right text-xs text-ink-500 mt-2 pr-2">
              {editando ? 'Costo total planeado (sin guardar): ' : 'Costo total planeado: '}
              <strong className="font-mono">{money(costoPlanEditado)}</strong>
            </div>
          </div>
        )}
      </Card>
      )}

      {/* ── Seguimiento: planeado vs. consumido ── */}
      {tab === 'consumo' && (
      <>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-700 dark:text-ink-200 mb-2 flex items-center gap-1.5">
        Seguimiento de consumo
        <InfoTip text="El consumo se calcula solo: suma lo ENTREGADO en las solicitudes ligadas a este proyecto. Compara planeado vs. real; en rojo cuando se pasa del plan." />
      </h3>
      {materiales.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin movimiento de materiales"
          description="Cuando se entreguen solicitudes de este proyecto, aquí verás el consumo real."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TH>Código</TH>
              <TH><span className="sr-only">Imagen</span></TH>
              <TH>Descripción</TH>
              <TH align="right">Planeado</TH>
              <TH align="right">Consumido</TH>
              <TH align="right">%</TH>
              <TH align="right">Diferencia</TH>
              <TH align="right">Costo planeado</TH>
              <TH align="right">Costo consumido</TH>
            </THead>
            <TBody>
              {materiales.map((m) => {
                const sobre = m.diferencia > 0 && m.cantidad_planeada > 0
                return (
                  <TR key={m.producto_id || m.codigo}>
                    <TD className="font-mono text-xs">{m.codigo}</TD>
                    <TD>
                      <ProductoThumb src={m.imagen_url} alt={m.descripcion} />
                    </TD>
                    <TD className="font-medium">
                      {m.descripcion}
                      {!m.en_plan && <Badge tone="warning" className="ml-2">fuera de plan</Badge>}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums">{num(m.cantidad_planeada)} <span className="text-[10px] text-ink-400">{m.unidad}</span></TD>
                    <TD align="right" className="font-mono tabular-nums font-bold">{num(m.cantidad_consumida)}</TD>
                    <TD align="right" className="font-mono tabular-nums">
                      {m.porcentaje_consumido === null ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <span className={sobre ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                          {num(m.porcentaje_consumido)}%
                        </span>
                      )}
                    </TD>
                    <TD align="right" className={`font-mono tabular-nums font-bold ${m.diferencia > 0 ? 'text-rose-600 dark:text-rose-400' : m.diferencia < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}>
                      {m.diferencia > 0 ? '+' : ''}{num(m.diferencia)}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">{money(m.costo_planeado)}</TD>
                    <TD align="right" className="font-mono tabular-nums font-bold">{money(m.costo_consumido)}</TD>
                  </TR>
                )
              })}
              <TR className="bg-ink-50/70 dark:bg-ink-800/50 font-bold">
                <TD colSpan={3} className="text-right uppercase text-xs tracking-wide">Totales</TD>
                <TD align="right" className="font-mono tabular-nums">{num(totales.cantidad_planeada)}</TD>
                <TD align="right" className="font-mono tabular-nums">{num(totales.cantidad_consumida)}</TD>
                <TD align="right" className="font-mono tabular-nums">
                  {totales.porcentaje_consumido === null ? '—' : `${num(totales.porcentaje_consumido)}%`}
                </TD>
                <TD />
                <TD align="right" className="font-mono tabular-nums">{money(totales.costo_planeado)}</TD>
                <TD align="right" className="font-mono tabular-nums">{money(totales.costo_consumido)}</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
      )}
      </>
      )}

      {/* ── Pedidos (solicitudes) del proyecto ── */}
      {tab === 'pedidos' && (
      <>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-700 dark:text-ink-200 mb-2 flex items-center gap-2">
        <ClipboardList size={15} /> Pedidos del proyecto
        {pedidos.length > 0 && <Badge tone="neutral">{pedidos.length}</Badge>}
        <InfoTip text="Son las solicitudes de material ligadas a este proyecto. Toca “Ver pedido” para ver el detalle completo y descargar su PDF." />
      </h3>
      {pedidos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin pedidos"
          description="Aquí aparecerán las solicitudes de material ligadas a este proyecto, con su detalle y su PDF."
        />
      ) : (
        <Card className="overflow-hidden divide-y divide-ink-100 dark:divide-ink-800">
          {pedidos.map((s) => (
            <PedidoRow key={s.id} s={s} onVer={() => setPedidoSel(s)} />
          ))}
        </Card>
      )}
      </>
      )}

      {/* ── Historial de cambios del plan ── */}
      {tab === 'historial' && (
      <>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-700 dark:text-ink-200 mb-2 flex items-center gap-2">
        <History size={15} /> Historial de cambios
        <InfoTip text="Cada vez que se guarda el plan queda registrado quién, cuándo y qué cambió (agregado, modificado o quitado), incluso los cambios de notas." />
      </h3>
      {historial.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin historial"
          description="Cada vez que guardes cambios en el plan, quedarán registrados aquí: quién, cuándo y qué cambió."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <ol className="divide-y divide-ink-100 dark:divide-ink-800">
            {historial.map((h) => (
              <HistorialItem key={h.id} h={h} />
            ))}
          </ol>
        </Card>
      )}
      </>
      )}

      {/* Modal de detalle de un pedido */}
      <Modal
        open={!!pedidoSel}
        onClose={() => setPedidoSel(null)}
        size="xl"
        title={pedidoSel ? `Pedido #${pedidoSel.id}` : ''}
        description={pedidoSel ? `${pedidoSel.solicitante_nombre} · ${pedidoSel.detalles?.length || 0} ítem(s)` : ''}
        footer={pedidoSel && (
          <>
            <Button variant="ghost" onClick={() => setPedidoSel(null)}>Cerrar</Button>
            <Button
              variant="primary" leftIcon={<FileText size={14} />}
              onClick={() => abrirPdf(pedidoSel.id)} loading={pdfLoadingId === pedidoSel.id}
            >
              Ver PDF
            </Button>
          </>
        )}
      >
        {pedidoSel && <PedidoDetalle s={pedidoSel} />}
      </Modal>
    </div>
  )
}

// Miniatura del producto: imagen si hay, placeholder neutro si no.
function ProductoThumb({ src, alt }) {
  if (src) {
    return <img src={src} alt={alt || ''} className="w-10 h-10 rounded-md object-cover bg-ink-100 dark:bg-ink-800" />
  }
  return (
    <div className="w-10 h-10 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400">
      <Package size={18} />
    </div>
  )
}

const ESTATUS_TONO = {
  PENDIENTE: 'warning',
  APROBADA: 'info',
  ENTREGADA: 'success',
  RECHAZADA: 'danger',
}

function _fechaCorta(iso) {
  return iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

// Fila compacta de un pedido en la lista: folio, estatus, solicitante, fecha,
// nº de ítems y botón "Ver pedido" (abre el modal con el detalle completo).
function PedidoRow({ s, onVer }) {
  const nItems = s.detalles?.length || 0
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors">
      <span className="font-mono font-bold text-sm text-brand-700 dark:text-brand-300">#{s.id}</span>
      <Badge tone={ESTATUS_TONO[s.estatus] || 'neutral'}>{s.estatus}</Badge>
      <span className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-ink-300">
        <UserIcon size={12} className="text-ink-400" /> {s.solicitante_nombre}
      </span>
      <span className="text-xs text-ink-400">{_fechaCorta(s.fecha_creacion)}</span>
      <Badge tone="neutral" className="gap-1"><Package size={11} /> {nItems} ítem{nItems === 1 ? '' : 's'}</Badge>
      <Button variant="secondary" size="sm" className="ml-auto" rightIcon={<ChevronRight size={14} />} onClick={onVer}>
        Ver pedido
      </Button>
    </div>
  )
}

// Contenido del modal de un pedido: cabecera, notas y la tabla de ítems con
// miniaturas y las tres cantidades.
function PedidoDetalle({ s }) {
  const detalles = s.detalles || []
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
        <Badge tone={ESTATUS_TONO[s.estatus] || 'neutral'}>{s.estatus}</Badge>
        <span className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-ink-300">
          <UserIcon size={12} className="text-ink-400" /> {s.solicitante_nombre}
        </span>
        <span className="text-xs text-ink-400">{_fechaCorta(s.fecha_creacion)}</span>
      </div>

      {s.notas && (
        <div className="mb-3 rounded-lg bg-ink-50 dark:bg-ink-800/50 px-3 py-2 text-xs text-ink-600 dark:text-ink-300">
          <span className="font-semibold text-ink-500">Notas:</span> {s.notas}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-ink-100 dark:border-ink-800">
        <Table>
          <THead>
            <TH><span className="sr-only">Imagen</span></TH>
            <TH>Código</TH>
            <TH>Descripción</TH>
            <TH align="right">Solicitada</TH>
            <TH align="right">Aprobada</TH>
            <TH align="right">Entregada</TH>
          </THead>
          <TBody>
            {detalles.map((d) => {
              const esHerr = d.tipo_item === 'HERRAMIENTA'
              return (
                <TR key={d.id}>
                  <TD>
                    {esHerr ? (
                      <div className="w-10 h-10 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400">
                        <Wrench size={18} />
                      </div>
                    ) : (
                      <ProductoThumb src={d.imagen_url} alt={d.item_descripcion} />
                    )}
                  </TD>
                  <TD className="font-mono text-xs">{d.item_codigo}</TD>
                  <TD className="font-medium">{d.item_descripcion}</TD>
                  <TD align="right" className="font-mono tabular-nums">{num(d.cantidad_solicitada)} <span className="text-[10px] text-ink-400">{d.item_unidad}</span></TD>
                  <TD align="right" className="font-mono tabular-nums">{num(d.cantidad_aprobada)}</TD>
                  <TD align="right" className="font-mono tabular-nums font-bold">{num(d.cantidad_entregada)}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      </div>
    </div>
  )
}

// Una entrada del historial: encabezado (usuario + fecha + conteos) y el
// desglose de líneas agregadas / modificadas / eliminadas.
function HistorialItem({ h }) {
  const fecha = h.created_at
    ? new Date(h.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'
  const c = h.cambios || {}
  const agregados = c.agregados || []
  const modificados = c.modificados || []
  const eliminados = c.eliminados || []
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-200">
          <UserIcon size={13} className="text-ink-400" /> {h.usuario}
        </span>
        <span className="text-xs text-ink-400">{fecha}</span>
        <div className="flex items-center gap-1.5 ml-auto">
          {h.n_agregados > 0 && <Badge tone="success">+{h.n_agregados}</Badge>}
          {h.n_modificados > 0 && <Badge tone="warning">~{h.n_modificados}</Badge>}
          {h.n_eliminados > 0 && <Badge tone="danger">−{h.n_eliminados}</Badge>}
        </div>
      </div>
      <div className="space-y-1 pl-1">
        {agregados.map((a, i) => (
          <div key={`a${i}`} className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <PlusCircle size={13} className="shrink-0" />
            <span className="font-mono">{a.codigo}</span>
            <span className="text-ink-500 truncate">{a.descripcion}</span>
            <span className="ml-auto font-mono tabular-nums font-bold">{num(a.cantidad)}</span>
          </div>
        ))}
        {modificados.map((m, i) => {
          const cantCambio = m.antes !== undefined
          const notasCambio = m.notas_antes !== undefined
          return (
            <div key={`m${i}`} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <PencilLine size={13} className="shrink-0 mt-0.5" />
              <span className="font-mono">{m.codigo}</span>
              <span className="text-ink-500 truncate">{m.descripcion}</span>
              <div className="ml-auto flex flex-col items-end gap-0.5">
                {cantCambio && (
                  <span className="font-mono tabular-nums">
                    {num(m.antes)} <span className="text-ink-400">→</span> <span className="font-bold">{num(m.despues)}</span>
                  </span>
                )}
                {notasCambio && (
                  <span className="text-[11px] text-ink-500 italic max-w-[260px] truncate" title={`${m.notas_antes || '(vacío)'} → ${m.notas_despues || '(vacío)'}`}>
                    notas: {m.notas_antes ? `"${m.notas_antes}"` : '(vacío)'} <span className="text-ink-400">→</span> {m.notas_despues ? `"${m.notas_despues}"` : '(vacío)'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {eliminados.map((e, i) => (
          <div key={`e${i}`} className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
            <MinusCircle size={13} className="shrink-0" />
            <span className="font-mono line-through">{e.codigo}</span>
            <span className="text-ink-500 truncate line-through">{e.descripcion}</span>
          </div>
        ))}
      </div>
    </li>
  )
}

const KPI_TONES = {
  emerald: 'text-emerald-700 dark:text-emerald-300',
  rose: 'text-rose-700 dark:text-rose-300',
  ink: 'text-ink-900 dark:text-ink-100',
}

function KpiCard({ label, value, bold, tone = 'ink', hint }) {
  return (
    <Card className="px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`${bold ? 'text-xl font-extrabold' : 'text-lg font-bold'} leading-tight ${KPI_TONES[tone] || KPI_TONES.ink}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-ink-400 mt-0.5">{hint}</div>}
    </Card>
  )
}
