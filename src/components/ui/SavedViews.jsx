import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkPlus, X, Check } from 'lucide-react'
import { getSavedViews, saveView, deleteView, sameParams } from '../../utils/savedViews'

// Chips de vistas guardadas (filtros + orden con nombre), estilo "Favoritos"
// de Odoo. Componente controlado por la página dueña de la lista:
//
//   <SavedViews
//     listKey="empleados"
//     current={{ q, sort, dir }}          // params que componen la vista
//     defaults={{ q: '', sort: '', dir: '' }} // estado "sin filtros"
//     onApply={(params) => ...}            // aplicar una vista (o defaults al deseleccionar)
//   />
//
// La persistencia es localStorage por listKey (ver utils/savedViews.js).
// No guarda `page`: una vista es el "qué", no el "dónde me quedé".
export default function SavedViews({ listKey, current, defaults, onApply }) {
  const [views, setViews] = useState(() => getSavedViews(listKey))
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { setViews(getSavedViews(listKey)) }, [listKey])
  useEffect(() => { if (saving) inputRef.current?.focus() }, [saving])

  const esDefault = sameParams(current, defaults)
  const activa = views.find((v) => sameParams(v.params, current))

  const onGuardar = (e) => {
    e.preventDefault()
    const next = saveView(listKey, nombre, current)
    setViews(next)
    setSaving(false)
    setNombre('')
  }

  const onBorrar = (e, id) => {
    e.stopPropagation()
    setViews(deleteView(listKey, id))
  }

  // Nada que mostrar: sin vistas guardadas y sin filtros activos que guardar.
  if (views.length === 0 && esDefault) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <Bookmark size={13} className="text-ink-400 dark:text-ink-500" aria-hidden />
      {views.map((v) => {
        const isActive = activa?.id === v.id
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onApply(isActive ? { ...defaults } : { ...v.params })}
            title={isActive ? 'Quitar esta vista' : 'Aplicar esta vista'}
            className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-ring ${
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 text-brand-800 dark:text-brand-200'
                : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-600'
            }`}
          >
            {v.name}
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Eliminar vista ${v.name}`}
              onClick={(e) => onBorrar(e, v.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 dark:hover:text-red-400"
            >
              <X size={12} />
            </span>
          </button>
        )
      })}
      {!esDefault && !activa && (
        saving ? (
          <form onSubmit={onGuardar} className="inline-flex items-center gap-1">
            <input
              ref={inputRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSaving(false); setNombre('') } }}
              placeholder="Nombre de la vista"
              className="h-7 w-40 rounded-full border border-brand-300 dark:border-brand-700 bg-white dark:bg-ink-900 px-2.5 text-xs text-ink-800 dark:text-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              maxLength={40}
            />
            <button
              type="submit"
              disabled={!nombre.trim()}
              aria-label="Guardar vista"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 disabled:opacity-40 focus-ring"
            >
              <Check size={14} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 dark:border-ink-600 px-2.5 py-1 text-xs font-medium text-ink-500 dark:text-ink-400 hover:text-brand-700 dark:hover:text-brand-300 hover:border-brand-300 dark:hover:border-brand-700 transition-colors focus-ring"
          >
            <BookmarkPlus size={12} /> Guardar vista
          </button>
        )
      )}
    </div>
  )
}
