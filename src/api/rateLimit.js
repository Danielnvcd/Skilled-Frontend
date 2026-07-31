/**
 * Lectura del cupo de peticiones que reporta el servidor.
 *
 * ── Por qué no se cuenta en el cliente ──────────────────────────────────────
 * Sería fácil llevar un contador local de clics, pero mentiría: las
 * revalidaciones automáticas (al recuperar el foco de la pestaña, al volver de
 * otra ruta) también consumen cupo y no pasan por ningún botón. Solo el
 * servidor conoce el número real, y lo publica en los headers `X-RateLimit-*`.
 *
 * ── Cross-origin ────────────────────────────────────────────────────────────
 * El SPA vive en otro dominio que la API, así que estos headers solo son
 * legibles porque el backend los declara en `expose_headers` del CORS. Si
 * alguna vez dejan de leerse, revisar eso antes que nada.
 *
 * Si el header no viene (endpoint sin límite, respuesta de caché, servidor
 * viejo), simplemente no se avisa: la ausencia de dato nunca debe traducirse
 * en una advertencia falsa.
 */

// Estado por ruta: `/sistemas/peticiones` tiene su propio cupo, independiente
// de `/sistemas/estado`. Guardarlo por ruta evita avisar en una pantalla por
// el consumo de otra.
const porRuta = new Map()
const suscriptores = new Set()

function rutaDe(config) {
  // `config.url` es relativa al baseURL ('/sistemas/peticiones'). Se quita la
  // query para que todas las variantes compartan el mismo cupo, que es como
  // lo cuenta el servidor.
  return (config?.url || '').split('?')[0]
}

/** Lo llama el interceptor de axios con cada respuesta (exitosa o no). */
export function registrarDesdeRespuesta(response) {
  try {
    const ruta = rutaDe(response?.config)
    if (!ruta) return
    const h = response?.headers
    if (!h) return

    const restantes = h['x-ratelimit-remaining'] ?? h['X-RateLimit-Remaining']
    const limite = h['x-ratelimit-limit'] ?? h['X-RateLimit-Limit']
    if (restantes === undefined || restantes === null || restantes === '') return

    const reset = h['x-ratelimit-reset'] ?? h['X-RateLimit-Reset']
    const reintentar = h['retry-after'] ?? h['Retry-After']

    porRuta.set(ruta, {
      restantes: Number(restantes),
      limite: limite !== undefined ? Number(limite) : null,
      // `reset` es un epoch en segundos; lo pasamos a ms para comparar con Date.now().
      resetMs: reset ? Number(reset) * 1000 : null,
      reintentarEn: reintentar ? Number(reintentar) : null,
      actualizado: Date.now(),
    })
    suscriptores.forEach((fn) => { try { fn(ruta) } catch { /* noop */ } })
  } catch {
    // Nunca romper una respuesta real por no poder leer un header informativo.
  }
}

export function getCupo(ruta) {
  return porRuta.get(ruta) || null
}

export function suscribirCupo(fn) {
  suscriptores.add(fn)
  return () => suscriptores.delete(fn)
}
