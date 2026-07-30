import { Cable } from 'lucide-react'

/**
 * Etiqueta técnica de CABLE (Tipo + Tamaño mm²/AWG).
 *
 * A propósito NO usa el componente Badge: se ve como una ficha técnica neutra
 * con esquinas suaves (rounded-md) e ícono de cable, para distinguirse de los
 * badges de estado (píldoras rounded-full como "En compra"/"Ordenada").
 *
 * Paleta neutra (ink) con texto negro/casi-negro — sin el ámbar/naranja previo,
 * para que se lea limpio en el catálogo.
 *
 * Props: `tipo`, `calibre` (strings). Devuelve null si ambos están vacíos.
 * `size='sm'` (default) o `'xs'` para espacios apretados.
 */
export default function CableTag({ tipo, calibre, size = 'sm', className = '' }) {
  const t = (tipo || '').trim()
  const c = (calibre || '').trim()
  if (!t && !c) return null

  const dims = size === 'xs'
    ? { pad: 'px-1.5 py-px text-[10px] gap-1', icon: 11 }
    : { pad: 'px-2 py-0.5 text-[11px] gap-1.5', icon: 12 }

  return (
    <span
      title="Cable — Tipo · Tamaño (mm²/AWG)"
      className={`inline-flex items-center rounded-md border border-ink-300 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/60 font-medium text-ink-900 dark:text-ink-100 ${dims.pad} ${className}`}
    >
      <Cable size={dims.icon} strokeWidth={2} className="text-ink-500 dark:text-ink-400 shrink-0" />
      {t && <span className="font-semibold">{t}</span>}
      {c && (
        <span className="font-mono tabular-nums text-ink-900 dark:text-ink-100">
          {c}
          <span className="ml-0.5 font-sans text-ink-400 dark:text-ink-500">mm²/AWG</span>
        </span>
      )}
    </span>
  )
}
