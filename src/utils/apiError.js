// Une varios mensajes de validación en una sola frase legible.
//
// Los mensajes del backend a veces ya traen punto final ("Campo requerido.") y
// a veces no ("Campo requerido"). Unir siempre con ". " producía puntos dobles
// ("Campo requerido.. Debe ser mayor a 0."), así que el separador solo se añade
// cuando el mensaje anterior no termina ya en puntuación.
function unirMensajes(lista) {
  return lista
    .map((m) => String(m).trim())
    .filter(Boolean)
    .reduce((acc, m) => {
      if (!acc) return m
      return `${acc}${/[.!?:;]$/.test(acc) ? '' : '.'} ${m}`
    }, '')
}

export function extractApiError(err, fallback = 'Ocurrió un error') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback

  // `.flat()` también aquí: `fields` puede traer un string por campo o un array
  // de mensajes, según el validador que lo haya rechazado.
  if (data.fields && typeof data.fields === 'object') {
    const messages = Object.values(data.fields).flat().filter(Boolean)
    if (messages.length > 0) return unirMensajes(messages)
  }

  // El backend (Flask) devuelve los errores en `detail`. Puede ser un string
  // ("Producto no encontrado") o un objeto de validación Marshmallow
  // ({ campo: ["mensaje", ...] }). Lo aplanamos a texto legible.
  if (data.detail) {
    if (typeof data.detail === 'string') return data.detail
    if (typeof data.detail === 'object') {
      const messages = Object.values(data.detail).flat().filter(Boolean)
      if (messages.length > 0) return unirMensajes(messages)
    }
  }

  return data.error || data.message || fallback
}

export default extractApiError
