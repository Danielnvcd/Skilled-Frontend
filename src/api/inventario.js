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

// Desglose de stock por bodega (Pausa 2 — stock por almacén).
export async function getProductoStocks(id, { incluirVacios = false } = {}) {
  const { data } = await api.get(`${BASE}/productos/${id}/stocks`, {
    params: incluirVacios ? { incluir_vacios: 1 } : {},
  })
  return data
}

// Disponibilidad: actual / reservado / disponible + lista de reservas (Pausa 2-bis).
export async function getProductoDisponibilidad(id) {
  const { data } = await api.get(`${BASE}/productos/${id}/disponibilidad`)
  return data
}

// Kardex / historial con saldo corrido (Pausa 3).
export async function getProductoKardex(id, { desde, hasta, tipo, limit = 500 } = {}) {
  const params = { limit }
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (tipo) params.tipo = tipo
  const { data } = await api.get(`${BASE}/productos/${id}/kardex`, { params })
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

export async function getInventarioEstante(qrCode) {
  const { data } = await api.get(`${BASE}/estantes/${qrCode}/inventario`)
  return data
}

export async function getProductosDeEstante(estanteId) {
  const { data } = await api.get(`${BASE}/estantes/${estanteId}/productos`)
  return data
}

export async function setProductosDeEstante(estanteId, producto_ids) {
  const { data } = await api.put(`${BASE}/estantes/${estanteId}/productos`, { producto_ids })
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

export async function createMovimientoRapido(payload) {
  const { data } = await api.post(`${BASE}/movimientos/rapido`, payload)
  return data
}

// --- Tomas físicas (Pausa 10) ---
export async function listTomas(params = {}) {
  const { data } = await api.get(`${BASE}/tomas/`, { params })
  return data
}

export async function getToma(id) {
  const { data } = await api.get(`${BASE}/tomas/${id}`)
  return data
}

export async function createToma(payload) {
  const { data } = await api.post(`${BASE}/tomas/`, payload)
  return data
}

export async function patchTomaDetalle(tomaId, detId, payload) {
  const { data } = await api.patch(`${BASE}/tomas/${tomaId}/detalles/${detId}`, payload)
  return data
}

export async function patchTomaDetallePorCodigo(tomaId, payload) {
  const { data } = await api.patch(`${BASE}/tomas/${tomaId}/detalles/por-codigo`, payload)
  return data
}

export async function cerrarToma(tomaId, payload = {}) {
  const { data } = await api.post(`${BASE}/tomas/${tomaId}/cerrar`, payload)
  return data
}

export async function cancelarToma(tomaId) {
  const { data } = await api.post(`${BASE}/tomas/${tomaId}/cancelar`, {})
  return data
}

export function getTomaPdfUrl(tomaId) {
  return `${BASE}/tomas/${tomaId}/pdf`
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

// Pausa 8b — editar cantidad_aprobada de una línea de solicitud APROBADA.
export async function patchSolicitudDetalle(solId, detId, { cantidad_aprobada }) {
  const { data } = await api.patch(
    `${BASE}/solicitudes/${solId}/detalles/${detId}`,
    { cantidad_aprobada },
  )
  return data
}

// Pausa 8b — entrega total o parcial.
// payload: { almacen_origen_id?, motivo?, entregas: [{detalle_id, cantidad_entregada}] }
export async function entregarSolicitud(solId, payload) {
  const { data } = await api.post(`${BASE}/solicitudes/${solId}/entregar`, payload)
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

// --- Vista previa PDF de una solicitud (no la guarda) ---
// Mismo mecanismo que prenómina: backend renderiza con xhtml2pdf y devuelve blob.
export async function previewSolicitudPdf(payload) {
  const res = await api.post(`${BASE}/solicitudes/preview-pdf`, payload, { responseType: 'blob' })
  _openBlobInTab(res)
}

// --- Imprimir PDF de una solicitud ya guardada (por ID) ---
export async function imprimirSolicitud(solId) {
  const res = await api.get(`${BASE}/solicitudes/${solId}/pdf`, { responseType: 'blob' })
  _openBlobInTab(res)
}

function _openBlobInTab(res) {
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    const cd = res.headers['content-disposition'] || ''
    const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
    a.download = match ? decodeURIComponent(match[1]) : 'solicitud.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// --- Reportes Excel (Pausa 6) ---
// Cada uno descarga un .xlsx con send_file. Helper de descarga compartido.
async function _descargarXlsx(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const blob = new Blob([res.data], {
    type: res.headers['content-type']
      || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i)
  a.download = match ? decodeURIComponent(match[1]) : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000)
}

export async function descargarReporteInventarioActual({ categoria, solo_bajo_minimo } = {}) {
  const params = {}
  if (categoria) params.categoria = categoria
  if (solo_bajo_minimo) params.solo_bajo_minimo = 1
  await _descargarXlsx(`${BASE}/reportes/inventario-actual.xlsx`, params, 'inventario_actual.xlsx')
}

export async function descargarReporteMovimientos({ desde, hasta, tipo, producto_id, usuario_id } = {}) {
  const params = {}
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (tipo) params.tipo = tipo
  if (producto_id) params.producto_id = producto_id
  if (usuario_id) params.usuario_id = usuario_id
  await _descargarXlsx(`${BASE}/reportes/movimientos.xlsx`, params, 'movimientos.xlsx')
}

export async function descargarReporteKardex({ producto_id, desde, hasta } = {}) {
  if (!producto_id) throw new Error('producto_id es requerido')
  const params = { producto_id }
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  await _descargarXlsx(`${BASE}/reportes/kardex.xlsx`, params, 'kardex.xlsx')
}

export async function descargarReporteConsumoProyecto({ desde, hasta, estatus } = {}) {
  const params = {}
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (estatus) params.estatus = estatus
  await _descargarXlsx(`${BASE}/reportes/consumo-proyecto.xlsx`, params, 'consumo_proyecto.xlsx')
}

export async function descargarReporteSolicitudes({ desde, hasta, estatus } = {}) {
  const params = {}
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (estatus) params.estatus = estatus
  await _descargarXlsx(`${BASE}/reportes/solicitudes.xlsx`, params, 'solicitudes.xlsx')
}

// --- Etiquetas imprimibles (Pausa 8a) ---
// Genera y descarga (o abre) un PDF de etiquetas Avery con código de barras o QR.
export async function generarEtiquetasPdf({ formato = 'avery_5160', tipo = 'barcode', items }) {
  const res = await api.post(
    `${BASE}/etiquetas/pdf`,
    { formato, tipo, items },
    { responseType: 'blob' },
  )
  _openBlobInTab(res)
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

// --- Compras express (Pausa 9) ---
// Sugerencia: dado un set de producto_ids, agrupa por proveedor default y
// calcula cantidad sugerida basada en consumo de los últimos 30 días.
export async function sugerirOCExpress(producto_ids) {
  const { data } = await api.post(
    `${BASE}/ordenes-compra/express/sugerencia`,
    { producto_ids },
  )
  return data  // { grupos: [{ proveedor, contacto, items: [...] }] }
}

// PDF de orden de compra express. Devuelve la URL del blob (para que el caller
// pueda abrirla o descargarla) + el link de WhatsApp (header X-Whatsapp-Link) +
// el folio. NO abre la pestaña automáticamente: el modal decide qué hacer.
export async function generarOCExpressPdf({ proveedor, contacto, notas, items }) {
  const res = await api.post(
    `${BASE}/ordenes-compra/express/pdf`,
    { proveedor, contacto, notas, items },
    { responseType: 'blob' },
  )
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const whatsappLink = res.headers['x-whatsapp-link'] || ''
  const folio = res.headers['x-folio'] || ''
  return { url, blob, whatsappLink, folio }
}

// Helper que el modal puede usar para "Descargar" un PDF ya generado.
export function descargarPdfDesdeUrl(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'orden_compra.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
