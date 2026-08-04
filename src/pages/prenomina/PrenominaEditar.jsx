import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Lock, CheckCircle2, X, Plus, Minus, AlertCircle,
  Bus, PartyPopper, Wallet, ReceiptText, ChevronDown, ChevronUp,
  FileSpreadsheet, DollarSign,
} from 'lucide-react'
import {
  PageHeader, Button, Badge, Skeleton, ConfirmDialog, EmptyState,
} from '../../components/ui'
import {
  detalleEditor, cerrarSemana,
  eliminarDescuento, eliminarDeposito,
  exportarExcel,
} from '../../api/prenomina'
import AjusteRapidoModal from './AjusteRapidoModal'
import { fmtFecha } from '../../utils/format'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })


function estadoMeta(estado) {
  if (estado === 'APROBADO') return { tone: 'success', label: 'Aprobada (cerrada)' }
  if (estado === 'ABIERTA') return { tone: 'warning', label: 'Abierta' }
  return { tone: 'neutral', label: 'Pendiente' }
}

function TrabajadorCard({ p, incidencias, prestamos, editable, onActualizar, onAjusteRapido }) {
  const [open, setOpen] = useState(false)
  // Confirmación con UI propia (sin window.confirm). { tipo:'descuento'|'deposito', id }
  const [confirmDel, setConfirmDel] = useState(null)
  const [delBusy, setDelBusy] = useState(false)

  const doDelDescuento = async (descId) => {
    const res = await eliminarDescuento(descId)
    onActualizar({
      ...p,
      descuentos_detalle: p.descuentos_detalle.filter((d) => d.id !== descId),
      total_deducciones: res.total_deducciones,
      total_a_pagar: res.total_a_pagar,
    })
    toast.success('Descuento eliminado')
  }

  const doDelDeposito = async (depId) => {
    const res = await eliminarDeposito(depId)
    onActualizar({
      ...p,
      depositos_detalle: p.depositos_detalle.filter((d) => d.id !== depId),
      total_percepciones: res.total_percepciones,
      total_a_pagar: res.total_a_pagar,
    })
    toast.success('Depósito eliminado')
  }

  const confirmarDel = async () => {
    if (!confirmDel) return
    setDelBusy(true)
    try {
      if (confirmDel.tipo === 'descuento') await doDelDescuento(confirmDel.id)
      else await doDelDeposito(confirmDel.id)
      setConfirmDel(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <>
    <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-900 dark:text-ink-100 truncate">{p.trabajador?.nombre_completo}</div>
          <div className="text-[11px] text-ink-500 font-mono mt-0.5">
            #{p.trabajador?.no_empleado} · {p.trabajador?.tipo_nomina} · {p.total_horas_calculadas.toFixed(2)}h
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] text-ink-500 uppercase">Total</div>
            <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{mxn.format(p.total_a_pagar)}</div>
          </div>
          {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-200 dark:border-ink-800 p-4 space-y-4">
          {/* Resumen percepciones / deducciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">Percepciones</h4>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Salario base</dt><dd className="font-mono">{mxn.format(p.salario_base)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Horas extras</dt><dd className="font-mono">{mxn.format(p.pago_horas_extras)}</dd></div>
                <div className="flex justify-between items-center">
                  <dt className="text-ink-600 dark:text-ink-400 inline-flex items-center gap-1"><Bus size={11} /> Viáticos</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-mono">{mxn.format(p.pago_viaticos)}</span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => onAjusteRapido('viaticos', p)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-300"
                      >Editar</button>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-ink-600 dark:text-ink-400 inline-flex items-center gap-1"><PartyPopper size={11} /> Festivos</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-mono">{mxn.format(p.pago_festivos)}</span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => onAjusteRapido('festivos', p)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-300"
                      >Editar</button>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Depósitos extra</dt><dd className="font-mono">{mxn.format(p.depositos_otros)}</dd></div>
                <div className="flex justify-between pt-1 border-t border-ink-200 dark:border-ink-700 font-semibold">
                  <dt>Total percepciones</dt><dd className="font-mono">{mxn.format(p.total_percepciones)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">Deducciones</h4>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Infonavit</dt><dd className="font-mono">{mxn.format(p.descuento_infonavit)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Ajuste Inbursa</dt><dd className="font-mono">{mxn.format(p.ajuste_inbursa)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Préstamos</dt><dd className="font-mono">{mxn.format(p.descuento_prestamos)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600 dark:text-ink-400">Descuentos extra</dt><dd className="font-mono">{mxn.format(p.descuentos_otros)}</dd></div>
                <div className="flex justify-between pt-1 border-t border-ink-200 dark:border-ink-700 font-semibold">
                  <dt>Total deducciones</dt><dd className="font-mono">{mxn.format(p.total_deducciones)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Descuentos detalle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300 inline-flex items-center gap-1">
                <ReceiptText size={11} /> Descuentos extra
              </h4>
              {editable && (
                <Button size="xs" variant="secondary" leftIcon={<Plus size={11} />} onClick={() => onAjusteRapido('descuento', p)}>
                  Agregar
                </Button>
              )}
            </div>
            {p.descuentos_detalle.length === 0 ? (
              <p className="text-xs text-ink-400 italic">Sin descuentos adicionales.</p>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md">
                {p.descuentos_detalle.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] uppercase font-semibold mr-2 px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">{d.tipo}</span>
                      <span>{d.concepto}</span>
                      {d.fecha_incidencia && <span className="text-ink-400 text-xs ml-2">({d.fecha_incidencia})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-red-600 dark:text-red-400">- {mxn.format(d.monto)}</span>
                      {editable && (
                        <button onClick={() => setConfirmDel({ tipo: 'descuento', id: d.id })} className="text-ink-400 hover:text-red-600 dark:hover:text-red-400" title="Eliminar"><X size={14} /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Depósitos detalle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300 inline-flex items-center gap-1">
                <Wallet size={11} /> Depósitos extra
              </h4>
              {editable && (
                <Button size="xs" variant="secondary" leftIcon={<Plus size={11} />} onClick={() => onAjusteRapido('deposito', p)}>
                  Agregar
                </Button>
              )}
            </div>
            {p.depositos_detalle.length === 0 ? (
              <p className="text-xs text-ink-400 italic">Sin depósitos adicionales.</p>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md">
                {p.depositos_detalle.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{d.concepto}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-700 dark:text-emerald-300">+ {mxn.format(d.monto)}</span>
                      {editable && (
                        <button onClick={() => setConfirmDel({ tipo: 'deposito', id: d.id })} className="text-ink-400 hover:text-red-600 dark:hover:text-red-400" title="Eliminar"><X size={14} /></button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Incidencias */}
          {incidencias && incidencias.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 mb-2">
                <AlertCircle size={11} /> Incidencias de la semana
              </h4>
              <ul className="text-xs space-y-1">
                {incidencias.map((i, idx) => (
                  <li key={idx} className="flex gap-2 text-ink-700 dark:text-ink-300">
                    <span className="font-mono text-ink-500">{i.fecha}</span>
                    <span className="font-semibold">{i.incidencia}</span>
                    {i.horas > 0 && <span className="text-ink-500">({i.horas}h)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Préstamos activos */}
          {prestamos && prestamos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-600 dark:text-ink-300 mb-2">Préstamos activos</h4>
              <ul className="text-xs space-y-1">
                {prestamos.map((pr) => (
                  <li key={pr.id} className="flex justify-between border-l-2 border-amber-400 pl-2">
                    <span>{pr.motivo || 'Préstamo'} <span className="text-ink-500">({pr.plazo_semanas} sem.)</span></span>
                    <span className="font-mono">resta {mxn.format(pr.monto_restante)} · -{mxn.format(pr.descuento_semanal)}/sem</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>

    <ConfirmDialog
      open={!!confirmDel}
      onClose={() => !delBusy && setConfirmDel(null)}
      onConfirm={confirmarDel}
      loading={delBusy}
      tone="danger"
      title={confirmDel?.tipo === 'deposito' ? 'Eliminar depósito' : 'Eliminar descuento'}
      description={`¿Eliminar este ${confirmDel?.tipo === 'deposito' ? 'depósito' : 'descuento'}? Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
    />
    </>
  )
}

export default function PrenominaEditar() {
  const { fecha } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [closing, setClosing] = useState(false)
  const [descargandoExcel, setDescargandoExcel] = useState(false)

  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteCtx, setAjusteCtx] = useState({ modo: null, prenomina: null })

  const cargar = () => {
    setLoading(true)
    detalleEditor(fecha)
      .then(setData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Error al cargar editor')
        navigate('/prenomina')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [fecha])

  const handleCerrar = async () => {
    setClosing(true)
    try {
      await cerrarSemana(fecha)
      toast.success('Prenómina cerrada y aprobada')
      setConfirmCerrar(false)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar')
    } finally {
      setClosing(false)
    }
  }

  const totalGlobal = useMemo(
    () => (data?.prenominas || []).reduce((acc, p) => acc + (p.total_a_pagar || 0), 0),
    [data]
  )

  const handleDescargarExcel = async () => {
    setDescargandoExcel(true)
    try {
      await exportarExcel(fecha)
      toast.success('Excel descargado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar el Excel')
    } finally {
      setDescargandoExcel(false)
    }
  }

  const handleAjusteRapido = (modo, prenomina) => {
    setAjusteCtx({ modo, prenomina })
    setAjusteOpen(true)
  }

  const onAjusteAplicado = () => {
    // Recargamos para asegurarnos de tener percepciones/totales correctos y nuevos IDs
    cargar()
  }

  const onTrabajadorActualizado = (next) => {
    setData((prev) => prev ? {
      ...prev,
      prenominas: prev.prenominas.map((p) => p.id === next.id ? next : p),
    } : prev)
  }

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-lg" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    )
  }

  const meta = estadoMeta(data.estado_actual)
  const editable = data.editable

  return (
    <>
      <PageHeader
        title={`Editor de prenómina — ${data.fecha_str}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{fmtFecha(data.fecha_inicio)} → {fmtFecha(data.fecha_fin)}</span>
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            <span className="text-ink-500">·</span>
            <span><span className="font-semibold text-ink-900 dark:text-ink-100">{data.prenominas.length}</span> trabajadores</span>
            <span className="text-ink-500">·</span>
            <span>Total <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{mxn.format(totalGlobal)}</span></span>
          </span>
        }
        breadcrumb={
          <Link to={`/prenomina/${fecha}`} className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver al preview
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/prenomina/${fecha}/pago`}>
              <Button variant="secondary" leftIcon={<DollarSign size={14} />}>
                Resumen de pago
              </Button>
            </Link>
            <Button
              variant="secondary"
              leftIcon={<FileSpreadsheet size={14} />}
              loading={descargandoExcel}
              onClick={handleDescargarExcel}
            >
              Descargar Excel
            </Button>
            {editable ? (
              <Button variant="success" leftIcon={<CheckCircle2 size={14} />} onClick={() => setConfirmCerrar(true)}>
                Cerrar y aprobar
              </Button>
            ) : (
              <Badge tone="neutral" leftIcon={<Lock size={11} />}>Solo lectura</Badge>
            )}
          </div>
        }
      />

      {data.prenominas.length === 0 ? (
        <EmptyState title="Sin prenóminas" description="No hay registros para esta semana." />
      ) : (
        <div className="space-y-3">
          {data.prenominas.map((p) => (
            <TrabajadorCard
              key={p.id}
              p={p}
              incidencias={data.incidencias_por_trabajador[p.trabajador_id]}
              prestamos={data.prestamos_por_trabajador[p.trabajador_id]}
              editable={editable}
              onActualizar={onTrabajadorActualizado}
              onAjusteRapido={handleAjusteRapido}
            />
          ))}
        </div>
      )}

      <AjusteRapidoModal
        open={ajusteOpen}
        onClose={() => setAjusteOpen(false)}
        modo={ajusteCtx.modo}
        prenomina={ajusteCtx.prenomina}
        onAplicado={onAjusteAplicado}
      />

      <ConfirmDialog
        open={confirmCerrar}
        onClose={() => setConfirmCerrar(false)}
        onConfirm={handleCerrar}
        loading={closing}
        title="Cerrar prenómina"
        description="Una vez cerrada ya no se podrán modificar montos. Se aplicarán los abonos a préstamos activos y se marcarán los ajustes Inbursa como cobrados."
        confirmLabel="Cerrar y aprobar"
        tone="warning"
      />
    </>
  )
}
