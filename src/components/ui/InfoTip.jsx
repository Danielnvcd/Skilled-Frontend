import { Info } from 'lucide-react'

/**
 * Ícono de información con tooltip al pasar el mouse (o al enfocar con teclado).
 * Sin dependencias: posicionamiento por CSS (group-hover). Útil para explicar
 * "cómo se hace" junto a títulos/campos sin saturar la interfaz.
 *
 *   <InfoTip text="Explicación corta de cómo funciona." />
 *   <InfoTip text="..." placement="bottom" />   // para elementos pegados al borde superior
 */
export default function InfoTip({ text, placement = 'top', size = 13, className = '' }) {
  const pos = placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
  return (
    <span className={`relative inline-flex group align-middle ${className}`}>
      <Info
        size={size}
        tabIndex={0}
        role="button"
        aria-label="Más información"
        className="text-ink-400 hover:text-brand-500 focus:text-brand-500 cursor-help outline-none"
      />
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 ${pos} w-max max-w-[260px] whitespace-normal rounded-md bg-ink-900 dark:bg-ink-700 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {text}
      </span>
    </span>
  )
}
