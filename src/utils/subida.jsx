/**
 * Progreso de subida + mensaje de éxito, en un solo mecanismo.
 *
 * Envuelve cualquier llamada de subida y se encarga del feedback:
 *   - archivo chico  → no muestra barra (terminaría antes de verse) y suelta
 *                      directo el toast de éxito
 *   - archivo grande → toast flotante con el nombre y una barra que avanza,
 *                      que al terminar se reemplaza por el de éxito
 *
 * Vive aquí y no dentro de cada pantalla a propósito: así documentos, fotos de
 * perfil, fotos de herramienta y cualquier subida futura se comportan igual sin
 * tocar el layout de ninguna.
 *
 * Uso:
 *   await subirConProgreso(
 *     (onProgress) => subirDocumento(id, { file }, onProgress),
 *     { archivo: file, exito: 'Documento subido' },
 *   )
 */
import toast from 'react-hot-toast'
import { Upload } from 'lucide-react'

// Debajo de 1 MB la subida es prácticamente instantánea en cualquier conexión
// decente: una barra que parpadea medio segundo estorba más de lo que informa.
const MIN_BYTES_BARRA = 1024 * 1024

function fmtTamano(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Toast con barra. Mismo lenguaje visual que la barra de "Sincronizar". */
function ToastSubida({ nombre, tamano, pct }) {
  return (
    <div className="pointer-events-auto w-80 max-w-[90vw] rounded-lg border border-ink-200 bg-white p-3 shadow-lg dark:border-ink-800 dark:bg-ink-900">
      <div className="flex items-center gap-2">
        <Upload size={15} className="flex-shrink-0 text-brand-600 dark:text-brand-300" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 dark:text-ink-100"
           title={nombre}>
          {nombre || 'Subiendo archivo'}
        </p>
        <span className="flex-shrink-0 text-xs tabular-nums text-ink-500 dark:text-ink-400">
          {pct}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div
          className="h-full bg-brand-600 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
        {pct >= 100 ? 'Procesando en el servidor…' : `Subiendo ${fmtTamano(tamano)}`}
      </p>
    </div>
  )
}

/**
 * @param ejecutar  (onProgress) => Promise — recibe un callback de progreso que
 *                  hay que pasarle a la función de API correspondiente.
 * @param archivo   el File, para el nombre y decidir si toca barra.
 * @param exito     texto del toast final.
 */
export async function subirConProgreso(ejecutar, { archivo, exito = 'Archivo subido' } = {}) {
  const tamano = archivo?.size || 0

  if (tamano < MIN_BYTES_BARRA) {
    const resultado = await ejecutar()
    toast.success(exito)
    return resultado
  }

  const id = `subida-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const pintar = (pct) => toast.custom(
    <ToastSubida nombre={archivo?.name} tamano={tamano} pct={pct} />,
    { id, duration: Infinity },
  )

  pintar(0)
  try {
    // Al llegar a 100% el archivo ya viajó pero el servidor sigue trabajando
    // (antivirus, conversión, subida a R2): el toast se queda en "Procesando"
    // hasta que la promesa resuelve, en vez de mentir diciendo que terminó.
    const resultado = await ejecutar((pct) => pintar(pct))
    toast.dismiss(id)
    toast.success(exito)
    return resultado
  } catch (err) {
    // El toast de error lo pone el caller, que sabe describir el fallo.
    toast.dismiss(id)
    throw err
  }
}

/** Traduce el evento de axios a un entero 0-100 para `onUploadProgress`. */
export function progresoAxios(onProgress) {
  if (!onProgress) return undefined
  return (e) => {
    if (!e.total) return
    onProgress(Math.min(100, Math.round((e.loaded * 100) / e.total)))
  }
}
