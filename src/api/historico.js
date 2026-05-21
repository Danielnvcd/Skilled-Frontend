import api from './axios'

const BASE = '/historico'

export async function listarHistorico({ page = 1, searchDate = '', perPage = 20 } = {}) {
  const { data } = await api.get(BASE, {
    params: { page, search_date: searchDate, per_page: perPage },
  })
  return data
}

export async function obtenerDetalle(fechaStr) {
  const { data } = await api.get(`${BASE}/${fechaStr}`)
  return data
}

export async function imprimirProyectoPdf(fechaStr, proyectoId) {
  const res = await api.get(`${BASE}/${fechaStr}/proyecto/${proyectoId}/pdf`, {
    responseType: 'blob',
  })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // No revocar inmediatamente — el navegador necesita el blob para renderizar el PDF
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function exportarExcelHistorico(fechaStr) {
  const res = await api.get(`${BASE}/${fechaStr}/excel`, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : `historico_${fechaStr}.xlsx`
  const blob = new Blob([res.data], { type: res.headers['content-type'] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
