import api from './axios'

const BASE = '/v1'

// --- Productos ---
export async function getProductos({ skip = 0, limit = 200 } = {}) {
  const { data } = await api.get(`${BASE}/productos/`, { params: { skip, limit } })
  return data
}

export async function getProductosBajoMinimo() {
  const { data } = await api.get(`${BASE}/productos/bajo-minimo/`)
  return data
}

export async function createProducto(payload) {
  const { data } = await api.post(`${BASE}/productos/`, payload)
  return data
}

export async function updateProducto(id, payload) {
  const { data } = await api.put(`${BASE}/productos/${id}`, payload)
  return data
}

export async function deleteProducto(id) {
  const { data } = await api.delete(`${BASE}/productos/${id}`)
  return data
}

// --- Almacenes ---
export async function getAlmacenes() {
  const { data } = await api.get(`${BASE}/almacenes/`)
  return data
}

export async function createAlmacen(payload) {
  const { data } = await api.post(`${BASE}/almacenes/`, payload)
  return data
}

export async function updateAlmacen(id, payload) {
  const { data } = await api.put(`${BASE}/almacenes/${id}`, payload)
  return data
}

export async function deleteAlmacen(id) {
  const { data } = await api.delete(`${BASE}/almacenes/${id}`)
  return data
}

export async function getEstantesPorAlmacen(almacenId) {
  const { data } = await api.get(`${BASE}/almacenes/${almacenId}/estantes`)
  return data
}

export async function validarAlmacenQR(qrCode) {
  const { data } = await api.get(`${BASE}/almacenes/${qrCode}/validar`)
  return data
}

// --- Estantes ---
export async function getEstantes() {
  const { data } = await api.get(`${BASE}/estantes/`)
  return data
}

export async function createEstante(payload) {
  const { data } = await api.post(`${BASE}/estantes/`, payload)
  return data
}

export async function updateEstante(id, payload) {
  const { data } = await api.put(`${BASE}/estantes/${id}`, payload)
  return data
}

export async function deleteEstante(id) {
  const { data } = await api.delete(`${BASE}/estantes/${id}`)
  return data
}

export async function validarEstanteQR(qrCode) {
  const { data } = await api.get(`${BASE}/estantes/${qrCode}/validar`)
  return data
}

// --- Movimientos ---
export async function getMovimientos({ producto_id, tipo, limit = 200 } = {}) {
  const params = { limit }
  if (producto_id) params.producto_id = producto_id
  if (tipo) params.tipo = tipo
  const { data } = await api.get(`${BASE}/movimientos/`, { params })
  return data
}

export async function createMovimiento(payload) {
  const { data } = await api.post(`${BASE}/movimientos/`, payload)
  return data
}

// --- Solicitudes ---
export async function getSolicitudes({ skip = 0, limit = 200 } = {}) {
  const { data } = await api.get(`${BASE}/solicitudes/`, { params: { skip, limit } })
  return data
}

export async function createSolicitud(payload) {
  const { data } = await api.post(`${BASE}/solicitudes/`, payload)
  return data
}

export async function updateSolicitudEstado(id, estatus) {
  const { data } = await api.patch(`${BASE}/solicitudes/${id}/estado`, { estatus })
  return data
}

// --- Categorías ---
export async function getCategorias() {
  const { data } = await api.get(`${BASE}/categorias/`)
  return data
}

// --- Configuración visual de categorías (imagen, etc.) ---
export async function getCategoriasConfig() {
  const { data } = await api.get(`${BASE}/categorias-config/`)
  return data
}

export async function upsertCategoriaConfig(nombre, imagen_url) {
  const { data } = await api.put(
    `${BASE}/categorias-config/${encodeURIComponent(nombre)}`,
    { imagen_url: imagen_url || null },
  )
  return data
}

export async function deleteCategoriaConfig(nombre) {
  await api.delete(`${BASE}/categorias-config/${encodeURIComponent(nombre)}`)
}

// --- Proyectos (endpoint del módulo inventario; distinto del módulo de proyectos) ---
export async function getProyectosInventario() {
  const { data } = await api.get(`${BASE}/proyectos/`)
  return data
}

// --- Importar materiales ---
export async function descargarPlantillaMateriales() {
  const res = await api.get(`${BASE}/productos/plantilla-importar`, { responseType: 'blob' })
  const blob = new Blob([res.data], { type: res.headers['content-type'] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_materiales.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function importarMateriales(file) {
  const fd = new FormData()
  fd.append('archivo', file)
  const { data } = await api.post(`${BASE}/productos/importar`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
