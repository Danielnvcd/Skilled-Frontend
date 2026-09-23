/**
 * Indicador de estado de las pantallas de lectores: un cuadro pequeño de color
 * y el texto en el mismo tono. Sin fondo ni forma de píldora, para que se lea
 * como dato y no como adorno.
 */
const TONOS = {
  success: { cuadro: 'bg-emerald-500', texto: 'text-emerald-700 dark:text-emerald-400' },
  warning: { cuadro: 'bg-amber-500', texto: 'text-amber-700 dark:text-amber-400' },
  danger: { cuadro: 'bg-red-500', texto: 'text-red-700 dark:text-red-400' },
  info: { cuadro: 'bg-sky-500', texto: 'text-sky-700 dark:text-sky-400' },
  brand: { cuadro: 'bg-brand-600', texto: 'text-brand-800 dark:text-brand-300' },
  neutral: { cuadro: 'bg-ink-400', texto: 'text-ink-600 dark:text-ink-400' },
}

// Acepta `tono` o `tone` (el nombre de la prop en <Badge>, al que reemplaza).
export default function Estado({ tono, tone, children, className = '', title }) {
  const t = TONOS[tono || tone] || TONOS.neutral
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${t.texto} ${className}`}
          title={title}>
      <span className={`h-2 w-2 flex-shrink-0 rounded-[2px] ${t.cuadro}`} aria-hidden />
      {children}
    </span>
  )
}
