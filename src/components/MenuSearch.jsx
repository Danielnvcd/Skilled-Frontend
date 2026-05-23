import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'
import { flattenMenu } from '../config/menus'

// Normaliza: minúsculas + sin acentos. Para que "pren" matchee "Prenómina".
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export default function MenuSearch() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const items = useMemo(() => flattenMenu(user?.role, { isMobile }), [user?.role, isMobile])

  const matches = useMemo(() => {
    const term = norm(q.trim())
    if (!term) return items
    return items.filter((it) =>
      norm(it.label).includes(term) || norm(it.group).includes(term)
    )
  }, [items, q])

  // Atajo de teclado: Ctrl+K / Cmd+K para focusear el buscador.
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Cerrar dropdown al hacer click fuera.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Reset selección al cambiar el query.
  useEffect(() => { setActiveIdx(0) }, [q])

  const go = (item) => {
    if (!item) return
    setOpen(false)
    setQ('')
    navigate(item.path)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(matches.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(matches[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative hidden md:block ml-1 w-72 lg:w-96">
      <div className="flex items-center gap-2 px-3 h-9 rounded-md bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 focus-within:border-brand-400 focus-within:bg-white dark:focus-within:bg-ink-900 transition-colors">
        <Search size={15} className="text-ink-400 dark:text-ink-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar sección..."
          className="flex-1 bg-transparent text-sm text-ink-800 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none"
        />
        <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] text-ink-400 dark:text-ink-500 font-mono">⌘ K</kbd>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-ink-500 dark:text-ink-400">
              Sin resultados para "{q}"
            </div>
          ) : (
            <>
              {/* Agrupar por sección padre para no perder contexto */}
              {groupByGroup(matches).map(({ group, items: gItems }) => (
                <div key={group}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                    {group}
                  </div>
                  {gItems.map((item) => {
                    const Icon = item.icon
                    const globalIdx = matches.indexOf(item)
                    const isActive = globalIdx === activeIdx
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onMouseEnter={() => setActiveIdx(globalIdx)}
                        onClick={() => go(item)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors focus-ring ${
                          isActive
                            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100'
                            : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800/60'
                        }`}
                      >
                        {Icon && <Icon size={15} className={isActive ? 'text-brand-600 dark:text-brand-300' : 'text-ink-500 dark:text-ink-400'} />}
                        <span className="flex-1">{item.label}</span>
                        {isActive && <CornerDownLeft size={12} className="text-ink-400" />}
                      </button>
                    )
                  })}
                </div>
              ))}
              <div className="px-3 py-1.5 border-t border-ink-100 dark:border-ink-800 text-[10px] text-ink-400 dark:text-ink-500 flex items-center gap-3">
                <span><kbd className="font-mono">↑↓</kbd> moverse</span>
                <span><kbd className="font-mono">↵</kbd> abrir</span>
                <span><kbd className="font-mono">esc</kbd> cerrar</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function groupByGroup(items) {
  const map = new Map()
  for (const it of items) {
    const arr = map.get(it.group) || []
    arr.push(it)
    map.set(it.group, arr)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
}
