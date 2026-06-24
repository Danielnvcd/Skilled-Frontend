export function extractApiError(err, fallback = 'Ocurrió un error') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback

  if (data.fields && typeof data.fields === 'object') {
    const messages = Object.values(data.fields).filter(Boolean)
    if (messages.length > 0) return messages.join('. ')
  }

  // El backend (Flask) devuelve los errores en `detail`. Puede ser un string
  // ("Producto no encontrado") o un objeto de validación Marshmallow
  // ({ campo: ["mensaje", ...] }). Lo aplanamos a texto legible.
  if (data.detail) {
    if (typeof data.detail === 'string') return data.detail
    if (typeof data.detail === 'object') {
      const messages = Object.values(data.detail)
        .flat()
        .filter(Boolean)
      if (messages.length > 0) return messages.join('. ')
    }
  }

  return data.error || data.message || fallback
}
