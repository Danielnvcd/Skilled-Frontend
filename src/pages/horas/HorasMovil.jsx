import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import {
  ScanLine, X, Camera, ArrowLeftRight, CheckCircle2, XCircle, ChevronRight,
  Clock, AlertCircle,
} from 'lucide-react'
import {
  Button, Card, PageHeader, EmptyState, Skeleton, Badge,
} from '../../components/ui'
import { obtenerResumenMovil, qrCheck } from '../../api/horas'

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
  } catch { return iso }
}

function ReporteSelector({ reportes, selectedId, onSelect }) {
  if (!reportes?.length) {
    return (
      <Card className="text-sm text-ink-500 dark:text-ink-400">
        No tienes reportes en BORRADOR. Abre uno desde la vista de escritorio antes de escanear.
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {reportes.map((r) => {
        const isSelected = r.id === selectedId
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`w-full text-left p-3 rounded-lg border transition-colors focus-ring ${
              isSelected
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                : 'border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-900/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-300">
                  {r.numero}
                </div>
                <div className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate mt-0.5">
                  {r.nombre || 'Sin descripción'}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">
                  {fmtFecha(r.inicio)} — {fmtFecha(r.fin)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {r.es_actual && <Badge tone="success" dot>Actual</Badge>}
                {isSelected && <CheckCircle2 size={16} className="text-brand-600" />}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ResultadoOverlay({ resultado, onClose }) {
  if (!resultado) return null
  const isOk = resultado.ok
  const icon = isOk ? CheckCircle2 : XCircle
  const tone = isOk
    ? (resultado.tipo === 'ENTRADA' ? 'text-emerald-500' : 'text-blue-500')
    : 'text-red-500'

  useEffect(() => {
    if (!isOk) return
    const t = setTimeout(() => onClose(), 2200)
    return () => clearTimeout(t)
  }, [isOk, onClose])

  const Icon = icon
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4">
      <Card className="max-w-sm w-full text-center">
        <Icon size={56} className={`mx-auto ${tone}`} />
        {isOk ? (
          <>
            <p className={`mt-3 text-lg font-bold ${tone}`}>{resultado.tipo}</p>
            <p className="mt-1 text-sm text-ink-900 dark:text-ink-100 font-semibold">
              {resultado.nombre}
            </p>
            <p className="mt-2 text-3xl font-mono font-bold text-ink-900 dark:text-ink-100">
              {resultado.hora}
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-base font-semibold text-red-600 dark:text-red-400">
              No se pudo registrar
            </p>
            <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              {resultado.error}
            </p>
            <Button variant="primary" className="mt-4 w-full" onClick={onClose}>
              Continuar
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}

export default function HorasMovil() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const [resumen, setResumen] = useState({ proyectos: [], reportes: [] })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('menu') // menu | picker | scanner
  const [selectedReporte, setSelectedReporte] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [resultado, setResultado] = useState(null)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    obtenerResumenMovil()
      .then((res) => { if (!cancelled) setResumen(res) })
      .catch(() => toast.error('Error cargando reportes'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        try { scannerRef.current.stop().catch(() => {}) } catch {}
      }
    }
  }, [])

  const startScanner = async () => {
    setView('scanner')
    // Esperar al siguiente tick para que el div #qr-reader exista
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode('qr-reader')
        scannerRef.current = html5Qr
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => handleScan(decodedText),
          () => {},
        )
        setIsScanning(true)
      } catch (err) {
        toast.error('No se pudo iniciar la cámara. Revisa permisos.')
        setView('menu')
      }
    }, 0)
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleScan = async (qrCodeText) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    try {
      const res = await qrCheck({
        qr_code: qrCodeText,
        reporte_id: selectedReporte?.id,
      })
      setResultado(res)
    } catch (err) {
      setResultado({ ok: false, error: err.response?.data?.error || 'Error de conexión' })
    } finally {
      // Reabrir después de 1.5s para evitar dobles lecturas del mismo QR
      setTimeout(() => { isProcessingRef.current = false }, 1500)
    }
  }

  const onAbrirScanner = () => {
    const conReportes = resumen.reportes || []
    if (conReportes.length === 0) {
      toast.error('No hay reportes en BORRADOR para escanear.')
      return
    }
    if (conReportes.length === 1) {
      setSelectedReporte(conReportes[0])
      startScanner()
      return
    }
    setView('picker')
  }

  const onPickReporte = (rep) => {
    setSelectedReporte(rep)
    startScanner()
  }

  const onCerrarScanner = async () => {
    await stopScanner()
    setView('menu')
    setSelectedReporte(null)
  }

  // ── Vistas ──

  if (loading) {
    return (
      <div className="max-w-md mx-auto space-y-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (view === 'scanner') {
    return (
      <div className="fixed inset-0 z-40 bg-black flex flex-col">
        <div className="flex items-center justify-between p-4 bg-ink-950 text-white">
          <button onClick={onCerrarScanner} className="p-2" aria-label="Cerrar">
            <X size={22} />
          </button>
          <div className="text-center min-w-0 flex-1 px-2">
            <div className="text-sm font-semibold truncate">{selectedReporte?.nombre}</div>
            <div className="text-xs text-ink-300 mt-0.5">
              {fmtFecha(selectedReporte?.inicio)} — {fmtFecha(selectedReporte?.fin)}
            </div>
          </div>
          <button
            onClick={async () => { await stopScanner(); setView('picker') }}
            className="p-2"
            aria-label="Cambiar reporte"
            disabled={(resumen.reportes || []).length <= 1}
          >
            <ArrowLeftRight size={20} />
          </button>
        </div>

        <div id="qr-reader" className="flex-1 bg-black" />

        <div className="p-4 bg-ink-950">
          <Button variant="danger" className="w-full" leftIcon={<X size={16} />} onClick={onCerrarScanner}>
            Detener escaneo
          </Button>
        </div>

        <ResultadoOverlay resultado={resultado} onClose={() => setResultado(null)} />
      </div>
    )
  }

  if (view === 'picker') {
    return (
      <div className="max-w-md mx-auto">
        <PageHeader
          icon={Clock}
          title="Selecciona un reporte"
          description="Elige la semana a registrar antes de escanear"
        />
        <ReporteSelector
          reportes={resumen.reportes}
          selectedId={selectedReporte?.id}
          onSelect={onPickReporte}
        />
        <Button variant="ghost" className="mt-4 w-full" onClick={() => setView('menu')}>
          Cancelar
        </Button>
      </div>
    )
  }

  // Menu principal
  return (
    <div className="max-w-md mx-auto space-y-4">
      <PageHeader
        icon={Clock}
        title="Horas (móvil)"
        description="Registro de asistencia por QR para tus proyectos."
      />

      <button
        type="button"
        onClick={onAbrirScanner}
        className="w-full flex items-center gap-4 p-5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg active:scale-[0.99] transition-transform focus-ring"
      >
        <Camera size={32} />
        <div className="flex-1 text-left">
          <div className="text-base font-bold">Registrar asistencia</div>
          <div className="text-xs opacity-90 mt-0.5">
            {resumen.reportes?.length || 0} reporte{(resumen.reportes?.length || 0) === 1 ? '' : 's'} en borrador
          </div>
        </div>
        <ChevronRight size={20} />
      </button>

      <Card padded={false}>
        <button
          type="button"
          onClick={() => navigate('/horas')}
          className="w-full flex items-center gap-3 p-4 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors focus-ring text-left"
        >
          <Clock size={20} className="text-brand-500" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink-900 dark:text-ink-100">Reportes de horas</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">Ver y capturar reportes</div>
          </div>
          <ChevronRight size={16} className="text-ink-400" />
        </button>
      </Card>

      <Card padded={false}>
        <button
          type="button"
          onClick={() => navigate('/ficha')}
          className="w-full flex items-center gap-3 p-4 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors focus-ring text-left"
        >
          <AlertCircle size={20} className="text-amber-500" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink-900 dark:text-ink-100">Ficha técnica</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">Info médica de trabajadores</div>
          </div>
          <ChevronRight size={16} className="text-ink-400" />
        </button>
      </Card>

      {resumen.reportes?.length === 0 && (
        <EmptyState
          icon={Clock}
          title="Sin reportes en borrador"
          description="Abre uno desde la lista de horas para empezar a escanear."
          action={<Button variant="primary" onClick={() => navigate('/horas')}>Ir a Horas</Button>}
        />
      )}
    </div>
  )
}
