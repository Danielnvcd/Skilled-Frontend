import api from './axios'

const BASE = '/trabajadores'

export async function listarTrabajadores({
  page = 1, q = '', estado = 'activos', perPage = 20, sort = '', dir = '',
  area = '', puesto = '', tipoNomina = '', tipoPago = '', sinSalario = false,
} = {}) {
  const params = { page, q, estado, per_page: perPage }
  if (sort) {
    params.sort = sort
    params.dir = dir || 'asc'
  }
  if (area) params.area = area
  if (puesto) params.puesto = puesto
  if (tipoNomina) params.tipo_nomina = tipoNomina
  if (tipoPago) params.tipo_pago = tipoPago
  if (sinSalario) params.sin_salario = 1
  const { data } = await api.get(BASE, { params })
  return data
}

// Opciones para los selects de filtro (áreas, puestos, tipos). Respeta el scope
// de rol en el backend.
export async function obtenerFiltrosTrabajadores() {
  const { data } = await api.get(`${BASE}/filtros`)
  return data
}

export async function obtenerFichaTecnica() {
  const { data } = await api.get(`${BASE}/ficha-tecnica`)
  return data
}

export async function obtenerTrabajador(id) {
  const { data } = await api.get(`${BASE}/${id}`)
  return data
}

// ── Notas internas (chatter de la ficha) ────────────────────────────────────

export async function listarNotas(id) {
  const { data } = await api.get(`${BASE}/${id}/notas`)
  return data
}

export async function crearNota(id, texto) {
  const { data } = await api.post(`${BASE}/${id}/notas`, { texto })
  return data
}

export async function eliminarNota(id, notaId) {
  const { data } = await api.delete(`${BASE}/${id}/notas/${notaId}`)
  return data
}

export async function crearTrabajador(formData) {
  const { data } = await api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function actualizarTrabajador(id, formData) {
  const { data } = await api.post(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function darBajaTrabajador(id) {
  const { data } = await api.delete(`${BASE}/${id}`)
  return data
}

export async function reactivarTrabajador(id) {
  const { data } = await api.post(`${BASE}/${id}/reactivar`)
  return data
}

// Acción en lote (baja o reactivar). El backend emite un solo
// `empleado:changed` con `action: 'bulk_baja' | 'bulk_reactivar'`,
// así otras pestañas refrescan una vez vía useResource.
export async function bulkAccionTrabajadores({ ids, action }) {
  const { data } = await api.post(`${BASE}/bulk`, { ids, action })
  return data
}

// Timeline consolidado: horas, ausencias, ajustes, préstamos, abonos, docs.
export async function obtenerTimeline(id, { desde, hasta, limit } = {}) {
  const params = {}
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (limit) params.limit = limit
  const { data } = await api.get(`${BASE}/${id}/timeline`, { params })
  return data
}

export async function guardarCredenciales(id, payload) {
  // payload = { observaciones?, credenciales: [{planta, credencial_id, fecha_caducidad}] }
  const { data } = await api.post(`${BASE}/${id}/credenciales`, payload)
  return data
}

export async function subirFoto(id, file) {
  const fd = new FormData()
  fd.append('foto_perfil', file)
  const { data } = await api.post(`${BASE}/${id}/foto`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function subirDocumento(id, { file, tipo_documento, fecha_inicio, fecha_fin }) {
  const fd = new FormData()
  fd.append('documento', file)
  if (tipo_documento) fd.append('tipo_documento', tipo_documento)
  if (fecha_inicio) fd.append('fecha_inicio', fecha_inicio)
  if (fecha_fin) fd.append('fecha_fin', fecha_fin)
  const { data } = await api.post(`${BASE}/${id}/documentos`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function eliminarDocumento(docId) {
  const { data } = await api.delete(`${BASE}/documentos/${docId}`)
  return data
}

export async function descargarDocumento(docId, nombreSugerido) {
  const res = await api.get(`${BASE}/documentos/${docId}`, { responseType: 'blob' })
  triggerDownload(res, nombreSugerido)
}

export async function descargarPlantillaImportar() {
  const res = await api.get(`${BASE}/plantilla-importar`, { responseType: 'blob' })
  triggerDownload(res, 'plantilla_empleados.xlsx')
}

export async function importarExcel(file) {
  const fd = new FormData()
  fd.append('archivo', file)
  const { data } = await api.post(`${BASE}/importar`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function exportarEmpleado(id, nombreSugerido) {
  const res = await api.get(`${BASE}/${id}/exportar`, { responseType: 'blob' })
  triggerDownload(res, nombreSugerido || `empleado_${id}.xlsx`)
}

// Exporta el listado completo respetando los filtros activos (búsqueda + área,
// puesto, tipo nómina/pago, sin salario). Sin filtros baja todos los activos.
export async function exportarTodos({ q = '', area = '', puesto = '', tipoNomina = '', tipoPago = '', sinSalario = false } = {}) {
  const params = {}
  if (q) params.q = q
  if (area) params.area = area
  if (puesto) params.puesto = puesto
  if (tipoNomina) params.tipo_nomina = tipoNomina
  if (tipoPago) params.tipo_pago = tipoPago
  if (sinSalario) params.sin_salario = 1
  const res = await api.get(`${BASE}/exportar-todos`, { params, responseType: 'blob' })
  triggerDownload(res, `empleados_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// Exportar solo la selección. Tope de 200 IDs en el backend.
export async function exportarSeleccion(ids) {
  const res = await api.post(`${BASE}/bulk-exportar`, { ids }, { responseType: 'blob' })
  triggerDownload(res, `empleados_seleccion_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function triggerDownload(res, fallbackName) {
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  const filename = match ? decodeURIComponent(match[1]) : fallbackName
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
