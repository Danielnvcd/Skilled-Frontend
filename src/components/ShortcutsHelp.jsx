import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { Modal } from './ui'
import { useAuth } from '../context/AuthContext'
import { SHORTCUTS } from '../hooks/useGlobalShortcuts'

// Overlay de ayuda de atajos, abierto con `?` (estilo GitHub/Linear).
// Lista los chords `g + letra` del rol actual (la misma tabla que ejecuta
// useGlobalShortcuts) más los atajos globales fijos. Montado una vez en
// Layout; escucha su propia tecla y se ignora cuando el foco está en un
// input para no robar el `?` a quien escribe texto.

const LABELS = {
  '/horas/movil': 'Asistencia QR (escanear)',
  '/empleados': 'Empleados',
  '/prenomina': 'Prenómina',
  '/horas': 'Horas',
  '/bitacora': 'Bitácora',
  '/directorio': 'Directorio',
  '/proyectos': 'Proyectos',
  '/inventario/catalogo': 'Catálogo de inventario',
  '/usuarios': 'Usuarios',
  '/credenciales': 'Credenciales',
  '/proyecto-total': 'Proyecto total',
  '/metricas': 'Métricas',
  '/mis-proyectos': 'Mis proyectos',
  '/ficha': 'Ficha técnica',
  '/inventario/solicitudes': 'Solicitudes de material',
  '/inventario/movimientos': 'Movimientos de inventario',
  '/inventario/tomas': 'Tomas físicas',
  '/inventario/etiquetas': 'Etiquetas',
  '/inventario/herramientas': 'Herramientas',
  '/inventario/bajo-minimo': 'Bajo mínimo',
  '/inventario/reportes': 'Reportes de inventario',
  '/inventario/mis-pedidos': 'Mis pedidos',
  '/inventario/mis-herramientas': 'Mis herramientas',
}

function isEditableTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function Key({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded border border-ink-300 dark:border-ink-600 bg-ink-50 dark:bg-ink-800 text-[11px] font-semibold font-mono text-ink-700 dark:text-ink-200 shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      {children}
    </kbd>
  )
}

export default function ShortcutsHelp() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const chords = Object.entries(SHORTCUTS[user?.role] || {})
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={
        <span className="inline-flex items-center gap-2">
          <Keyboard size={16} /> Atajos de teclado
        </span>
      }
    >
      <div className="space-y-5">
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">
            Globales
          </h4>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-700 dark:text-ink-200">Buscador y paleta de comandos</span>
              <span className="flex items-center gap-1"><Key>{isMac ? '⌘' : 'Ctrl'}</Key><Key>K</Key></span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-700 dark:text-ink-200">Esta ayuda</span>
              <Key>?</Key>
            </li>
          </ul>
        </section>

        {chords.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">
              Ir a — presiona <Key>g</Key> y luego la letra
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {chords.map(([letra, ruta]) => (
                <li key={letra} className="flex items-center justify-between gap-3">
                  <span className="text-ink-700 dark:text-ink-200 truncate">{LABELS[ruta] || ruta}</span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    <Key>g</Key><Key>{letra}</Key>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-ink-400 dark:text-ink-500">
          Los atajos no se activan mientras escribes en un campo de texto.
        </p>
      </div>
    </Modal>
  )
}
