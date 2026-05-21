export function Table({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-card dark:shadow-none overflow-hidden ${className}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead className="bg-ink-50 dark:bg-ink-950/40 border-b border-ink-200 dark:border-ink-800">
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({ children, className = '', align = 'left' }) {
  return (
    <th className={`px-4 py-3 text-${align} text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

export function TBody({ children, className = '' }) {
  return <tbody className={`divide-y divide-ink-100 dark:divide-ink-800 ${className}`}>{children}</tbody>
}

export function TR({ children, className = '', ...props }) {
  return (
    <tr className={`hover:bg-ink-50/60 dark:hover:bg-ink-800/40 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function TD({ children, className = '', align = 'left' }) {
  return (
    <td className={`px-4 py-3 text-${align} text-ink-700 dark:text-ink-300 align-middle ${className}`}>
      {children}
    </td>
  )
}
