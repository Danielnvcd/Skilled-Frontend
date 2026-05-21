export function extractApiError(err, fallback = 'Ocurrió un error') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback

  if (data.fields && typeof data.fields === 'object') {
    const messages = Object.values(data.fields).filter(Boolean)
    if (messages.length > 0) return messages.join('. ')
  }

  return data.error || data.message || fallback
}
