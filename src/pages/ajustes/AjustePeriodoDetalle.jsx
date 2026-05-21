import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Lock, CheckCircle2, Plus, X, AlertCircle,
} from 'lucide-react'
import {
  PageHeader, Button, Badge, Skeleton, ConfirmDialog, EmptyState,
} from '../../components/ui'
import { detallePeriodo, cerrarPeriodo, eliminarDescuento } from '../../api/ajustes'
import AgregarDescuentoModal from './AgregarDescuentoModal'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

function fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function AjustePeriodoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [closing, setClosing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const cargar = () => {
    setLoading(true)
    detallePeriodo(id)
      .then(setData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Error al cargar periodo')
        navigate('/ajustes')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id])

  const handleCerrar = async () => {
    setClosing(true)
    try {
      await cerrarPeriodo(id)
      toast.success('Periodo cerrado')
      setConfirmCerrar(false)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar')
    } finally {
      setClosing(false)
    }
  }

  const handleEliminarDescuento = async (descId, cobrado) => {
    if (cobrado) return toast.error('Este descuento ya fue cobrado en prenómina')
    if (!window.confirm('¿Eliminar este descuento?')) return
    try {
      await eliminarDescuento(descId)
      toast.success('Descuento eliminado')
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  const editable = data.editable
  const totalPct = data.total_meta > 0 ? Math.min(100, Math.round((data.total_descontado / data.total_meta) * 100)) : 0

  return (
    <>
      <PageHeader
        title={data.nombre}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{fmt(data.fecha_inicio)} → {fmt(data.fecha_fin)}</span>
            <Badge tone={editable ? 'warning' : 'success'} dot>{editable ? 'Abierto' : 'Cerrado'}</Badge>
            <span className="text-ink-500">·</span>
            <span><span className="font-semibold">{data.trabajadores.length}</span> trabajadores</span>
            <span className="text-ink-500">·</span>
            <span>Meta total <span className="font-mono font-semibold">{mxn.format(data.total_meta)}</span></span>
            <span className="text-ink-500">·</span>
            <span>Descontado <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{mxn.format(data.total_descontado)}</span> ({totalPct}%)</span>
          </span>
        }
        breadcrumb={
          <Link to="/ajustes" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver
          </Link>
        }
        actions={
          editable ? (
            <div className="flex gap-2">
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                Agregar descuento
              </Button>
              <Button variant="success" leftIcon={<CheckCircle2 size={14} />} onClick={() => setConfirmCerrar(true)}>
                Cerrar periodo
              </Button>
            </div>
          ) : (
            <Badge tone="neutral" leftIcon={<Lock size={11} />}>Solo lectura</Badge>
          )
        }
      />

      {data.trabajadores.length === 0 ? (
        <EmptyState title="Sin trabajadores" description="Este periodo no tiene trabajadores asignados." />
      ) : (
        <div className="space-y-3">
          {data.trabajadores.map((t) => (
            <div key={t.trabajador_id} className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900 dark:text-ink-100">{t.nombre_completo}</div>
                  <div className="text-[11px] text-ink-500 font-mono">#{t.no_empleado}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-ink-500 uppercase">Meta</div>
                  <div className="font-mono font-semibold">{mxn.format(t.monto_meta)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-ink-500 uppercase">Descontado</div>
                  <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{mxn.format(t.total_descontado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-ink-500 uppercase">Restante</div>
                  <div className={`font-mono font-semibold ${t.restante > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    {mxn.format(t.restante)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
                  <div className={`h-full ${t.porcentaje >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${t.porcentaje}%` }} />
                </div>
                <span className="text-xs font-mono text-ink-500 w-10 text-right">{t.porcentaje}%</span>
              </div>

              {t.descuentos.length === 0 ? (
                <p className="text-xs text-ink-400 italic">Sin descuentos aplicados.</p>
              ) : (
                <ul className="divide-y divide-ink-200 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md">
                  {t.descuentos.map((d) => (
                    <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-ink-500">{fmt(d.fecha_descuento)}</span>
                        {d.cobrado && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <CheckCircle2 size={10} /> Cobrado
                          </span>
                        )}
                        {d.notas && <span className="text-ink-600 dark:text-ink-300 truncate">{d.notas}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{mxn.format(d.monto)}</span>
                        {editable && !d.cobrado && (
                          <button
                            onClick={() => handleEliminarDescuento(d.id, d.cobrado)}
                            className="text-ink-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Eliminar"
                          >
                            <X size={14} />
                          </button>
                        )}
                        {d.cobrado && (
                          <span className="text-ink-300" title="No se puede eliminar (ya cobrado)">
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <AgregarDescuentoModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        periodoId={data.id}
        periodoNombre={data.nombre}
        fechaMin={data.fecha_inicio}
        fechaMax={data.fecha_fin}
        trabajadores={data.trabajadores}
        onAgregado={cargar}
      />

      <ConfirmDialog
        open={confirmCerrar}
        onClose={() => setConfirmCerrar(false)}
        onConfirm={handleCerrar}
        loading={closing}
        title="Cerrar periodo"
        description="Una vez cerrado ya no podrás agregar ni eliminar descuentos."
        confirmLabel="Cerrar periodo"
        tone="warning"
      />
    </>
  )
}
