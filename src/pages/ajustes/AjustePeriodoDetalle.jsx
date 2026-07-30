import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Lock, CheckCircle2, Plus, X, AlertCircle, FileSpreadsheet, Trash2, Info,
} from 'lucide-react'
import {
  PageHeader, Button, Badge, Skeleton, ConfirmDialog, EmptyState,
} from '../../components/ui'
import {
  detallePeriodo, cerrarPeriodo, eliminarDescuento, exportarExcelPeriodo,
  bulkEliminarDescuentos,
} from '../../api/ajustes'
import AgregarDescuentoModal from './AgregarDescuentoModal'
import { useResource } from '../../hooks/useResource'

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
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [closing, setClosing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  // Selección múltiple sobre descuentos. Solo cuenta descuentos elegibles
  // (no cobrados y periodo abierto); el resto tiene checkbox deshabilitado.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [busyBulk, setBusyBulk] = useState(false)
  // Eliminar un descuento individual con confirmación de UI (sin window.confirm).
  const [confirmDelDesc, setConfirmDelDesc] = useState(null)  // descId
  const [busyDelDesc, setBusyDelDesc] = useState(false)
  const headerCbRef = useRef(null)

  // useResource + invalidateOn: cuando otro admin agrega/quita descuentos
  // o cierra el periodo, este detalle se refresca solo.
  const {
    data,
    loading,
    error,
    refetch,
  } = useResource(
    ['ajuste-detalle', { id }],
    () => detallePeriodo(id),
    {
      staleMs: 30_000,
      invalidateOn: ['ajuste:changed'],
    },
  )

  useEffect(() => {
    if (error) {
      toast.error(error.response?.data?.error || 'Error al cargar periodo')
      navigate('/ajustes')
    }
  }, [error, navigate])

  const handleCerrar = async () => {
    setClosing(true)
    try {
      await cerrarPeriodo(id)
      toast.success('Periodo cerrado')
      setConfirmCerrar(false)
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar')
    } finally {
      setClosing(false)
    }
  }

  const pedirEliminarDescuento = (descId, cobrado) => {
    if (cobrado) return toast.error('Este descuento ya fue cobrado en prenómina')
    setConfirmDelDesc(descId)
  }

  const confirmarEliminarDescuento = async () => {
    if (confirmDelDesc == null) return
    setBusyDelDesc(true)
    try {
      await eliminarDescuento(confirmDelDesc)
      toast.success('Descuento eliminado')
      setConfirmDelDesc(null)
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    } finally {
      setBusyDelDesc(false)
    }
  }

  // ── Selección múltiple ─────────────────────────────────────────────────────
  // Limpiar al recargar (otra fecha o tras una acción): la selección es
  // per-vista, no acumulativa.
  useEffect(() => { setSelectedIds(new Set()) }, [id])

  const elegibleIds = useMemo(() => {
    if (!data?.editable) return []
    const out = []
    for (const t of (data?.trabajadores || [])) {
      for (const d of t.descuentos) {
        if (!d.cobrado) out.push(d.id)
      }
    }
    return out
  }, [data])

  const allElegiblesSelected = elegibleIds.length > 0 && elegibleIds.every((id) => selectedIds.has(id))
  const someElegiblesSelected = elegibleIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    if (headerCbRef.current) {
      headerCbRef.current.indeterminate = someElegiblesSelected && !allElegiblesSelected
    }
  }, [someElegiblesSelected, allElegiblesSelected])

  const toggleOne = (descId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(descId)) next.delete(descId); else next.add(descId)
      return next
    })
  }

  const toggleAllElegibles = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allElegiblesSelected) {
        elegibleIds.forEach((descId) => next.delete(descId))
      } else {
        elegibleIds.forEach((descId) => next.add(descId))
      }
      return next
    })
  }

  const onBulkDelete = async () => {
    setBusyBulk(true)
    try {
      const res = await bulkEliminarDescuentos(Array.from(selectedIds))
      const plural = res.deleted === 1 ? '' : 's'
      toast.success(`${res.deleted} descuento${plural} eliminado${plural}`)
      if (res.skipped?.length) {
        // Resumen amistoso de skips (no_encontrado, periodo_cerrado, ya_cobrado).
        const conteo = res.skipped.reduce((acc, s) => {
          acc[s.reason] = (acc[s.reason] || 0) + 1
          return acc
        }, {})
        const labels = {
          no_encontrado: 'no existe(n)',
          periodo_cerrado: 'periodo cerrado',
          ya_cobrado: 'ya cobrado(s)',
        }
        const partes = Object.entries(conteo).map(([k, v]) => `${v} ${labels[k] || k}`)
        toast(`${res.skipped.length} omitido${res.skipped.length === 1 ? '' : 's'}: ${partes.join(', ')}`, { icon: <Info size={18} /> })
      }
      setSelectedIds(new Set())
      setConfirmBulk(false)
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar en lote')
    } finally {
      setBusyBulk(false)
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
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              leftIcon={<FileSpreadsheet size={14} />}
              onClick={async () => {
                try {
                  await exportarExcelPeriodo(data.id, `Ajuste_${data.nombre || data.id}.xlsx`)
                } catch (err) {
                  toast.error(err.response?.data?.error || 'No se pudo exportar el Excel')
                }
              }}
            >
              Exportar Excel
            </Button>
            {editable ? (
              <>
                <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                  Agregar descuento
                </Button>
                <Button variant="success" leftIcon={<CheckCircle2 size={14} />} onClick={() => setConfirmCerrar(true)}>
                  Cerrar periodo
                </Button>
              </>
            ) : (
              <Badge tone="neutral" leftIcon={<Lock size={11} />}>Solo lectura</Badge>
            )}
          </div>
        }
      />

      {editable && elegibleIds.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200 cursor-pointer">
            <input
              ref={headerCbRef}
              type="checkbox"
              checked={allElegiblesSelected}
              onChange={toggleAllElegibles}
              className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span>Seleccionar elegibles ({elegibleIds.length})</span>
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
              </span>
              <div className="flex-1" />
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setConfirmBulk(true)}
              >
                Eliminar selección
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<X size={14} />}
                onClick={() => setSelectedIds(new Set())}
              >
                Limpiar
              </Button>
            </>
          )}
        </div>
      )}

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
                        {editable && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(d.id)}
                            onChange={() => toggleOne(d.id)}
                            disabled={d.cobrado}
                            aria-label={`Seleccionar descuento ${fmt(d.fecha_descuento)}`}
                            title={d.cobrado ? 'No se puede seleccionar: ya cobrado' : 'Seleccionar para eliminar en lote'}
                            className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                          />
                        )}
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
                            onClick={() => pedirEliminarDescuento(d.id, d.cobrado)}
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
        onAgregado={refetch}
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

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={onBulkDelete}
        loading={busyBulk}
        title={`Eliminar ${selectedIds.size} descuento${selectedIds.size === 1 ? '' : 's'}`}
        description="Esta acción no se puede deshacer. Los descuentos ya cobrados se omitirán automáticamente."
        confirmLabel="Eliminar selección"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmDelDesc != null}
        onClose={() => !busyDelDesc && setConfirmDelDesc(null)}
        onConfirm={confirmarEliminarDescuento}
        loading={busyDelDesc}
        title="Eliminar descuento"
        description="¿Eliminar este descuento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
      />
    </>
  )
}
