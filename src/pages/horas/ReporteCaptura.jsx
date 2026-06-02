import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, CheckCircle2, Plus, Edit3, ClipboardPaste } from 'lucide-react'
import {
  PageHeader, Button, Badge, Skeleton, ConfirmDialog,
} from '../../components/ui'
import { detalleReporte, cerrarReporte } from '../../api/horas'
import { useResource } from '../../hooks/useResource'
import RegistroModal from './RegistroModal'
import PegarExcelModal from './PegarExcelModal'
import CapturaMovil from './CapturaMovil'
import useIsMobile from '../../hooks/useIsMobile'

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function estadoTone(estado) {
  if (estado === 'BORRADOR') return 'warning'
  if (estado === 'TERMINADO') return 'success'
  if (estado === 'PRENOMINA_CERRADA') return 'info'
  return 'neutral'
}

function estadoLabel(estado) {
  if (estado === 'PRENOMINA_CERRADA') return 'Prenómina cerrada'
  if (estado === 'TERMINADO') return 'Terminado'
  if (estado === 'BORRADOR') return 'Borrador'
  return estado
}

export default function ReporteCaptura() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [cellOpen, setCellOpen] = useState(false)
  const [cellCtx, setCellCtx] = useState(null) // { trabajador, fecha, fechaLabel, existing }
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [pegarOpen, setPegarOpen] = useState(false)

  // `reporte:lista_changed` cubre el caso "admin cerró el reporte / cambió
  // estado" mientras el coord lo tenía abierto. Los cambios de registros
  // internos (otro coord capturando) van por sala (reporte:registros_cambio)
  // y se mantiene la actualización optimista local vía refetch tras mutar.
  const {
    data: reporte,
    loading,
    error,
    refetch,
  } = useResource(
    ['horas-reporte', { id }],
    () => detalleReporte(id),
    { staleMs: 30_000, invalidateOn: ['reporte:lista_changed'] },
  )

  useEffect(() => {
    if (error) {
      toast.error(error.response?.data?.error || 'Error al cargar reporte')
      navigate('/horas')
    }
  }, [error, navigate])

  // Lookup rápido por (trabajador_id, fecha) -> registro
  const grid = useMemo(() => {
    if (!reporte) return {}
    const m = {}
    for (const r of reporte.registros) {
      m[`${r.trabajador_id}|${r.fecha}`] = r
    }
    return m
  }, [reporte])

  const openCell = (trabajador, fechaObj) => {
    const key = `${trabajador.id}|${fechaObj.fecha}`
    setCellCtx({
      trabajador,
      fecha: fechaObj.fecha,
      fechaLabel: `${fechaObj.dia} ${fechaObj.label}`,
      existing: grid[key] || null,
    })
    setCellOpen(true)
  }

  const onRegistroSaved = () => { refetch() }
  const onRegistroDeleted = () => { refetch() }

  const handleCerrar = async () => {
    setClosing(true)
    try {
      await cerrarReporte(id)
      toast.success('Reporte cerrado')
      setConfirmClose(false)
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar')
    } finally {
      setClosing(false)
    }
  }

  if (loading || !reporte) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }

  const editable = reporte.editable
  const totalHoras = reporte.registros.reduce((acc, r) => acc + (Number(r.horas_productivas) || 0), 0)

  return (
    <>
      <PageHeader
        title={reporte.proyecto.nombre}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-amber-700 dark:text-amber-300">{reporte.proyecto.numero_proyecto}</span>
            <span className="text-ink-400">·</span>
            <span>{fmtFecha(reporte.fecha_inicio)} → {fmtFecha(reporte.fecha_fin)}</span>
            <Badge tone={estadoTone(reporte.estado)} dot>{estadoLabel(reporte.estado)}</Badge>
          </span>
        }
        breadcrumb={
          <Link to="/horas" className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver a reportes
          </Link>
        }
        actions={
          editable ? (
            <div className="flex flex-wrap gap-2">
              {!isMobile && reporte.trabajadores.length > 0 && (
                <Button
                  variant="secondary"
                  leftIcon={<ClipboardPaste size={14} />}
                  onClick={() => setPegarOpen(true)}
                >
                  Pegar desde Excel
                </Button>
              )}
              <Button
                variant="success"
                leftIcon={<CheckCircle2 size={14} />}
                onClick={() => setConfirmClose(true)}
                disabled={reporte.registros.length === 0}
              >
                Cerrar reporte
              </Button>
            </div>
          ) : (
            <Badge tone="neutral" leftIcon={<Lock size={11} />}>Solo lectura</Badge>
          )
        }
      />

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-600 dark:text-ink-300">
        <span><span className="font-semibold text-ink-900 dark:text-ink-100">{reporte.trabajadores.length}</span> trabajadores</span>
        <span><span className="font-semibold text-ink-900 dark:text-ink-100">{reporte.registros.length}</span> registros</span>
        <span><span className="font-semibold text-ink-900 dark:text-ink-100">{totalHoras.toFixed(2)}</span> horas totales</span>
      </div>

      {isMobile ? (
        <CapturaMovil
          reporte={reporte}
          editable={editable}
          onRegistroSaved={onRegistroSaved}
          onRegistroDeleted={onRegistroDeleted}
        />
      ) : reporte.trabajadores.length === 0 ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          Este proyecto no tiene trabajadores asignados. Asigna participantes desde el módulo de Proyectos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-ink-50 dark:bg-ink-800/60 text-ink-600 dark:text-ink-300">
                <th className="sticky left-0 z-10 bg-ink-50 dark:bg-ink-800/60 text-left px-3 py-2 font-semibold w-56 border-r border-ink-200 dark:border-ink-700">
                  Empleado
                </th>
                {reporte.semana_fechas.map((d) => (
                  <th
                    key={d.fecha}
                    className={`px-2 py-2 text-center font-semibold whitespace-nowrap ${d.fin_semana ? 'bg-ink-100/70 dark:bg-ink-800/80' : ''}`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-ink-500 dark:text-ink-400">{d.dia}</div>
                    <div className="text-xs">{d.label}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold w-20">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {reporte.trabajadores.map((t) => {
                const totalT = reporte.semana_fechas.reduce((acc, d) => {
                  const reg = grid[`${t.id}|${d.fecha}`]
                  return acc + (reg ? Number(reg.horas_productivas) || 0 : 0)
                }, 0)
                return (
                  <tr key={t.id}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-ink-900 px-3 py-2 border-r border-ink-200 dark:border-ink-700">
                      <div className="font-medium text-ink-900 dark:text-ink-100 truncate">{t.nombre}</div>
                      <div className="text-[11px] font-mono text-ink-500 dark:text-ink-400">#{t.no_empleado} · {t.tipo_nomina}</div>
                    </td>
                    {reporte.semana_fechas.map((d) => {
                      const reg = grid[`${t.id}|${d.fecha}`]
                      return (
                        <td
                          key={d.fecha}
                          className={`px-1.5 py-1.5 text-center ${d.fin_semana ? 'bg-ink-50/60 dark:bg-ink-800/30' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => openCell(t, d)}
                            disabled={!editable && !reg}
                            className={`w-full min-h-[44px] rounded-md border text-xs transition-colors ${
                              reg
                                ? reg.incidencia
                                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-100'
                                  : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-100'
                                : editable
                                  ? 'border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/40 text-ink-400 dark:border-ink-700 dark:hover:border-brand-500 dark:hover:bg-brand-900/20'
                                  : 'border-ink-200 text-ink-300 dark:border-ink-800 cursor-default'
                            }`}
                          >
                            {reg ? (
                              <div className="flex flex-col items-center gap-0.5 py-1">
                                {reg.incidencia ? (
                                  <span className="font-semibold text-[10px] uppercase tracking-wide">{reg.incidencia}</span>
                                ) : (
                                  <span className="font-mono">{reg.hora_entrada}-{reg.hora_salida}</span>
                                )}
                                <span className="font-mono text-[10px]">{Number(reg.horas_productivas).toFixed(2)}h</span>
                              </div>
                            ) : (
                              editable ? <Plus size={14} className="mx-auto" /> : '—'
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-mono font-semibold text-ink-900 dark:text-ink-100">
                      {totalT.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isMobile && (
        <p className="mt-3 text-xs text-ink-500 dark:text-ink-400 inline-flex items-center gap-1">
          <Edit3 size={11} /> Click en cualquier celda para {editable ? 'capturar o editar' : 'ver detalle de'} el registro.
        </p>
      )}

      {cellCtx && (
        <RegistroModal
          open={cellOpen}
          onClose={() => setCellOpen(false)}
          reporteId={reporte.id}
          trabajador={cellCtx.trabajador}
          fecha={cellCtx.fecha}
          fechaLabel={cellCtx.fechaLabel}
          existing={cellCtx.existing}
          incidencias={reporte.incidencias}
          editable={editable}
          onSaved={onRegistroSaved}
          onDeleted={onRegistroDeleted}
        />
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={handleCerrar}
        loading={closing}
        title="Cerrar reporte semanal"
        description="Una vez cerrado ya no podrás agregar ni editar registros. Se enviará a prenómina."
        confirmLabel="Cerrar reporte"
        tone="warning"
      />

      <PegarExcelModal
        open={pegarOpen}
        onClose={() => setPegarOpen(false)}
        reporteId={reporte.id}
        trabajadores={reporte.trabajadores}
        semanaFechas={reporte.semana_fechas}
        incidencias={reporte.incidencias}
        onAplicado={() => refetch()}
      />
    </>
  )
}
