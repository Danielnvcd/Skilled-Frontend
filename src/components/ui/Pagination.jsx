import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Pagination controls for backend-paginated lists.
 * Props mirror the backend's PagedResponse shape:
 *   - page         (0-based)
 *   - totalPages
 *   - totalElements
 *   - size         (rows per page, used only for the "Mostrando X–Y de N" label)
 *   - onChange(newPage)
 *
 * Skips rendering entirely if there is one page or less.
 */
export default function Pagination({ page, totalPages, totalElements, size, onChange }) {
  if (!totalPages || totalPages <= 1) return null

  const current = page + 1
  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min(totalElements, (page + 1) * size)

  const go = (target) => {
    if (target < 0 || target >= totalPages || target === page) return
    onChange(target)
  }

  return (
    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-ink-600 dark:text-ink-300">
      <span>
        Mostrando <span className="font-medium text-ink-900 dark:text-ink-100">{from}–{to}</span> de{' '}
        <span className="font-medium text-ink-900 dark:text-ink-100">{totalElements}</span>
      </span>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page === 0}
          className="h-8 px-2 inline-flex items-center gap-1 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-50 dark:hover:bg-ink-700 focus-ring"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <span className="px-3 text-xs tabular-nums">
          Página <span className="font-semibold text-ink-900 dark:text-ink-100">{current}</span> de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages - 1}
          className="h-8 px-2 inline-flex items-center gap-1 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-50 dark:hover:bg-ink-700 focus-ring"
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
