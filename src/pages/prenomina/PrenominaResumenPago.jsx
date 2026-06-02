import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Search, FileSpreadsheet, Wallet, CreditCard,
  Banknote, Users, DollarSign, CheckCircle2, Lock, Printer,
  Mail, X,
} from 'lucide-react'
import {
  PageHeader, Button, Badge, Skeleton, EmptyState,
} from '../../components/ui'
import {
  detalleEditor, exportarExcel, imprimirConsolidado, enviarCorreoBulk,
} from '../../api/prenomina'
import EnvioCorreoModal from './EnvioCorreoModal'
import { useResource } from '../../hooks/useResource'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

// Agrupa los métodos de pago "raros" en el bucket OTRO para mantener la UI legible.
function normalizaMetodo(raw) {
  const t = (raw || '').toUpperCase().trim()
  if (t === 'EFECTIVO') return 'EFECTIVO'
  if (t === 'TRANSFERENCIA' || t === 'SPEI') return 'TRANSFERENCIA'
  if (t === 'TARJETA' || t === 'INBURSA') return 'TARJETA'
  return t || 'SIN ASIGNAR'
}

const METODO_META = {
  EFECTIVO:       { icon: Banknote,    label: 'Efectivo',       bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  TRANSFERENCIA:  { icon: Wallet,      label: 'Transferencia',  bg: 'bg-sky-50 dark:bg-sky-900/20',         border: 'border-sky-200 dark:border-sky-800',         text: 'text-sky-700 dark:text-sky-300' },
  TARJETA:        { icon: CreditCard,  label: 'Tarjeta',        bg: 'bg-violet-50 dark:bg-violet-900/20',   border: 'border-violet-200 dark:border-violet-800',   text: 'text-violet-700 dark:text-violet-300' },
  'SIN ASIGNAR':  { icon: Users,       label: 'Sin asignar',    bg: 'bg-ink-50 dark:bg-ink-800/40',         border: 'border-ink-200 dark:border-ink-700',         text: 'text-ink-600 dark:text-ink-400' },
}

export default function PrenominaResumenPago() {
  const { fecha } = useParams()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)

  // useResource + invalidateOn permite que cuando otro admin agregue/quite
  // descuentos o depósitos en la misma semana, esta pantalla se refresque
  // sola sin recarga manual.
  const {
    data,
    loading,
    error,
  } = useResource(
    ['prenomina-resumen', { fecha }],
    () => detalleEditor(fecha),
    {
      staleMs: 30_000,
      invalidateOn: ['prenomina:changed'],
    },
  )

  // Selección múltiple para envío de recibos por correo.
  // Clave: trabajador_id (no prenómina id) porque el endpoint individual
  // ya existente lo identifica por trabajador.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [enviando, setEnviando] = useState(false)
  const [resultadoEnvio, setResultadoEnvio] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const headerCbRef = useRef(null)

  useEffect(() => {
    if (error) {
      toast.error(error.response?.data?.error || 'Error al cargar resumen de pago')
      navigate('/prenomina')
    }
  }, [error, navigate])

  const filtradas = useMemo(() => {
    if (!data?.prenominas) return []
    // Excluir total = 0: no aportan al resumen de pago y solo hacen ruido.
    const visibles = data.prenominas.filter((p) => (p.total_a_pagar || 0) > 0)
    if (!busqueda.trim()) return visibles
    const q = busqueda.trim().toLowerCase()
    return visibles.filter((p) => {
      const nombre = (p.trabajador?.nombre_completo || '').toLowerCase()
      const num = String(p.trabajador?.no_empleado || '')
      return nombre.includes(q) || num.includes(q)
    })
  }, [data, busqueda])

  const grupos = useMemo(() => {
    const map = {}
    for (const p of filtradas) {
      const key = normalizaMetodo(p.tipo_pago || p.trabajador?.tipo_pago)
      if (!map[key]) map[key] = { metodo: key, items: [], subtotal: 0 }
      map[key].items.push(p)
      map[key].subtotal += p.total_a_pagar || 0
    }
    // Orden estable: efectivo primero (más urgente para tesorería), luego transferencias, etc.
    const ORDEN = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'SIN ASIGNAR']
    return Object.values(map).sort((a, b) => {
      const ia = ORDEN.indexOf(a.metodo); const ib = ORDEN.indexOf(b.metodo)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [filtradas])

  const totalGeneral = useMemo(
    () => filtradas.reduce((acc, p) => acc + (p.total_a_pagar || 0), 0),
    [filtradas]
  )

  const handleExcel = async () => {
    setDescargando(true)
    try {
      await exportarExcel(fecha)
      toast.success('Excel descargado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar el Excel')
    } finally {
      setDescargando(false)
    }
  }

  const handleImprimir = async () => {
    setImprimiendo(true)
    try {
      await imprimirConsolidado(fecha)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar PDF')
    } finally {
      setImprimiendo(false)
    }
  }

  // ── Selección múltiple ─────────────────────────────────────────────────────
  // Limpiar al cambiar de semana o de búsqueda: la selección es per-vista,
  // no acumulativa, para evitar enviar correos a filas que ya no se ven.
  useEffect(() => { setSelectedIds(new Set()) }, [fecha, busqueda])

  const visibleIds = useMemo(
    () => filtradas.map((p) => p.trabajador_id).filter(Boolean),
    [filtradas],
  )
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    if (headerCbRef.current) {
      headerCbRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
    }
  }, [someVisibleSelected, allVisibleSelected])

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleEnviarSeleccion = async () => {
    if (selectedIds.size === 0) return
    setEnviando(true)
    try {
      const res = await enviarCorreoBulk(fecha, Array.from(selectedIds))
      setResultadoEnvio(res)
      setModalOpen(true)
      if (res.enviados > 0) {
        toast.success(`${res.enviados} recibo${res.enviados === 1 ? '' : 's'} enviado${res.enviados === 1 ? '' : 's'}`)
      }
      // Limpiar selección solo si hubo envíos exitosos. Si todos fallaron,
      // dejamos la selección para que el usuario pueda reintentar.
      if (res.enviados > 0 && res.errores === 0) {
        setSelectedIds(new Set())
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar recibos')
    } finally {
      setEnviando(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    )
  }

  const aprobada = data.estado_actual === 'APROBADO'

  return (
    <>
      <PageHeader
        icon={DollarSign}
        title={`Resumen de pago — ${data.fecha_str}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{fmtFecha(data.fecha_inicio)} → {fmtFecha(data.fecha_fin)}</span>
            <Badge tone={aprobada ? 'success' : 'warning'} dot>
              {aprobada ? 'Aprobada (cerrada)' : 'Abierta — sujeta a cambios'}
            </Badge>
            <span className="text-ink-500">·</span>
            <span><span className="font-semibold text-ink-900 dark:text-ink-100">{filtradas.length}</span> trabajadores a pagar</span>
          </span>
        }
        breadcrumb={
          <Link to={`/prenomina/${fecha}/editar`} className="hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Volver al editor
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<Printer size={14} />}
              loading={imprimiendo}
              onClick={handleImprimir}
            >
              Recibos PDF
            </Button>
            <Button
              variant="success"
              leftIcon={<FileSpreadsheet size={14} />}
              loading={descargando}
              onClick={handleExcel}
            >
              Descargar Excel
            </Button>
          </div>
        }
      />

      {/* KPI total general */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-3 items-stretch">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-4 py-3 shadow-sm flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
              <DollarSign size={11} /> Total a pagar esta semana
            </div>
            <div className="text-[11px] opacity-85 mt-0.5">
              {filtradas.length} de {data.prenominas.length} empleados con pago &gt; $0
              {aprobada && (
                <span className="inline-flex items-center gap-1 ml-1">
                  · <CheckCircle2 size={10} /> Aprobada
                </span>
              )}
            </div>
          </div>
          <div className="text-xl font-extrabold font-mono whitespace-nowrap">{mxn.format(totalGeneral)}</div>
        </div>
        <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg px-3 py-2 flex items-center gap-2 min-w-[240px]">
          <Search size={14} className="text-ink-400 flex-shrink-0" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empleado o número…"
            className="bg-transparent border-none outline-none text-sm w-full text-ink-900 dark:text-ink-100 placeholder:text-ink-400"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="text-ink-400 hover:text-red-500 text-base leading-none px-1"
              title="Limpiar"
            >×</button>
          )}
        </div>
      </div>

      {filtradas.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200 cursor-pointer">
            <input
              ref={headerCbRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span>Seleccionar visibles ({filtradas.length})</span>
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
              </span>
              <div className="flex-1" />
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Mail size={14} />}
                loading={enviando}
                onClick={handleEnviarSeleccion}
              >
                Enviar recibo por correo
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

      {filtradas.length === 0 ? (
        <EmptyState
          icon={Users}
          title={busqueda ? 'Sin coincidencias' : 'Sin empleados a pagar'}
          description={busqueda ? 'Prueba con otro nombre o número.' : 'Ningún trabajador tiene monto > $0 en esta semana.'}
        />
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => {
            const meta = METODO_META[g.metodo] || METODO_META['SIN ASIGNAR']
            const Icon = meta.icon
            return (
              <section key={g.metodo} className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden`}>
                <header className="flex items-center justify-between px-4 py-2 border-b border-current/10">
                  <div className="flex items-center gap-2">
                    <span className={`h-6 w-6 rounded inline-flex items-center justify-center bg-white/80 dark:bg-ink-900/60 ${meta.text}`}>
                      <Icon size={12} />
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-bold uppercase tracking-wide text-xs ${meta.text}`}>{meta.label}</span>
                      <span className="text-[10px] text-ink-500 dark:text-ink-400">{g.items.length} empleado{g.items.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="text-right flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500 dark:text-ink-400">Subtotal</span>
                    <span className={`font-mono font-bold text-sm ${meta.text}`}>{mxn.format(g.subtotal)}</span>
                  </div>
                </header>

                <ul className="bg-white dark:bg-ink-900 divide-y divide-ink-200 dark:divide-ink-800">
                  {g.items
                    .slice()
                    .sort((a, b) => (b.total_a_pagar || 0) - (a.total_a_pagar || 0))
                    .map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.trabajador_id)}
                          onChange={() => toggleOne(p.trabajador_id)}
                          aria-label={`Seleccionar ${p.trabajador?.nombre_completo || ''}`}
                          className="h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink-900 dark:text-ink-100 truncate text-sm">
                            {p.trabajador?.nombre_completo || '—'}
                          </div>
                          <div className="text-[11px] text-ink-500 font-mono mt-0.5">
                            #{p.trabajador?.no_empleado || '—'}
                            {p.trabajador?.tipo_nomina && (
                              <span className="ml-2 inline-block px-1 py-0 rounded bg-ink-100 dark:bg-ink-800 text-[10px] uppercase">
                                {p.trabajador.tipo_nomina}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {mxn.format(p.total_a_pagar)}
                          </div>
                          <div className="text-[10px] text-ink-500 dark:text-ink-400 mt-0.5">
                            Percep. {mxn.format(p.total_percepciones)} · Deduc. {mxn.format(p.total_deducciones)}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {!aprobada && (
        <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Lock size={12} className="text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Esta prenómina sigue abierta.</strong> Los montos pueden cambiar antes del cierre.
            Cuando esté aprobada, descarga el Excel para tesorería.
          </div>
        </div>
      )}

      <EnvioCorreoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        resultado={resultadoEnvio}
      />
    </>
  )
}
