import { useState } from 'react'
import toast from 'react-hot-toast'
import { MessageSquareText, Send, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, Skeleton } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { useResource } from '../../hooks/useResource'
import { listarNotas, crearNota, eliminarNota } from '../../api/trabajadores'

// Notas internas de la ficha del empleado (el "chatter" estilo Odoo).
// Tiempo real: el backend emite `nota:changed` en cada alta/borrado; el
// invalidateOn refresca este panel en cualquier pestaña/usuario que tenga la
// misma ficha abierta — escribes una nota y tu compañero la ve aparecer.

function fmtFechaHora(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return iso }
}

export default function NotasPanel({ trabajadorId }) {
  const { user, isAdmin } = useAuth()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [borrandoId, setBorrandoId] = useState(null)

  const { data, loading, refetch } = useResource(
    ['empleado-notas', { id: trabajadorId }],
    () => listarNotas(trabajadorId),
    { staleMs: 30_000, invalidateOn: ['nota:changed'] },
  )
  const notas = data ?? []

  const onEnviar = async (e) => {
    e.preventDefault()
    const limpio = texto.trim()
    if (!limpio || enviando) return
    setEnviando(true)
    try {
      await crearNota(trabajadorId, limpio)
      setTexto('')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo guardar la nota')
    } finally {
      setEnviando(false)
    }
  }

  const onBorrar = async (nota) => {
    setBorrandoId(nota.id)
    try {
      await eliminarNota(trabajadorId, nota.id)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar')
    } finally {
      setBorrandoId(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <MessageSquareText size={15} className="text-ink-400 dark:text-ink-500" />
            Notas internas
            {notas.length > 0 && (
              <span className="text-xs font-normal text-ink-400 dark:text-ink-500">({notas.length})</span>
            )}
          </span>
        }
      />

      <form onSubmit={onEnviar} className="flex gap-2 mb-4">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe una nota… (solo visible para administración)"
          maxLength={2000}
          className="flex-1 h-9 px-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
        />
        <Button type="submit" variant="primary" size="sm" loading={enviando} disabled={!texto.trim() || enviando}>
          <Send size={14} />
        </Button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : notas.length === 0 ? (
        <p className="text-xs text-ink-400 dark:text-ink-500 italic py-2">
          Sin notas todavía. Útil para acuerdos, contexto o pendientes del empleado.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
          {notas.map((n) => {
            const puedeBorrar = isAdmin || n.user_id === user?.id
            return (
              <li
                key={n.id}
                className="group rounded-lg border border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/30 px-3 py-2"
              >
                <p className="text-sm text-ink-800 dark:text-ink-200 whitespace-pre-wrap break-words">{n.texto}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400 dark:text-ink-500">
                  <span className="font-medium text-ink-500 dark:text-ink-400">{n.autor || '—'}</span>
                  <span>·</span>
                  <span>{fmtFechaHora(n.created_at)}</span>
                  {puedeBorrar && (
                    <button
                      type="button"
                      onClick={() => onBorrar(n)}
                      disabled={borrandoId === n.id}
                      title="Eliminar nota"
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-ink-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
