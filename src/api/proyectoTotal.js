import api from './axios'

const BASE = '/proyecto-total'

export async function listarProyectoTotal({ page = 1, q = '', perPage = 20 } = {}) {
  const { data } = await api.get(BASE, {
    params: { page, q, per_page: perPage },
  })
  return data
}

export async function exportarExcelProyecto(proyectoId, nombreSugerido) {
  const res = await api.get(`${BASE}/${proyectoId}/excel`, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : (nombreSugerido || `proyecto_total_${proyectoId}.xlsx`)
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
