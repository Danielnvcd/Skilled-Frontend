import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2, Plus, Receipt, Hand } from 'lucide-react'
import { Modal, Button, Input, Badge, ConfirmDialog } from '../../components/ui'
import { obtenerPrestamo, abonarPrestamo, liquidarPrestamo } from '../../api/prestamos'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })

function fmt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function PrestamoDetalleModal({ open, onClose, prestamoId, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [monto, setMonto] = useState('')
  const [abonando, setAbonando] = useState(false)
  const [liquidando, setLiquidando] = useState(false)
  const [confirmLiquidar, setConfirmLiquidar] = useState(false)

  const cargar = () => {
    if (!prestamoId) return
    setLoading(true)
    obtenerPrestamo(prestamoId)
      .then(setData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Error al cargar')
        onClose?.()
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open) return
    setMonto('')
    cargar()
  }, [open, prestamoId])

  const handleAbonar = async () => {
    const n = Number(monto)
    if (!n || n <= 0) return toast.error('Ingresa un monto > 0')
    setAbonando(true)
    try {
      await abonarPrestamo(prestamoId, { monto: n })
      toast.success(`Abono de ${mxn.format(n)} aplicado`)
      setMonto('')
      cargar()
      onChanged?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al abonar')
    } finally {
      setAbonando(false)
    }
  }

  const handleLiquidar = async () => {
    setLiquidando(true)
    try {
      await liquidarPrestamo(prestamoId)
      toast.success('Préstamo liquidado')
      setConfirmLiquidar(false)
      cargar()
      onChanged?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al liquidar')
    } finally {
      setLiquidando(false)
    }
  }

  if (!open) return null

  return (
    <>
    <Modal
      open={open}
      onClose={abonando || liquidando ? undefined : onClose}
      title={data ? `Préstamo #${data.id}` : 'Préstamo'}
      description={data?.trabajador?.nombre_completo}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}
    >
      {loading || !data ? (
        <p className="text-center text-sm text-ink-400 py-6">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Monto total" value={mxn.format(data.monto_total)} />
            <Stat label="Restante" value={mxn.format(data.monto_restante)} tone={data.monto_restante > 0 ? 'amber' : 'emerald'} />
            <Stat label="Descuento/sem" value={mxn.format(data.descuento_semanal)} />
            <Stat label="Plazo" value={`${data.plazo_semanas} sem.`} />
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-500">Estado:</span>
            {data.estado === 'ACTIVO' ? (
              <Badge tone="warning" dot>Activo</Badge>
            ) : (
              <Badge tone="success" dot>Liquidado</Badge>
            )}
            {data.motivo && <span className="text-ink-500">·</span>}
            {data.motivo && <span className="text-ink-700 dark:text-ink-200 italic">"{data.motivo}"</span>}
          </div>

          {data.estado === 'ACTIVO' && (
            <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/40 p-3">
              <h4 className="text-xs font-semibold uppercase text-ink-600 dark:text-ink-300 mb-2 inline-flex items-center gap-1">
                <Hand size={11} /> Aplicar abono manual
              </h4>
              <div className="flex gap-2 items-end">
                <Input
                  wrapperClassName="flex-1"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <Button variant="primary" leftIcon={<Plus size={13} />} loading={abonando} onClick={handleAbonar}>
                  Abonar
                </Button>
                <Button variant="success" leftIcon={<CheckCircle2 size={13} />} loading={liquidando} onClick={() => setConfirmLiquidar(true)}>
                  Liquidar todo
                </Button>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase text-ink-600 dark:text-ink-300 mb-2 inline-flex items-center gap-1">
              <Receipt size={11} /> Historial de abonos · Total abonado: <span className="font-mono">{mxn.format(data.total_abonado || 0)}</span>
            </h4>
            {data.abonos.length === 0 ? (
              <p className="text-xs text-ink-400 italic">Sin abonos registrados.</p>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md max-h-64 overflow-y-auto">
                {data.abonos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-ink-500 mr-2">{fmt(a.fecha_abono)}</span>
                      <span className={`inline-block text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        a.tipo === 'NOMINA'
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>{a.tipo}</span>
                      {a.notas && <span className="text-xs text-ink-500 ml-2">{a.notas}</span>}
                    </div>
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{mxn.format(a.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>

    <ConfirmDialog
      open={confirmLiquidar}
      onClose={() => !liquidando && setConfirmLiquidar(false)}
      onConfirm={handleLiquidar}
      loading={liquidando}
      title="Liquidar préstamo"
      description="¿Marcar este préstamo como liquidado? Se saldará el monto restante."
      confirmLabel="Liquidar"
      tone="warning"
    />
    </>
  )
}

function Stat({ label, value, tone }) {
  const toneClass = tone === 'emerald'
    ? 'text-emerald-700 dark:text-emerald-300'
    : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-ink-900 dark:text-ink-100'
  return (
    <div className="rounded-md border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-2 text-center">
      <div className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-mono font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  )
}
