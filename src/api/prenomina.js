import api from './axios'

const BASE = '/prenomina'

export async function listarSemanas() {
  const { data } = await api.get(`${BASE}/semanas`)
  return data
}

export async function previewSemana(fechaStr) {
  const { data } = await api.get(`${BASE}/semanas/${fechaStr}/preview`)
  return data
}

export async function guardarSemana(fechaStr) {
  const { data } = await api.post(`${BASE}/semanas/${fechaStr}/guardar`)
  return data
}

export async function detalleEditor(fechaStr) {
  const { data } = await api.get(`${BASE}/semanas/${fechaStr}/editar`)
  return data
}

export async function cerrarSemana(fechaStr) {
  const { data } = await api.post(`${BASE}/semanas/${fechaStr}/cerrar`)
  return data
}

export async function agregarDescuento(payload) {
  // { prenomina_id, tipo, concepto, monto, fecha_incidencia? }
  const { data } = await api.post(`${BASE}/descuentos`, payload)
  return data
}

export async function eliminarDescuento(id) {
  const { data } = await api.delete(`${BASE}/descuentos/${id}`)
  return data
}

export async function agregarDeposito(payload) {
  // { prenomina_id, concepto, monto }
  const { data } = await api.post(`${BASE}/depositos`, payload)
  return data
}

export async function eliminarDeposito(id) {
  const { data } = await api.delete(`${BASE}/depositos/${id}`)
  return data
}

export async function actualizarViaticos(prenominaId, monto) {
  const { data } = await api.patch(`${BASE}/viaticos`, { prenomina_id: prenominaId, monto_viaticos: monto })
  return data
}

export async function actualizarFestivos(prenominaId, monto) {
  const { data } = await api.patch(`${BASE}/festivos`, { prenomina_id: prenominaId, monto_festivos: monto })
  return data
}

export async function imprimirConsolidado(fechaStr) {
  const res = await api.get(`${BASE}/semanas/${fechaStr}/imprimir`, { responseType: 'blob' })
  openBlobInTab(res)
}

export async function imprimirIndividual(fechaStr, trabajadorId) {
  const res = await api.get(`${BASE}/semanas/${fechaStr}/trabajadores/${trabajadorId}/imprimir`, { responseType: 'blob' })
  openBlobInTab(res)
}

export async function enviarCorreoIndividual(fechaStr, trabajadorId) {
  const { data } = await api.post(`${BASE}/semanas/${fechaStr}/trabajadores/${trabajadorId}/correo`)
  return data
}

export async function enviarCorreoTodos(fechaStr) {
  const { data } = await api.post(`${BASE}/semanas/${fechaStr}/correo`)
  return data
}

export async function exportarExcel(fechaStr) {
  const res = await api.get(`${BASE}/semanas/${fechaStr}/excel`, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : `Prenomina_${fechaStr}.xlsx`
  const blob = new Blob([res.data], {
    type: res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

function openBlobInTab(res) {
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  // Si el navegador bloquea popup, forzamos descarga
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    const cd = res.headers['content-disposition'] || ''
    const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
    a.download = match ? decodeURIComponent(match[1]) : 'recibo.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  // Liberar el URL después de un rato (el tab nuevo ya lo está usando)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
