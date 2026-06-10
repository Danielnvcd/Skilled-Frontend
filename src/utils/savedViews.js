// Vistas guardadas por lista (filtros + orden con nombre), persistidas en
// localStorage. Cada lista usa su propio `listKey` ('empleados', 'movimientos',
// ...) para que las vistas no se mezclen entre páginas.
//
// Se guardan solo params serializables (q, sort, dir, ...) — nunca page: una
// vista es un "qué estoy viendo", no un "dónde me quedé". El consumidor decide
// qué campos componen la vista al llamar saveView.

const KEY_PREFIX = 'ui:views:'

function storageKey(listKey) {
  return `${KEY_PREFIX}${listKey}`
}

export function getSavedViews(listKey) {
  try {
    const raw = localStorage.getItem(storageKey(listKey))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(listKey, views) {
  try {
    localStorage.setItem(storageKey(listKey), JSON.stringify(views))
  } catch {}
  return views
}

export function saveView(listKey, name, params) {
  const views = getSavedViews(listKey)
  const limpio = (name || '').trim()
  if (!limpio) return views
  // Mismo nombre = sobrescribir; así "Mi área" se actualiza en vez de duplicarse.
  const sinDuplicado = views.filter((v) => v.name.toLowerCase() !== limpio.toLowerCase())
  return persist(listKey, [
    ...sinDuplicado,
    { id: `${Date.now()}`, name: limpio, params: params || {} },
  ])
}

export function deleteView(listKey, id) {
  return persist(listKey, getSavedViews(listKey).filter((v) => v.id !== id))
}

// Igualdad de params ignorando claves vacías — '' y undefined cuentan como
// "sin valor" para que la vista activa se detecte aunque la URL omita params.
export function sameParams(a, b) {
  const norm = (o) => {
    const out = {}
    for (const [k, v] of Object.entries(o || {})) {
      if (v !== '' && v != null) out[k] = String(v)
    }
    return out
  }
  const na = norm(a)
  const nb = norm(b)
  const keys = new Set([...Object.keys(na), ...Object.keys(nb)])
  for (const k of keys) {
    if (na[k] !== nb[k]) return false
  }
  return true
}
