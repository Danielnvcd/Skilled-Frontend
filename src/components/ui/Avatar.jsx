const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export default function Avatar({ name = '', size = 'md', src, className = '' }) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-800 dark:text-brand-200 font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 overflow-hidden ${sizes[size]} ${className}`}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initial}
    </span>
  )
}
