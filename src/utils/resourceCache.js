// Caché en memoria para datos remotos (compartida entre todos los useResource).
//
// Cada entrada: { data, ts, error, inflight }
//   - ts: epoch ms del último éxito. 0 = inválida/stale.
//   - inflight: promesa del fetch en curso, para dedupe entre componentes que
//     piden la misma clave a la vez.
//
// Suscripciones: cada cambio a una clave notifica a los suscriptores con un
// `type` ('update' | 'error' | 'invalidate'). El hook usa 'invalidate' para
// disparar refetch automático cuando llega un evento de Socket.IO.

const cache = new Map()
const subscribers = new Map()

function notify(key, type) {
  const subs = subscribers.get(key)
  if (!subs) return
  subs.forEach((cb) => cb(type))
}

// Serializa una clave a string. Soporta string plano o array
// [namespace, params]. Mismo orden de params = misma clave.
export function serializeKey(key) {
  if (typeof key === 'string') return key
  if (Array.isArray(key)) {
    return key.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(':')
  }
  return JSON.stringify(key)
}

// Namespace = primera parte de la clave. Lo usa invalidate() para borrar
// todas las claves que comparten ese prefijo (ej. todas las páginas/filtros
// de 'empleados' cuando llega 'empleado:changed').
export function namespaceOf(key) {
  if (typeof key === 'string') return key.split(':')[0]
  if (Array.isArray(key) && typeof key[0] === 'string') return key[0]
  return null
}

export function get(key) {
  return cache.get(key) || null
}

export function set(key, data) {
  const prev = cache.get(key) || {}
  cache.set(key, { ...prev, data, ts: Date.now(), error: null, inflight: null })
  notify(key, 'update')
}

export function setError(key, err) {
  const prev = cache.get(key) || {}
  cache.set(key, { ...prev, error: err, inflight: null })
  notify(key, 'error')
}

export function setInflight(key, promise) {
  const prev = cache.get(key) || {}
  cache.set(key, { ...prev, inflight: promise })
}

// Invalida todas las claves cuyo namespace coincide con `prefix`. No borra
// los datos cacheados (para poder seguir mostrándolos mientras llega lo
// nuevo) — solo pone ts=0 para que el próximo stale-check dispare refetch.
export function invalidate(prefix) {
  if (!prefix) return
  const exact = prefix
  const start = prefix + ':'
  const touched = []
  for (const [k, entry] of cache.entries()) {
    if (k === exact || k.startsWith(start)) {
      cache.set(k, { ...entry, ts: 0 })
      touched.push(k)
    }
  }
  touched.forEach((k) => notify(k, 'invalidate'))
}

export function subscribe(key, cb) {
  if (!subscribers.has(key)) subscribers.set(key, new Set())
  subscribers.get(key).add(cb)
  return () => {
    const subs = subscribers.get(key)
    if (!subs) return
    subs.delete(cb)
    if (subs.size === 0) subscribers.delete(key)
  }
}

// Limpia TODO el caché. Para llamar en login/logout — sin esto, datos
// (incluidas listas privadas) de la cuenta anterior se ven antes del refetch
// y, si la cuenta nueva recibe 403/404, se quedan visibles indefinidamente.
// Notifica `invalidate` a cada suscriptor activo para que vuelvan a fetchear.
export function clearAll() {
  const keys = Array.from(cache.keys())
  cache.clear()
  keys.forEach((k) => notify(k, 'invalidate'))
}
