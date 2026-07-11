import { Cable } from 'lucide-react'

/**
 * Etiqueta técnica de CABLE (Tipo + Tamaño mm²/AWG).
 *
 * A propósito NO usa el componente Badge: se ve como una ficha técnica en cobre
 * con esquinas suaves (rounded-md) e ícono de cable, para distinguirse de los
 * badges de estado (píldoras rounded-full como "En compra"/"Ordenada").
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
      className={`inline-flex items-center rounded-md border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 font-medium text-amber-800 dark:text-amber-200 ${dims.pad} ${className}`}
    >
      <Cable size={dims.icon} strokeWidth={2} className="text-amber-600 dark:text-amber-400 shrink-0" />
      {t && <span className="font-semibold">{t}</span>}
      {c && (
        <span className="font-mono tabular-nums text-amber-900 dark:text-amber-100">
          {c}
          <span className="ml-0.5 font-sans text-amber-500 dark:text-amber-400/80">mm²/AWG</span>
        </span>
      )}
    </span>
  )
}
