import { Component } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

/**
 * Frontera de errores de render.
 *
 * Sin esto, una excepción durante el render (el clásico `undefined.map` cuando
 * el backend devuelve un campo que no esperábamos) desmonta el árbol ENTERO:
 * el usuario se queda con la pantalla en blanco, sin menú, sin forma de volver
 * y sin ninguna pista de qué pasó. React lo hace a propósito — prefiere no
 * renderizar nada antes que renderizar algo inconsistente— y la única manera de
 * interceptarlo es un componente de clase con `getDerivedStateFromError`.
 *
 * Se usa en dos niveles (ver Layout.jsx y App.jsx):
 *   · por ruta   → el Sidebar/Topbar sobreviven y el usuario navega a otro lado.
 *   · global     → red de seguridad si lo que revienta es el propio Layout.
 *
 * `resetKey`: cuando cambia, la frontera se rearma sola. Le pasamos la ruta
 * actual, así basta con navegar a otra pantalla para salir del estado de error
 * en vez de tener que recargar a mano.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // `console.error` se conserva en el bundle de producción a propósito
    // (vite.config.js solo elimina log/info/debug/trace), así que esto es lo
    // que verá quien abra la consola para reportar el fallo.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    // Rearme al navegar: si seguimos mostrando el error después de cambiar de
    // ruta, la pantalla nueva nunca llegaría a montarse.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const Fallback = this.props.fallback || DefaultFallback
    return <Fallback error={error} onRetry={() => this.setState({ error: null })} />
  }
}

function DefaultFallback({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="rounded-full bg-red-50 dark:bg-red-950/40 p-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">
        Algo falló en esta pantalla
      </h2>
      <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400 max-w-sm">
        El resto de la aplicación sigue funcionando: puedes reintentar o irte a otra sección
        desde el menú.
      </p>
      {import.meta.env.DEV && (
        <pre className="mt-4 max-w-full overflow-x-auto rounded-md bg-ink-100 dark:bg-ink-900 p-3 text-left text-xs text-red-700 dark:text-red-300">
          {String(error?.stack || error?.message || error)}
        </pre>
      )}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-md transition-colors focus-ring bg-brand-800 text-white hover:bg-brand-900 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <RotateCcw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    </div>
  )
}

/**
 * Fallback de página completa: para cuando lo que falla está POR ENCIMA del
 * Layout y ya no hay menú al que volver. Aquí sí recargamos de verdad —
 * `window.location` en vez de un retry en memoria— porque el estado de React
 * que provocó el fallo sigue ahí.
 */
export function FullPageFallback({ error }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-ink-50 dark:bg-ink-950">
      <div className="rounded-full bg-red-50 dark:bg-red-950/40 p-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-lg font-semibold text-ink-800 dark:text-ink-100">
        La aplicación no pudo continuar
      </h1>
      <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400 max-w-sm">
        Recarga la página. Si vuelve a pasar, avisa a sistemas indicando qué estabas haciendo.
      </p>
      {import.meta.env.DEV && (
        <pre className="mt-4 max-w-full overflow-x-auto rounded-md bg-ink-100 dark:bg-ink-900 p-3 text-left text-xs text-red-700 dark:text-red-300">
          {String(error?.stack || error?.message || error)}
        </pre>
      )}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-md transition-colors focus-ring bg-brand-800 text-white hover:bg-brand-900 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <RotateCcw className="h-4 w-4" />
          Recargar
        </button>
        <button
          type="button"
          onClick={() => { window.location.href = '/' }}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-md transition-colors focus-ring bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-200 dark:border-ink-700 dark:hover:bg-ink-700"
        >
          <Home className="h-4 w-4" />
          Ir al inicio
        </button>
      </div>
    </div>
  )
}

/**
 * Frontera por ruta: se rearma sola al navegar. Va dentro del Layout para que
 * el menú siga en pie mientras la pantalla de contenido está caída.
 */
export function RouteErrorBoundary({ children, fallback }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname} fallback={fallback}>
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
