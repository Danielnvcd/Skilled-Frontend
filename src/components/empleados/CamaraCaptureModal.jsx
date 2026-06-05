import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, X, Check, RotateCcw, FlipHorizontal } from 'lucide-react'
import { Modal, Button } from '../ui'

// Tamaño objetivo de la imagen capturada (cuadrada — coincide con el avatar
// circular). El stream del dispositivo puede ser mayor; se recorta al centro.
const OUTPUT_SIZE = 800

// Si el label del device incluye alguna de estas palabras, asumimos cámara
// frontal y activamos el espejo por defecto. Cubre Chrome (inglés), Edge,
// Safari iOS (español) y Android Chrome.
const FRONT_REGEX = /front|user|cara|frontal|self/i

/**
 * Modal de captura de foto con cámara (web/móvil).
 *   - Pide permiso al abrir, libera el stream al cerrar.
 *   - Lista todas las cámaras disponibles (enumerateDevices) y deja al
 *     usuario elegir cuál usar.
 *   - El espejo se activa por defecto si el label parece frontal, pero el
 *     usuario puede alternarlo manualmente.
 *   - Captura un frame, lo recorta cuadrado al centro, exporta JPEG.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {(file: File) => void} onCapture  recibe el File listo para subir
 */
export default function CamaraCaptureModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState(null)
  const [mirrored, setMirrored] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [snapshot, setSnapshot] = useState(null) // dataURL del preview
  const [busy, setBusy] = useState(false)

  const stopStream = () => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  // Enumera videoinputs y, si todavía no hay uno seleccionado, fija el que
  // está activo en el stream actual (o el primero de la lista).
  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const cams = all.filter((d) => d.kind === 'videoinput')
      setDevices(cams)
      setDeviceId((current) => {
        if (current && cams.some((c) => c.deviceId === current)) return current
        const track = streamRef.current?.getVideoTracks?.()[0]
        const activeId = track?.getSettings?.().deviceId
        return activeId || cams[0]?.deviceId || null
      })
    } catch {
      // Ignorar: enumerateDevices puede fallar en algunos navegadores antes
      // del primer permiso; el listado se queda vacío y el usuario solo verá
      // el video con la cámara que el SO eligió.
    }
  }

  const startStream = async (targetId) => {
    stopStream()
    setReady(false)
    setError(null)
    try {
      const video = targetId
        ? { deviceId: { exact: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setReady(true)
      // Después del primer permiso, los labels están disponibles.
      await refreshDevices()
    } catch (e) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilítalo en el navegador.'
        : e?.name === 'NotFoundError'
          ? 'No se encontró ninguna cámara.'
          : e?.name === 'OverconstrainedError'
            ? 'La cámara seleccionada ya no está disponible.'
            : 'No se pudo acceder a la cámara.'
      setError(msg)
    }
  }

  // Reinicia el stream cuando cambia la cámara elegida y ajusta el espejo
  // automáticamente según el label.
  const handleDeviceChange = (e) => {
    const id = e.target.value
    setDeviceId(id)
    setSnapshot(null)
    const dev = devices.find((d) => d.deviceId === id)
    setMirrored(dev ? FRONT_REGEX.test(dev.label || '') : true)
    startStream(id)
  }

  // Apertura inicial / cierre del modal.
  useEffect(() => {
    if (!open) {
      stopStream()
      setSnapshot(null)
      setReady(false)
      setError(null)
      return
    }
    startStream(null)
    return stopStream
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Si los dispositivos se actualizan (p.ej. plug/unplug), reevalúa el espejo
  // por defecto del que está activo.
  useEffect(() => {
    if (!deviceId || !devices.length) return
    const dev = devices.find((d) => d.deviceId === deviceId)
    if (dev?.label) setMirrored(FRONT_REGEX.test(dev.label))
  }, [deviceId, devices])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || !ready) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    const side = Math.min(vw, vh)
    const sx = (vw - side) / 2
    const sy = (vh - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    // Si la vista está espejada (típico en cámara frontal), guardar la foto
    // también espejada para que coincida con lo que el usuario está viendo.
    if (mirrored) {
      ctx.translate(OUTPUT_SIZE, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    setSnapshot(canvas.toDataURL('image/jpeg', 0.92))
  }

  const handleRetake = () => setSnapshot(null)

  const handleConfirm = async () => {
    if (!snapshot) return
    setBusy(true)
    try {
      const res = await fetch(snapshot)
      const blob = await res.blob()
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture?.(file)
      onClose?.()
    } catch {
      toast.error('No se pudo procesar la imagen')
    } finally {
      setBusy(false)
    }
  }

  // Etiqueta legible para una cámara. Si el navegador no devolvió label
  // (Safari sin permiso previo), arma una basada en el índice.
  const labelFor = (dev, idx) => {
    if (dev.label) return dev.label
    return `Cámara ${idx + 1}`
  }

  return (
    <Modal open={open} onClose={onClose} title="Tomar foto con cámara" size="md">
      <div className="flex flex-col items-center gap-4">
        {devices.length > 0 && !snapshot && (
          <label className="w-full max-w-[360px] flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400">
              Cámara
            </span>
            <select
              value={deviceId || ''}
              onChange={handleDeviceChange}
              disabled={!ready}
              className="w-full text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 focus-ring"
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {labelFor(d, i)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="relative w-full aspect-square max-w-[360px] rounded-lg overflow-hidden bg-ink-900 ring-1 ring-ink-200 dark:ring-ink-700">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-white">
              <X size={32} className="text-red-400 mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          ) : snapshot ? (
            <img src={snapshot} alt="Captura" className="w-full h-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
            />
          )}
          {!ready && !error && !snapshot && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
              Iniciando cámara…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full justify-center">
          {snapshot ? (
            <>
              <Button
                variant="secondary"
                leftIcon={<RotateCcw size={14} />}
                onClick={handleRetake}
                disabled={busy}
              >
                Repetir
              </Button>
              <Button
                variant="primary"
                leftIcon={<Check size={14} />}
                onClick={handleConfirm}
                loading={busy}
              >
                Usar esta foto
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                leftIcon={<FlipHorizontal size={14} />}
                onClick={() => setMirrored((m) => !m)}
                disabled={!ready}
                title={mirrored ? 'Quitar espejo' : 'Activar espejo'}
              >
                {mirrored ? 'Sin espejo' : 'Espejo'}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Camera size={14} />}
                onClick={handleCapture}
                disabled={!ready}
              >
                Capturar
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
        </div>

        <p className="text-[11px] text-ink-500 dark:text-ink-400 text-center">
          La foto se recortará cuadrada al centro y se subirá como JPG.
        </p>
      </div>
    </Modal>
  )
}
