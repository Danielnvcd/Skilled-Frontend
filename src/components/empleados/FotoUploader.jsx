import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Upload } from 'lucide-react'
import { Button } from '../ui'
import AvatarFoto from './AvatarFoto'
import CamaraCaptureModal from './CamaraCaptureModal'
import { subirFoto } from '../../api/trabajadores'

/**
 * Wrapper que muestra la foto actual + permite subir una nueva (archivo o cámara).
 * - En "nuevo" (sin id): solo permite seleccionar el File para enviarlo con el create.
 * - En "editar": sube directamente al endpoint y refresca.
 */
export default function FotoUploader({
  trabajadorId,
  hasFoto,
  name,
  onFileSelected,   // callback (file|null) en modo nuevo
  onFotoActualizada, // callback () al subir en modo editar
}) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [cacheBuster, setCacheBuster] = useState(0)
  const [camOpen, setCamOpen] = useState(false)

  // Validación + flujo de upload compartido por archivo y cámara.
  const processFile = async (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Solo JPG o PNG')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Máx. 5 MB')
      return
    }
    const blobUrl = URL.createObjectURL(file)
    setPreview(blobUrl)

    if (trabajadorId) {
      setUploading(true)
      try {
        await subirFoto(trabajadorId, file)
        toast.success('Foto actualizada')
        setCacheBuster((x) => x + 1)
        onFotoActualizada?.()
      } catch (err) {
        toast.error(err.response?.data?.error || 'Error al subir foto')
        setPreview(null)
      } finally {
        setUploading(false)
      }
    } else {
      onFileSelected?.(file)
    }
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // permite volver a seleccionar el mismo archivo
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {preview ? (
        <img
          src={preview}
          alt="Vista previa"
          className="h-32 w-32 rounded-full object-cover ring-2 ring-brand-200 dark:ring-brand-800"
        />
      ) : (
        // key fuerza remount cuando subimos una nueva foto (cache busting del hook)
        <div key={cacheBuster}>
          <AvatarFoto id={trabajadorId} hasFoto={hasFoto} name={name} size="xl" thumb={false} />
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onPick} />
      <div className="flex gap-2 flex-wrap justify-center">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={uploading ? null : <Upload size={14} />}
          onClick={() => inputRef.current?.click()}
          loading={uploading}
          disabled={uploading}
        >
          {hasFoto || preview ? 'Cambiar archivo' : 'Subir archivo'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leftIcon={<Camera size={14} />}
          onClick={() => setCamOpen(true)}
          disabled={uploading}
        >
          Tomar foto
        </Button>
      </div>
      <p className="text-[11px] text-ink-500 text-center max-w-[200px]">
        JPG o PNG, máx 5 MB. Se generará un thumbnail automáticamente.
      </p>

      <CamaraCaptureModal
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onCapture={processFile}
      />
    </div>
  )
}
