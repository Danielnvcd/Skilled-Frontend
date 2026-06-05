import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { Modal, Button } from '../ui'
import CredencialAsistencia from './CredencialAsistencia'
import { descargarCredenciales } from '../../utils/descargarCredenciales'

// Breakpoints alineados con la escala global de index.css:
//   1280–1535 → html=14px  · 1536–1919 → html=15px  · ≥1920 → html=16px
// Como el modal `max-w-2xl` (42rem) se reduce con el font-size del <html>,
// la credencial (medida en mm físicos) debe bajar de escala en laptops
// pequeñas (1366×768) para no desbordar el modal.
function useScale() {
  const [scale, setScale] = useState(1.7)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 380) setScale(0.9)
      else if (width < 450) setScale(1.1)
      else if (width < 640) setScale(1.3)
      else if (width < 1280) setScale(1.6)
      else if (width < 1536) setScale(1.5) // laptops 1366×768 (html=14px)
      else if (width < 1920) setScale(1.7) // 1080p (html=15px)
      else setScale(1.9)                   // monitores grandes (html=16px)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return scale
}

/**
 * Modal compartido que muestra la credencial de asistencia (frente + reverso)
 * a tamaño 2× para apreciar detalles, con botón de imprimir.
 *
 * El trabajador debe traer al menos: id, no_empleado, nombre_completo, area,
 * puesto, foto_perfil, tipo_sangre, contacto_emergencia, numero_contacto_emerg,
 * qr_code. Si falta `qr_code`, el modal igual abre pero la credencial muestra
 * "Sin QR" — el caller debe haber generado el QR antes si quiere ver el code.
 */
export default function CredencialPreviewModal({
  open,
  onClose,
  trabajador,
  empresa = 'SKILLED',
  logoUrl = '/logo.png',
}) {
  const [side, setSide] = useState('frente')
  const [downloading, setDownloading] = useState(false)
  const previewScale = useScale()

  useEffect(() => {
    if (open) setSide('frente')
  }, [open, trabajador?.id])

  if (!trabajador) return null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await descargarCredenciales([trabajador], { empresa, logoUrl })
      toast.success('Credenciales descargadas (frente y reverso)')
    } catch {
      toast.error('Error al generar las imágenes')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Credencial de asistencia" size="lg">
      <div className="flex flex-col items-center gap-4">
        {/* Toggle frente / reverso */}
        <div className="inline-flex items-center rounded-md bg-ink-100 dark:bg-ink-800 p-0.5 ring-1 ring-ink-200 dark:ring-ink-700">
          {['frente', 'reverso'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors capitalize ${
                side === s
                  ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 shadow-sm'
                  : 'text-ink-600 dark:text-ink-300 hover:text-ink-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Credencial escalada dinámicamente para que se adapte al modal */}
        <div className="flex justify-center py-4 bg-ink-50 dark:bg-ink-800/40 rounded-lg w-full overflow-x-auto overflow-y-hidden">
          <CredencialAsistencia
            trabajador={trabajador}
            empresa={empresa}
            logoUrl={logoUrl}
            side={side}
            scale={previewScale}
          />
        </div>

        <p className="text-[11px] text-ink-500 dark:text-ink-400 text-center">
          Tamaño real: <strong>85.6 × 53.98 mm</strong> (formato CR80 — tarjeta NFC). PNG a 300 DPI.
        </p>

        <div className="flex gap-2 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            leftIcon={<Download size={14} />}
            loading={downloading}
            onClick={handleDownload}
          >
            Descargar credencial
          </Button>
        </div>
      </div>
    </Modal>
  )
}
