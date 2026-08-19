import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, FileText, Mail, Save, Pencil, CheckCircle2, Download,
  Plus, Minus, CirclePlus, CircleMinus, Folder, Lock, FileSpreadsheet,
  DollarSign,
} from 'lucide-react'
import { Skeleton, ConfirmDialog } from '../../components/ui'
import {
  previewSemana, guardarSemana,
  imprimirConsolidado, imprimirIndividual,
  enviarCorreoIndividual, enviarCorreoTodos,
  exportarExcel,
} from '../../api/prenomina'
import EnvioCorreoModal from './EnvioCorreoModal'
import { fmtFechaCorta as fmtFecha } from '../../utils/format'

const mxn = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`


function fmtCorta(iso) {
  if (!iso) return ''
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
  } catch { return iso }
}

export default function PrenominaGenerar() {
  const { fecha } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmGuardar, setConfirmGuardar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printingId, setPrintingId] = useState(null)
  const [emailingId, setEmailingId] = useState(null)
  const [bulkEmailing, setBulkEmailing] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const cargar = () => {
    setLoading(true)
    previewSemana(fecha)
      .then(setData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Error al cargar prenómina')
        navigate('/prenomina')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [fecha])

  const handleGuardar = async () => {
    setSaving(true)
    try {
      await guardarSemana(fecha)
      toast.success('Prenómina guardada')
      setConfirmGuardar(false)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimir = async (trabajadorId = null) => {
    setPrintingId(trabajadorId ?? 'consolidado')
    try {
      if (trabajadorId) await imprimirIndividual(fecha, trabajadorId)
      else await imprimirConsolidado(fecha)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar PDF')
    } finally {
      setPrintingId(null)
    }
  }

  const handleEnviarUno = async (trabajadorId) => {
    setEmailingId(trabajadorId)
    try {
      const res = await enviarCorreoIndividual(fecha, trabajadorId)
      toast.success(`Recibo enviado a ${res.destinatario}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar correo')
    } finally {
      setEmailingId(null)
    }
  }

  const handleExportarExcel = async () => {
    setExportingExcel(true)
    try {
      await exportarExcel(fecha)
      toast.success('Excel descargado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al exportar Excel')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleEnviarTodos = async () => {
    setBulkEmailing(true)
    try {
      const res = await enviarCorreoTodos(fecha)
      setBulkResult(res)
      setBulkOpen(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar correos')
    } finally {
      setBulkEmailing(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <>
      {/* Breadcrumb arriba del info bar */}
      <Link to="/prenomina" className="inline-flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400 hover:underline mb-3">
        <ArrowLeft size={12} /> Volver al índice
      </Link>

      {/* INFO BAR */}
      <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 px-5 py-4 mb-6 shadow-sm flex flex-wrap items-stretch justify-between gap-4">
        <div className="flex flex-wrap gap-8 items-stretch">
          <InfoItem label="Proyectos Integrados" value={`${data.proyectos.length} Proyecto(s)`} />
          <InfoItem label="Semana Calculada" value={`${fmtFecha(data.fecha_inicio)} - ${fmtFecha(data.fecha_fin)}`} />
          <InfoItem label="Trabajadores" value={String(data.prenominas.length)} />

          {/* Desglose de proyectos */}
          <div className="pl-6 ml-2 border-l-2 border-ink-200 dark:border-ink-700 max-w-md min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Desglose de Proyectos</p>
            <div className="flex flex-col gap-1 max-h-20 overflow-y-auto pr-1 mt-1 scrollbar-thin">
              {data.proyectos.map((p) => (
                <div key={p.id} className="text-sm text-ink-700 dark:text-ink-200 leading-tight">
                  <Folder size={11} className="inline -mt-0.5 mr-1 text-indigo-500" />
                  <strong className="font-bold">{p.nombre || p.numero_proyecto}</strong>
                  <span className="block text-xs text-ink-500 dark:text-ink-400 pl-4">
                    Coord: {p.coordinador_nombre || 'Sin asignar'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <BarButton variant="outline-indigo" onClick={() => handleImprimir(null)} loading={printingId === 'consolidado'}>
            <FileText size={16} /> Imprimir Proyección (PDF)
          </BarButton>

          <BarButton variant="outline-emerald" onClick={handleExportarExcel} loading={exportingExcel}>
            <FileSpreadsheet size={16} /> Exportar Excel
          </BarButton>

          {data.ya_guardada && (
            <BarButton variant="outline-emerald" onClick={() => navigate(`/prenomina/${fecha}/pago`)}>
              <DollarSign size={16} /> Resumen de pago
            </BarButton>
          )}

          <BarButton variant="outline-green" onClick={handleEnviarTodos} loading={bulkEmailing}>
            <Mail size={16} /> Enviar todos por correo
          </BarButton>

          {!data.ya_guardada ? (
            <BarButton variant="gradient-green" onClick={() => setConfirmGuardar(true)}>
              <Save size={16} /> Guardar Nómina (Abrir para Edición)
            </BarButton>
          ) : data.estado_actual === 'ABIERTA' ? (
            <BarButton variant="gradient-amber" onClick={() => navigate(`/prenomina/${fecha}/editar`)}>
              <Pencil size={16} /> Editar Prenómina
            </BarButton>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-100 text-emerald-900 font-semibold text-sm border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/60">
              <Lock size={16} /> Nómina Cerrada
            </span>
          )}
        </div>
      </div>

      {/* GRID DE RECIBOS */}
      {data.prenominas.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800">
          <p className="text-ink-500 dark:text-ink-400">No se encontraron horas registradas para esta semana / proyecto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.prenominas.map((p) => (
            <ReciboCard
              key={p.id ?? p.trabajador?.id}
              p={p}
              onPrint={() => handleImprimir(p.trabajador?.id)}
              onEmail={() => handleEnviarUno(p.trabajador?.id)}
              printing={printingId === p.trabajador?.id}
              emailing={emailingId === p.trabajador?.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmGuardar}
        onClose={() => setConfirmGuardar(false)}
        onConfirm={handleGuardar}
        loading={saving}
        title="Guardar prenómina"
        description="Se guardarán los montos calculados y los reportes pasarán a estado 'Prenómina cerrada'. Después podrás editar descuentos, depósitos y cerrar definitivamente."
        confirmLabel="Guardar"
        tone="warning"
      />

      <EnvioCorreoModal open={bulkOpen} onClose={() => setBulkOpen(false)} resultado={bulkResult} />
    </>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function InfoItem({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
      <span className="text-lg font-bold text-ink-900 dark:text-ink-100 mt-1">{value}</span>
    </div>
  )
}

function BarButton({ variant = 'outline-indigo', loading, onClick, children }) {
  const styles = {
    'outline-indigo': 'border border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:border-indigo-500 dark:hover:bg-indigo-900/30',
    'outline-green': 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-600 dark:hover:bg-emerald-900/30',
    'outline-emerald': 'border border-emerald-500 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-500 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30',
    'gradient-green': 'text-white border-0 bg-gradient-to-br from-emerald-600 to-emerald-400 shadow-sm hover:brightness-110',
    'gradient-amber': 'text-white border-0 bg-gradient-to-br from-amber-500 to-amber-400 shadow-sm hover:brightness-110',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-wait ${styles[variant]}`}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : children}
    </button>
  )
}

function ReciboCard({ p, onPrint, onEmail, printing, emailing }) {
  const t = p.trabajador
  const sinCorreo = !t?.correo
  const tieneDepositosDetalle = (p.depositos_detalle && p.depositos_detalle.length > 0)
  const tieneDescuentosDetalle = (p.descuentos_detalle && p.descuentos_detalle.length > 0)

  return (
    <div className="relative bg-white dark:bg-ink-900 rounded-xl border border-ink-200/80 dark:border-ink-800 overflow-hidden shadow-md hover:-translate-y-0.5 hover:shadow-xl transition-all">
      {/* Línea decorativa superior */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-600 via-blue-500 to-emerald-500 z-10" />

      {/* Header */}
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-ink-800/40 dark:to-ink-900 px-6 py-4 border-b border-ink-200/60 dark:border-ink-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-extrabold text-slate-900 dark:text-ink-100 tracking-tight truncate">{t?.nombre_completo}</span>
          <span className="text-xs text-slate-500 dark:text-ink-400 mt-1 flex flex-wrap gap-2 items-center">
            Nº Emp: <Tag>{t?.no_empleado}</Tag>
            <span className="text-slate-300">|</span>
            Nómina: <Tag>{t?.tipo_nomina || 'No Asignada'}</Tag>
            <span className="text-slate-300">|</span>
            Pago: <Tag>{p.tipo_pago || '—'}</Tag>
            <span className="text-slate-300">|</span>
            Hrs Laboradas: <Tag>{(p.total_horas_calculadas || 0).toFixed(2)}</Tag>
          </span>
        </div>

        <div className="flex gap-2 items-center flex-shrink-0">
          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-md border border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-60"
          >
            {printing ? (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : <Download size={14} />}
            Descargar Recibo
          </button>

          {sinCorreo ? (
            <span className="text-xs text-ink-400 px-2">Sin correo</span>
          ) : (
            <button
              type="button"
              onClick={onEmail}
              disabled={emailing}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {emailing ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : <Mail size={14} />}
              Enviar Correo
            </button>
          )}
        </div>
      </div>

      {/* Body: 2 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        {/* PERCEPCIONES */}
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-300 pb-2 mb-3 border-b-2 border-ink-200/50 dark:border-ink-700/60">
            <Plus size={14} strokeWidth={2.5} /> Percepciones
          </div>
          <ul className="m-0 p-0 list-none space-y-0">
            <Concept idx={0}>{['Sueldo Base Ordinario', mxn(p.salario_base)]}</Concept>
            <Concept idx={1}>{['Tiempo Extra', mxn(p.pago_horas_extras)]}</Concept>
            <Concept idx={2}>{['Viáticos', mxn(p.pago_viaticos)]}</Concept>
            <Concept idx={3}>{['Días Festivos', mxn(p.pago_festivos)]}</Concept>

            {p.depositos_prestamos > 0 && (
              <Concept idx={4}>{['Depósito Préstamo', mxn(p.depositos_prestamos)]}</Concept>
            )}

            {tieneDepositosDetalle ? (
              <>
                {p.depositos_detalle.map((d) => (
                  <li
                    key={d.id}
                    className="flex justify-between items-center pl-6 pr-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-500/5 border-l-2 border-emerald-400/40 ml-2 rounded-r-md mb-px hover:bg-emerald-500/10"
                  >
                    <span className="flex items-center gap-1.5">
                      <CirclePlus size={11} className="text-emerald-400" />
                      <span className="text-[10px] font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">Depósito</span>
                      {d.concepto}
                    </span>
                    <span className="font-mono">{mxn(d.monto)}</span>
                  </li>
                ))}
                {p.depositos_detalle.length > 1 && (
                  <li className="flex justify-between items-center px-3 py-1.5 text-xs font-bold italic text-emerald-700 dark:text-emerald-300 bg-emerald-500/[0.06] rounded-md mb-1">
                    <span>Subtotal Depósitos Extras</span>
                    <span className="font-mono">{mxn(p.depositos_otros)}</span>
                  </li>
                )}
              </>
            ) : p.depositos_otros > 0 ? (
              <Concept idx={5}>{['Depósitos Extras', mxn(p.depositos_otros)]}</Concept>
            ) : null}

            <li className="flex justify-between items-center px-4 py-3 mt-2 rounded-lg bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-200 border border-emerald-500/15 font-extrabold text-base">
              <span>Total Percepciones</span>
              <span className="font-mono">{mxn(p.total_percepciones)}</span>
            </li>
          </ul>
        </div>

        {/* DEDUCCIONES */}
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-300 pb-2 mb-3 border-b-2 border-ink-200/50 dark:border-ink-700/60">
            <Minus size={14} strokeWidth={2.5} /> Deducciones Extraídas
          </div>
          <ul className="m-0 p-0 list-none space-y-0">
            <Concept idx={0}>{['Infonavit', `-${mxn(p.descuento_infonavit)}`]}</Concept>
            <Concept idx={1}>{['Ajuste Inbursa', `-${mxn(p.ajuste_inbursa)}`]}</Concept>
            <Concept idx={2}>{['Faltas / Retardos (Incidencias)', `-${mxn(p.descuento_incidencias)}`]}</Concept>

            {p.descuento_prestamos > 0 && (
              <Concept idx={3}>{['Abono Préstamos', `-${mxn(p.descuento_prestamos)}`]}</Concept>
            )}

            {tieneDescuentosDetalle ? (
              <>
                {p.descuentos_detalle.map((d) => (
                  <li
                    key={d.id}
                    className="flex justify-between items-center pl-6 pr-3 py-1.5 text-xs text-rose-700 dark:text-rose-200 bg-rose-500/5 border-l-2 border-rose-400/40 ml-2 rounded-r-md mb-px hover:bg-rose-500/10"
                  >
                    <span className="flex items-center gap-1.5">
                      <CircleMinus size={11} className="text-rose-400" />
                      {d.concepto}
                      {d.fecha_incidencia && (
                        <span className="text-ink-500 dark:text-ink-400">({fmtCorta(d.fecha_incidencia)})</span>
                      )}
                    </span>
                    <span className="font-mono">-{mxn(d.monto)}</span>
                  </li>
                ))}
                {p.descuentos_detalle.length > 1 && (
                  <li className="flex justify-between items-center px-3 py-1.5 text-xs font-bold italic text-rose-700 dark:text-rose-300 bg-rose-500/[0.05] rounded-md mb-1">
                    <span>Subtotal Descuentos Varios</span>
                    <span className="font-mono">-{mxn(p.descuentos_otros)}</span>
                  </li>
                )}
              </>
            ) : p.descuentos_otros > 0 ? (
              <Concept idx={4}>{['Descuentos Varios', `-${mxn(p.descuentos_otros)}`]}</Concept>
            ) : null}

            {p.recuperacion_manual > 0 && (
              <Concept idx={5}>{['Recuperación (Préstamo Dirección)', `-${mxn(p.recuperacion_manual)}`]}</Concept>
            )}

            <li className="flex justify-between items-center px-4 py-3 mt-2 rounded-lg bg-red-500/[0.08] text-red-800 dark:text-red-200 border border-red-500/15 font-extrabold text-base">
              <span>Total Deducciones</span>
              <span className="font-mono">-{mxn(p.total_deducciones)}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer: gran total */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-ink-800/40 dark:to-ink-800/70 px-6 py-4 border-t border-dashed border-slate-300 dark:border-ink-700 flex justify-between items-center">
        <span className="text-ink-500 dark:text-ink-400 text-sm">Total Neto a Depositar / Entregar</span>
        <span className="text-2xl font-black bg-gradient-to-br from-slate-900 to-slate-600 dark:from-ink-100 dark:to-ink-300 bg-clip-text text-transparent">
          {mxn(p.total_a_pagar)}
        </span>
      </div>
    </div>
  )
}

function Tag({ children }) {
  return (
    <strong className="bg-slate-100 dark:bg-ink-800 text-slate-700 dark:text-ink-200 font-semibold px-1.5 py-px rounded">
      {children}
    </strong>
  )
}

function Concept({ idx, children }) {
  const [label, value] = children
  const zebra = idx % 2 === 1 ? 'bg-slate-50/70 dark:bg-ink-800/30' : ''
  return (
    <li className={`flex justify-between items-center px-3 py-2 text-sm text-slate-600 dark:text-ink-300 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-ink-800/60 hover:pl-4 ${zebra}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </li>
  )
}
