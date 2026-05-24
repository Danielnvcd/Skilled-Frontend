import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'
import { ScanLine, X, PackagePlus, PackageMinus, Activity } from 'lucide-react'
import {
  Button, Card, PageHeader, Select, Input
} from '../../components/ui'
import { validarEstanteQR, getProductos, createMovimiento } from '../../api/inventario'

export default function ScannerMovil() {
  const scannerRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)

  const [estante, setEstante] = useState(null)
  const [productos, setProductos] = useState([])

  const [form, setForm] = useState({ tipo: 'ENTRADA', producto_id: '', cantidad: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProductos().then(setProductos).catch(console.error)
  }, [])

  // Cuando isScanning pasa a true, el div #reader ya está montado y podemos
  // instanciar Html5Qrcode sin que el constructor truene por elemento ausente.
  useEffect(() => {
    if (!isScanning) return

    const qrScanner = new Html5Qrcode('reader')
    scannerRef.current = qrScanner
    let stopped = false

    qrScanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (stopped) return
          stopped = true
          qrScanner.stop().finally(() => {
            setIsScanning(false)
            handleQRScanned(decodedText)
          })
        },
        () => { /* ignore frame errors */ }
      )
      .catch((err) => {
        console.error('Scanner start failed:', err)
        toast.error('Error al iniciar la cámara. Verifica los permisos.')
        setIsScanning(false)
      })

    return () => {
      stopped = true
      if (qrScanner.getState && qrScanner.getState() === 2 /* SCANNING */) {
        qrScanner.stop().catch(() => {})
      }
      scannerRef.current = null
    }
  }, [isScanning])

  const startScanner = () => setIsScanning(true)
  const stopScanner = () => setIsScanning(false)

  const handleQRScanned = async (qrCodeText) => {
    toast.loading('Validando estante...', { id: 'qr' })
    try {
      const data = await validarEstanteQR(qrCodeText)
      setEstante(data)
      setForm({ tipo: 'ENTRADA', producto_id: '', cantidad: '' })
      toast.success(`Estante ${data.nombre} detectado`, { id: 'qr' })
    } catch (err) {
      toast.error('QR inválido o estante no encontrado', { id: 'qr' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createMovimiento({
        ...form,
        producto_id: Number(form.producto_id),
        cantidad: Number(form.cantidad),
        estante_id: estante.id,
        motivo: `Movil QR: Estante ${estante.nombre}`
      })
      toast.success('Movimiento registrado con éxito')
      setForm({ ...form, producto_id: '', cantidad: '' })
    } catch (err) {
      toast.error('Error al registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {!estante && !isScanning && (
        <div className="text-center py-10 space-y-6">
          <ScanLine size={80} className="mx-auto text-brand-500 opacity-50" />
          <div>
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 mb-2">Escáner Móvil</h2>
            <p className="text-ink-500">Apunta la cámara al código QR pegado en el estante para registrar entradas y salidas rápidamente.</p>
          </div>
          <Button size="lg" className="w-full" leftIcon={<ScanLine />} onClick={startScanner}>
            Iniciar Escáner
          </Button>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm relative">
            <Button variant="ghost" size="icon" className="absolute -top-12 right-0 text-white hover:bg-white/20" onClick={stopScanner}>
              <X size={24} />
            </Button>
            <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black"></div>
            <p className="text-center text-white mt-4 font-medium">Buscando código QR...</p>
          </div>
        </div>
      )}

      {estante && !isScanning && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-900/30 border-b border-brand-100 dark:border-brand-800 flex justify-between items-center rounded-t-xl">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Almacén</span>
              <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">{estante.nombre}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEstante(null)}>
              Escanear otro
            </Button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button 
                type="button" 
                onClick={() => setForm({...form, tipo: 'ENTRADA'})}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'ENTRADA' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <PackagePlus size={24} />
                <span className="text-xs font-bold mt-1">Entrada</span>
              </button>
              <button 
                type="button" 
                onClick={() => setForm({...form, tipo: 'SALIDA'})}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'SALIDA' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <PackageMinus size={24} />
                <span className="text-xs font-bold mt-1">Salida</span>
              </button>
              <button 
                type="button" 
                onClick={() => setForm({...form, tipo: 'AJUSTE'})}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${form.tipo === 'AJUSTE' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-transparent bg-ink-100 dark:bg-ink-800 text-ink-500'}`}
              >
                <Activity size={24} />
                <span className="text-xs font-bold mt-1">Ajuste</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Select label="Selecciona un producto" value={form.producto_id} onChange={e => setForm({...form, producto_id: e.target.value})} required>
                <option value="">Buscar producto...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} - {p.descripcion} (Stock: {p.stock_actual})</option>
                ))}
              </Select>
              
              <Input 
                label="Cantidad" 
                type="number" 
                step="0.01" 
                min={form.tipo === 'AJUSTE' ? undefined : 0.01} 
                required 
                value={form.cantidad} 
                onChange={e => setForm({...form, cantidad: e.target.value})} 
                placeholder="0"
                className="text-center text-xl font-bold"
              />

              <Button type="submit" className="w-full h-12 text-lg" loading={saving} disabled={!form.producto_id || !form.cantidad}>
                Registrar Movimiento
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  )
}
