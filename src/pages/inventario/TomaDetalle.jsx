import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ClipboardCheck, ArrowLeft, Search, Check, X as XIcon,
  AlertTriangle, FileText, Lock, Ban, Printer, ScanLine,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Button, Card, Skeleton, Modal, ConfirmDialog,
} from '../../components/ui'
import {
  getToma, patchTomaDetalle, patchTomaDetallePorCodigo,
  cerrarToma, cancelarToma, getTomaPdfUrl,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const ESTATUS_COLORS = {
  ABIERTA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CERRADA: 'bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
  CANCELADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const FILTRO_VISTA = [
  { key: 'todos',     label: 'Todos' },
  { key: 'pendientes', label: 'Sin capturar' },
  { key: 'diff',      label: 'Con diferencia' },
  { key: 'iguales',   label: 'Iguales' },
]

export default function TomaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [toma, setToma] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vista, setVista] = useState('todos')

  // edición inline
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

  // dialogs
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [asumirCero, setAsumirCero] = useState(false)

  // scanner
  const [scannerOpen, setScannerOpen] = useState(false)
  const scannerRef = useRef(null)
  const [scannerCantidad, setScannerCantidad] = useState('')
  const [scannerProducto, setScannerProducto] = useState(null)

  const cargar = () => {
    setLoading(true)
    getToma(id)
      .then(setToma)
      .catch(err => {
        toast.error(extractApiError(err, 'Error al cargar toma'))
        navigate('/inventario/tomas')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = toma?.estatus === 'ABIERTA'

  const detallesFiltrados = useMemo(() => {
    if (!toma) return []
    const q = search.trim().toLowerCase()
    let arr = toma.detalles || []
    if (q) {
      arr = arr.filter(d =>
        (d.producto_codigo || '').toLowerCase().includes(q) ||
        (d.producto_descripcion || '').toLowerCase().includes(q)
      )
    }
    if (vista === 'pendientes') arr = arr.filter(d => d.cantidad_fisica === null)
    else if (vista === 'diff') arr = arr.filter(d => d.cantidad_fisica !== null && Math.abs((d.diferencia || 0)) > 1e-9)
    else if (vista === 'iguales') arr = arr.filter(d => d.cantidad_fisica !== null && Math.abs((d.diferencia || 0)) < 1e-9)
    return arr
  }, [toma, search, vista])

  const resumen = useMemo(() => {
    if (!toma) return { total: 0, capturadas: 0, diff: 0, pendientes: 0 }
    const dets = toma.detalles || []
    let cap = 0, diff = 0
    for (const d of dets) {
      if (d.cantidad_fisica !== null) {
        cap++
        if (Math.abs((d.diferencia || 0)) > 1e-9) diff++
      }
    }
    return { total: dets.length, capturadas: cap, diff, pendientes: dets.length - cap }
  }, [toma])

  const startEdit = (d) => {
    if (!isOpen) return
    setEditingId(d.id)
    setEditVal(d.cantidad_fisica !== null ? String(d.cantidad_fisica) : '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditVal('')
  }

  const saveEdit = async (d) => {
    setSaving(true)
    try {
      const payload = editVal === '' ? { cantidad_fisica: null } : { cantidad_fisica: Number(editVal) }
      await patchTomaDetalle(toma.id, d.id, payload)
      setEditingId(null)
      setEditVal('')
      cargar()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleCerrar = async () => {
    try {
      const r = await cerrarToma(toma.id, { asumir_cero_no_capturados: asumirCero })
      toast.success(`Toma cerrada — ${r.ajustes_creados} ajuste(s) generado(s)`)
      setConfirmCerrar(false)
      cargar()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al cerrar'))
    }
  }

  const handleCancelar = async () => {
    try {
      await cancelarToma(toma.id)
      toast.success('Toma cancelada')
      setConfirmCancelar(false)
      cargar()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al cancelar'))
    }
  }

  // ── Scanner móvil ──
  useEffect(() => {
    if (!scannerOpen) return
    const qr = new Html5Qrcode('toma-reader')
    scannerRef.current = qr
    let stopped = false
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (stopped) return
        stopped = true
        await qr.stop().catch(() => {})
        // Buscar el detalle existente por código
        const det = (toma?.detalles || []).find(d => d.producto_codigo === decodedText)
        if (det) {
          setScannerProducto({ codigo: decodedText, descripcion: det.producto_descripcion, unidad: det.producto_unidad, det })
        } else {
          setScannerProducto({ codigo: decodedText, descripcion: '(producto no listado — se agregará)', unidad: '', det: null })
        }
        setScannerCantidad('')
        setScannerOpen(false)
      },
      () => {}
    ).catch((err) => {
      console.error(err)
      toast.error('Error al iniciar cámara')
      setScannerOpen(false)
    })
    return () => {
      stopped = true
      if (qr.getState && qr.getState() === 2) qr.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [scannerOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardarDesdeScanner = async () => {
    if (!scannerProducto || !scannerCantidad) return
    setSaving(true)
    try {
      await patchTomaDetallePorCodigo(toma.id, {
        codigo: scannerProducto.codigo,
        cantidad_fisica: Number(scannerCantidad),
      })
      toast.success(`${scannerProducto.codigo}: ${scannerCantidad} ${scannerProducto.unidad || ''}`.trim())
      setScannerProducto(null)
      setScannerCantidad('')
      cargar()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !toma) {
    return <div className="p-6"><Skeleton className="h-64 w-full rounded-md" /></div>
  }

  const pct = Math.round((toma.progreso || 0) * 100)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link to="/inventario/tomas">
          <Button variant="ghost" size="icon-sm"><ArrowLeft size={16} /></Button>
        </Link>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
          <ClipboardCheck size={20} /> Toma #{toma.id}
        </h1>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${ESTATUS_COLORS[toma.estatus] || ''}`}>
          {toma.estatus}
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><div className="p-3">
          <p className="text-[10px] uppercase text-ink-500 font-bold">Almacén</p>
          <p className="text-sm font-bold">{toma.almacen_nombre}</p>
        </div></Card>
        <Card><div className="p-3">
          <p className="text-[10px] uppercase text-ink-500 font-bold">Iniciada</p>
          <p className="text-sm">{new Date(toma.fecha_inicio).toLocaleString()}</p>
        </div></Card>
        <Card><div className="p-3">
          <p className="text-[10px] uppercase text-ink-500 font-bold">Progreso</p>
          <p className="text-sm font-bold">{resumen.capturadas}/{resumen.total}</p>
          <div className="mt-1 w-full h-1.5 bg-ink-100 dark:bg-ink-800 rounded overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </div></Card>
        <Card><div className="p-3">
          <p className="text-[10px] uppercase text-ink-500 font-bold">Con diferencia</p>
          <p className={`text-sm font-bold ${resumen.diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {resumen.diff}
          </p>
        </div></Card>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 mb-4">
        {isOpen && (
          <>
            <Button leftIcon={<ScanLine size={15} />} onClick={() => setScannerOpen(true)}>
              Escanear producto
            </Button>
            <Button variant="secondary" leftIcon={<Check size={15} />} onClick={() => setConfirmCerrar(true)}>
              Cerrar y aplicar ajustes
            </Button>
            <Button variant="ghost" leftIcon={<Ban size={15} />} onClick={() => setConfirmCancelar(true)}>
              Cancelar toma
            </Button>
          </>
        )}
        <a href={getTomaPdfUrl(toma.id)} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" leftIcon={<Printer size={15} />}>Imprimir acta PDF</Button>
        </a>
      </div>

      {!isOpen && (
        <Card className="mb-4 border-ink-300">
          <div className="p-3 flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
            <Lock size={16} />
            Toma {toma.estatus.toLowerCase()} — solo lectura.
            {toma.cerrada_por_nombre && ` Cerrada por ${toma.cerrada_por_nombre}`}
            {toma.fecha_cierre && ` el ${new Date(toma.fecha_cierre).toLocaleString()}`}.
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <div className="p-3 flex flex-wrap gap-3 items-center border-b border-ink-200 dark:border-ink-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción…"
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-1">
            {FILTRO_VISTA.map(f => (
              <button
                key={f.key}
                onClick={() => setVista(f.key)}
                className={`text-xs px-2 py-1 rounded font-medium transition ${
                  vista === f.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 hover:bg-ink-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de detalles */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-900/50 sticky top-0">
              <tr className="text-left text-[10px] uppercase text-ink-500 font-bold">
                <th className="px-3 py-2 w-20">Código</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2 text-right w-20">Sistema</th>
                <th className="px-3 py-2 text-right w-32">Físico</th>
                <th className="px-3 py-2 text-right w-20">Dif.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {detallesFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-sm italic text-ink-500">Sin resultados.</td></tr>
              ) : detallesFiltrados.map(d => {
                const editing = editingId === d.id
                const hasCap = d.cantidad_fisica !== null
                const dif = d.diferencia
                return (
                  <tr key={d.id} className={`hover:bg-ink-50 dark:hover:bg-ink-800/50 ${!hasCap ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs">{d.producto_codigo}</td>
                    <td className="px-3 py-2">{d.producto_descripcion}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(d.cantidad_sistema).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit(d)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="w-24 px-2 py-1 text-sm text-right rounded border border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <Button size="icon-sm" loading={saving} onClick={() => saveEdit(d)}><Check size={14} /></Button>
                          <Button size="icon-sm" variant="ghost" onClick={cancelEdit}><XIcon size={14} /></Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!isOpen}
                          onClick={() => startEdit(d)}
                          className={`tabular-nums ${isOpen ? 'cursor-pointer hover:underline' : 'cursor-default'} ${hasCap ? 'font-bold' : 'text-amber-600 italic'}`}
                        >
                          {hasCap ? Number(d.cantidad_fisica).toFixed(2) : 'sin contar'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {!hasCap ? (
                        <span className="text-ink-400">—</span>
                      ) : Math.abs(dif) < 1e-9 ? (
                        <span className="text-emerald-600">0.00</span>
                      ) : dif > 0 ? (
                        <span className="text-emerald-700 font-bold">+{dif.toFixed(2)}</span>
                      ) : (
                        <span className="text-red-700 font-bold">{dif.toFixed(2)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmar cierre */}
      <Modal
        open={confirmCerrar}
        onClose={() => setConfirmCerrar(false)}
        title="Cerrar toma y aplicar ajustes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCerrar(false)}>Cancelar</Button>
            <Button onClick={handleCerrar}>Cerrar y generar ajustes</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-700 dark:text-ink-300">
          <p>
            Se generará un <strong>AJUSTE</strong> por cada línea con diferencia. La toma quedará en estado <strong>CERRADA</strong>.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-3 text-xs">
            <p><strong>{resumen.diff}</strong> líneas con diferencia → se generarán {resumen.diff} ajustes.</p>
            {resumen.pendientes > 0 && (
              <p className="mt-1"><strong>{resumen.pendientes}</strong> líneas sin capturar.</p>
            )}
          </div>
          {resumen.pendientes > 0 && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={asumirCero}
                onChange={e => setAsumirCero(e.target.checked)}
                className="rounded border-ink-300"
              />
              <span>
                Tratar líneas sin capturar como <strong>cantidad física = 0</strong>
                <span className="text-amber-700 dark:text-amber-300"> (riesgoso — se aplicarán ajustes negativos)</span>
              </span>
            </label>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmCancelar}
        onClose={() => setConfirmCancelar(false)}
        onConfirm={handleCancelar}
        title="Cancelar toma"
        description="No se aplicarán ajustes. La toma quedará en estado CANCELADA y no podrá reabrirse."
        confirmLabel="Cancelar toma"
        tone="danger"
      />

      {/* Scanner modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setScannerOpen(false)}
            >
              <XIcon size={24} />
            </Button>
            <div id="toma-reader" className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black" />
            <p className="text-center text-white mt-4 font-medium">Apunta al código del producto</p>
          </div>
        </div>
      )}

      {/* Modal: capturar cantidad post-escaneo */}
      <Modal
        open={!!scannerProducto}
        onClose={() => { setScannerProducto(null); setScannerCantidad('') }}
        title="Capturar cantidad"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setScannerProducto(null); setScannerCantidad('') }}>Cancelar</Button>
            <Button onClick={guardarDesdeScanner} loading={saving} disabled={!scannerCantidad}>
              Guardar y escanear siguiente
            </Button>
          </>
        }
      >
        {scannerProducto && (
          <div className="space-y-3">
            <div className="bg-ink-50 dark:bg-ink-900/50 p-3 rounded-md">
              <p className="text-xs font-mono text-ink-500">{scannerProducto.codigo}</p>
              <p className="text-sm font-medium">{scannerProducto.descripcion}</p>
              {scannerProducto.det && (
                <p className="text-xs text-ink-500 mt-1">Sistema: {Number(scannerProducto.det.cantidad_sistema).toFixed(2)}</p>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={scannerCantidad}
              onChange={e => setScannerCantidad(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && scannerCantidad) guardarDesdeScanner() }}
              placeholder="Cantidad física"
              className="w-full px-3 py-3 text-2xl text-center font-bold rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
