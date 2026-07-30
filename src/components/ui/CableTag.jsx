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
 * El calibre se muestra tal cual lo capturaron (`12`, `2/0`, `500 kcmil`) SIN
 * pegarle "mm²/AWG": el dato no trae unidad, así que el sufijo no desambiguaba
 * nada y alargaba la etiqueta. La unidad vive en el label del formulario
 * ("Tamaño (mm²/AWG)") y en el tooltip de aquí.
 *
 * Props: `tipo`, `calibre` (strings). Devuelve null si ambos están vacíos.
 * `size='sm'` (default) o `'xs'` para espacios apretados.
 *
 * `variant`:
 *   'chip'   (default) — ficha con borde e ícono. Para el modal de detalle,
 *                        donde el dato va suelto y necesita delimitarse.
 *   'inline'           — texto plano, sin caja ni ícono. Para las tarjetas del
 *                        catálogo, donde va dentro de una pila de líneas
 *                        (código / descripción / categoría / marca) y una caja
 *                        rompería esa lectura vertical.
 */
export default function CableTag({ tipo, calibre, size = 'sm', variant = 'chip', className = '' }) {
  const t = (tipo || '').trim()
  const c = (calibre || '').trim()
  if (!t && !c) return null

  if (variant === 'inline') {
    // Mismas clases que la línea de `marca` en las tarjetas, para que se lea
    // como un dato más de la ficha y no como un elemento aparte.
    return (
      <span
        title="Cable — Tipo · Tamaño (mm²/AWG)"
        className={`block truncate text-[11px] font-medium text-ink-700 dark:text-ink-300 ${className}`}
      >
        {t}
        {t && c && <span className="mx-1 text-ink-400 dark:text-ink-600" aria-hidden="true">·</span>}
        {c && (
          <>
            <span className="font-mono tabular-nums">{c}</span>
            <span className="ml-1 font-normal text-ink-400 dark:text-ink-500">mm²/AWG</span>
          </>
        )}
      </span>
    )
  }

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
      {t && c && <span className="text-ink-400 dark:text-ink-600" aria-hidden="true">·</span>}
      {c && (
        <span className="font-mono tabular-nums text-ink-900 dark:text-ink-100">
          {c}
          <span className="ml-1 font-sans font-normal text-ink-500 dark:text-ink-400">mm²/AWG</span>
        </span>
      )}
    </span>
  )
}
