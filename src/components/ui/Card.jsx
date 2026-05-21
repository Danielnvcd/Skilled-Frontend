export function Card({ className = '', children, padded = true, as: As = 'div', ...props }) {
  return (
    <As
      className={`bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-card dark:shadow-none ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </As>
  )
}

export function CardHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-ink-200 dark:border-ink-800 pb-4 mb-5 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100 truncate">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

export default Card
