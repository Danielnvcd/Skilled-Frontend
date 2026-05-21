import { Inbox } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Sin información',
  description = 'No hay datos para mostrar en este momento.',
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      <div className="h-12 w-12 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-400 mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{title}</h3>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
