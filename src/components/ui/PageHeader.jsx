export default function PageHeader({ title, description, breadcrumb, actions, icon: Icon }) {
  return (
    <header className="mb-6 sm:mb-8">
      {breadcrumb && (
        <nav className="text-xs text-ink-500 dark:text-ink-400 mb-2">{breadcrumb}</nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-100 dark:ring-brand-800/60">
              <Icon size={20} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-ink-900 dark:text-ink-100 tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400 max-w-2xl">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
