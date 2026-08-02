/**
 * Piezas compartidas por las vistas del panel de sistemas.
 *
 * El panel exige 2FA en el backend: si la cuenta no lo tiene, TODOS sus
 * endpoints devuelven 403 con `requiere_2fa: true`. En vez de dejar la pantalla
 * en un error seco, `Aviso2FA` explica qué falta y manda a activarlo.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, AlertTriangle, RefreshCw, Timer } from 'lucide-react'
import { Button } from '../../components/ui'
import { esFalta2fa } from '../../api/sistemas'
import { getCupo, suscribirCupo } from '../../api/rateLimit'

export function Aviso2FA() {
  const navigate = useNavigate()
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">
              Este panel requiere autenticación de dos factores
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300/90">
              El rol de sistemas puede crear cuentas y cerrar sesiones de otros
              usuarios. Por eso una contraseña no basta para entrar aquí: hace
              falta un segundo factor. Actívalo en tu perfil y vuelve.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/perfil')}>
            Activar 2FA en Mi perfil
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Botón «Actualizar» con estado real.
 *
 * `useResource` expone `loading` como `!data && !error`, o sea que en un
 * refetch nunca se pone en true. El botón no daba ninguna señal de estar
 * haciendo algo, así que uno volvía a pulsarlo — y a los pocos clics saltaba
 * el rate limit con un 429. El problema no era el límite, era la falta de
 * respuesta visual.
 *
 * Este hook lleva su propio estado en vuelo, deshabilita el botón mientras
 * dura y acepta varias recargas a la vez (hay pantallas con dos recursos).
 */
export function useRefrescar(...recargas) {
  const [refrescando, setRefrescando] = useState(false)

  const refrescar = async () => {
    if (refrescando) return
    setRefrescando(true)
    try {
      await Promise.allSettled(recargas.map((fn) => fn?.()))
    } finally {
      setRefrescando(false)
    }
  }

  return { refrescando, refrescar }
}

// A partir de cuántas peticiones restantes se avisa. 10 da margen de sobra
// para reaccionar: aunque cada refresco de una pantalla consuma 2 (hay vistas
// con dos recursos), quedan varios intentos antes del tope.
const UMBRAL_AVISO = 10

/**
 * Botón «Actualizar» que avisa ANTES de agotar el cupo.
 *
 * El servidor publica cuántas peticiones quedan en los headers `X-RateLimit-*`
 * (ver src/api/rateLimit.js). Cuando bajan del umbral se muestra el aviso; al
 * llegar a cero el botón se deshabilita y dice cuándo se podrá de nuevo, en
 * lugar de dejar que el usuario se estrelle contra un 429.
 *
 * `ruta` es la del endpoint principal de la pantalla, sin baseURL ni query
 * (ej. '/sistemas/peticiones'). Si no se pasa, el botón funciona igual pero
 * sin avisos — no se inventa información que no se tiene.
 */
export function BotonActualizar({ onClick, refrescando, ruta }) {
  const [cupo, setCupo] = useState(() => (ruta ? getCupo(ruta) : null))
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!ruta) return
    setCupo(getCupo(ruta))
    return suscribirCupo((rutaCambiada) => {
      if (rutaCambiada === ruta) setCupo(getCupo(ruta))
    })
  }, [ruta])

  const agotado = cupo && cupo.restantes <= 0 && cupo.resetMs && cupo.resetMs > ahora
  const segundosParaReset = agotado ? Math.ceil((cupo.resetMs - ahora) / 1000) : 0

  // El contador solo corre mientras el cupo está agotado: no tiene sentido
  // re-renderizar cada segundo el resto del tiempo.
  useEffect(() => {
    if (!agotado) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [agotado])

  const cercaDelTope = cupo && !agotado && cupo.restantes <= UMBRAL_AVISO

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<RefreshCw size={15} className={refrescando ? 'animate-spin' : undefined} />}
        onClick={onClick}
        loading={refrescando}
        disabled={refrescando || agotado}
      >
        Actualizar
      </Button>

      {agotado && (
        <span className="inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-400">
          <Timer size={12} />
          Disponible en {segundosParaReset}s
        </span>
      )}

      {cercaDelTope && (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={12} />
          Quedan {cupo.restantes} actualizaciones este minuto
        </span>
      )}
    </div>
  )
}

/** Envuelve el contenido: muestra el aviso de 2FA o el error real. */
export function EstadoCarga({ error, loading, children, skeleton = null }) {
  if (esFalta2fa(error)) return <Aviso2FA />

  // 429: no es un fallo del sistema, es que se pidió demasiado seguido.
  // Merece un mensaje propio — el genérico asusta sin motivo.
  if (error?.response?.status === 429) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
        <Timer size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-amber-900 dark:text-amber-200">
          <p className="font-medium">Demasiadas actualizaciones seguidas</p>
          <p className="mt-0.5 leading-snug">
            Espera un momento y vuelve a intentar. Los datos se refrescan solos al
            volver a la pantalla, no hace falta insistir.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900/50 dark:bg-red-900/20">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <span className="text-red-800 dark:text-red-300">
          {error?.response?.data?.error || error?.message || 'No se pudo cargar la información.'}
        </span>
      </div>
    )
  }
  if (loading) return skeleton
  return children
}

/** Semáforo de un componente de infraestructura. */
/**
 * Semáforo de un servicio.
 *
 * `ok` admite tres valores: true (verde), false (rojo) y **null/undefined
 * (gris)**. El gris es para lo que está apagado a propósito —un antivirus que
 * no instalaste no es una falla—; sin él, "no configurado" se pintaba de rojo
 * y parecía una alarma.
 */
export function Indicador({ ok, titulo, detalle }) {
  const color = ok == null ? 'bg-ink-300 dark:bg-ink-600' : ok ? 'bg-emerald-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900">
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${color}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{titulo}</p>
        <p className="truncate text-xs text-ink-500 dark:text-ink-400" title={detalle || ''}>
          {detalle || (ok ? '' : 'sin respuesta')}
        </p>
      </div>
    </div>
  )
}

/**
 * Paginación EN CLIENTE para las tablas del panel.
 *
 * Aquí sí conviene paginar en cliente y no en servidor: los datos ya vienen
 * completos en una sola respuesta (el buffer de peticiones está topado en 500
 * eventos, las sesiones y los eventos de seguridad también tienen tope), así
 * que cortar en el navegador es instantáneo y evita un viaje extra por cada
 * cambio de página.
 *
 * No se resetea la página al recargar los datos: se ACOTA. Si al revalidar
 * llegan menos elementos y la página actual ya no existe, cae a la última
 * válida en vez de saltar a la primera — así una revalidación de fondo no te
 * mueve la vista mientras estás leyendo.
 */
export function usePaginacionLocal(items, porPagina = 25) {
  const [pagina, setPagina] = useState(0) // 0-based, como espera <Pagination>

  const total = items?.length || 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const visibles = (items || []).slice(
    paginaSegura * porPagina,
    (paginaSegura + 1) * porPagina,
  )

  return {
    visibles,
    pagina: paginaSegura,
    totalPaginas,
    total,
    porPagina,
    setPagina,
    // Índice absoluto del primer elemento de la página: sirve para construir
    // keys estables que no se repitan entre páginas.
    offset: paginaSegura * porPagina,
  }
}

export function fmtFechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function fmtDuracion(segundos) {
  if (!segundos && segundos !== 0) return '—'
  const d = Math.floor(segundos / 86400)
  const h = Math.floor((segundos % 86400) / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  return `${m} min`
}
