import { forwardRef } from 'react'

const baseField =
  'block w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 disabled:text-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20 dark:disabled:bg-ink-900/50 dark:disabled:text-ink-500'

export function FieldShell({ label, hint, error, required, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5 tracking-wide">
          {label} {required && <span className="text-red-500 dark:text-red-400">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, leftIcon, rightIcon, className = '', wrapperClassName = '', id, ...props },
  ref
) {
  const inputId = id || props.name
  const hasIcon = !!leftIcon || !!rightIcon
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <div className={hasIcon ? 'relative' : ''}>
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400 dark:text-ink-500">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${baseField} h-10 ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60 dark:focus:border-red-400' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 dark:text-ink-500">
            {rightIcon}
          </span>
        )}
      </div>
    </FieldShell>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, rows = 3, className = '', wrapperClassName = '', id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`${baseField} py-2 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60' : ''} ${className}`}
        {...props}
      />
    </FieldShell>
  )
})

export const Select = forwardRef(function Select(
  { label, hint, error, required, className = '', wrapperClassName = '', children, id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={`${baseField} h-10 pr-9 appearance-none ${error ? 'border-red-400 focus:border-red-500 dark:border-red-500/60' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 dark:text-ink-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
      </div>
    </FieldShell>
  )
})

export default Input
