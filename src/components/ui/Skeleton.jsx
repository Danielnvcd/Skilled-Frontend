export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`rounded-md bg-gradient-to-r from-ink-100 via-ink-200 to-ink-100 dark:from-ink-800 dark:via-ink-700 dark:to-ink-800 bg-[length:800px_100%] animate-shimmer ${className}`}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}
