import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, FileWarning, IdCard, Wallet, CalendarClock, ChevronRight,
} from 'lucide-react'
import { obtenerAlertas } from '../api/dashboard'
import { useResource } from '../hooks/useResource'

// Icono por categoría. La clave coincide con `key` que devuelve el backend.
const ICONO_CAT = {
  docs_por_vencer: FileWarning,
  credenciales_por_vencer: IdCard,
  prestamos_liquidados: Wallet,
  ajustes_vencidos: CalendarClock,
}

// Mapa tone → clases Tailwind. Mantener los nombres completos (no string
// interpolation con `bg-${tone}-50`) para que Tailwind no purgue las clases.
const TONE_CLASS = {
  amber: {
    chip: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-500',
  },
  red: {
    chip: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    badge: 'bg-red-500',
  },
  blue: {
    chip: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-500',
  },
  violet: {
    chip: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-500',
  },
}

function toneOf(tone) {
  return TONE_CLASS[tone] || TONE_CLASS.amber
}

export default function AlertasBell() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  // 60s de caché es suficiente: las alertas son agregados de cosas que
  // cambian lento. Se invalida con los eventos de los recursos subyacentes
  // para que el badge reaccione cuando un admin termina de actuar sobre
  // alguno de ellos sin esperar al próximo fetch.
  const { data: rawData, loading, refetch } = useResource(
    'alertas',
    obtenerAlertas,
    {
      staleMs: 60_000,
      invalidateOn: [
        'empleado:changed',
        'credencial:changed',
        'prestamo:changed',
        'ajuste:changed',
      ],
    },
  )
  const data = rawData ?? { total: 0, categorias: [] }
  const total = data.total || 0

  // Cerrar dropdown al hacer click fuera.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const goTo = (url) => {
    setOpen(false)
    navigate(url)
  }

  // Badge: hasta 99, después 99+. Solo se muestra si hay algo.
  const badgeText = total > 99 ? '99+' : String(total)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) refetch() }}
        aria-label={`Alertas pendientes${total ? `: ${total}` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 focus-ring transition-colors"
        title={total ? `${total} alerta${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'}` : 'Sin alertas'}
      >
        <AlertTriangle size={18} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alertas"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[360px] max-w-[calc(100vw-32px)] bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto"
        >
          <header className="sticky top-0 bg-white dark:bg-ink-900 border-b border-ink-100 dark:border-ink-800 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Alertas {total > 0 ? `(${total})` : ''}
            </span>
            {loading && <span className="text-[10px] text-ink-400">cargando…</span>}
          </header>

          {total === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              Todo al día. Sin pendientes accionables.
            </div>
          ) : (
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.categorias.filter((c) => c.count > 0).map((c) => {
                const Icon = ICONO_CAT[c.key] || AlertTriangle
                const tone = toneOf(c.tone)
                return (
                  <section key={c.key}>
                    <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
                      <span className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${tone.chip}`}>
                        <Icon size={12} />
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 flex-1">
                        {c.label}
                      </span>
                      <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white ${tone.badge}`}>
                        {c.count}
                      </span>
                    </div>
                    {c.items.map((it, idx) => (
                      <button
                        key={`${c.key}-${idx}`}
                        type="button"
                        onClick={() => goTo(it.url)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800/60 transition-colors"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-ink-900 dark:text-ink-100">{it.title}</span>
                          {it.subtitle && (
                            <span className="block text-[11px] text-ink-500 dark:text-ink-400 truncate">
                              {it.subtitle}
                            </span>
                          )}
                        </span>
                        <ChevronRight size={14} className="text-ink-400 flex-shrink-0" />
                      </button>
                    ))}
                    {c.count > c.items.length && (
                      <div className="px-3 pb-2 text-[11px] text-ink-500 dark:text-ink-400">
                        … y {c.count - c.items.length} más
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
