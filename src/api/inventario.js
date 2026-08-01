import api from './axios'

const BASE = '/v1'

// --- Productos ---
export async function getProductoPorCodigo(codigo) {
  const { data } = await api.get(`${BASE}/productos/by-codigo/${encodeURIComponent(codigo)}`)
  return data
}

// Listado de productos con filtros server-side. Con miles de productos el
// catálogo NO baja todo: filtra por `categoria` y/o `q` (búsqueda) en la DB.
export async function getProductos({ skip = 0, limit = 200, categoria, q, stock, imagen, unidad, compra } = {}) {
  const params = { skip, limit }
  if (categoria) params.categoria = categoria
  if (q) params.q = q
  if (stock) params.stock = stock        // 'bajo' | 'sin'
  if (imagen) params.imagen = imagen      // 'con' | 'sin'
  if (unidad) params.unidad = unidad
  if (compra) params.compra = 'activa'    // solo productos con compra en curso
  const { data } = await api.get(`${BASE}/productos/`, { params })
  return data
}

// Listado paginado por páginas: mismos filtros que getProductos pero devuelve
// { items, total, page, per_page, pages } para pintar un paginador numérico
// (Anterior/Siguiente + Página X de Y) sin bajar todo el catálogo.
export async function getProductosPaginado({ page = 1, perPage = 50, categoria, q, stock, imagen, unidad, compra } = {}) {
  const params = { page, per_page: perPage }
  if (categoria) params.categoria = categoria
  if (q) params.q = q
  if (stock) params.stock = stock        // 'bajo' | 'sin'
  if (imagen) params.imagen = imagen      // 'con' | 'sin'
  if (unidad) params.unidad = unidad
  if (compra) params.compra = 'activa'    // solo productos con compra en curso
  const { data } = await api.get(`${BASE}/productos/paginado`, { params })
  return data
}

// Unidades distintas en uso, para el select de filtro del catálogo.
export async function getUnidadesProductos() {
  const { data } = await api.get(`${BASE}/productos/unidades/`)
  return data
}

// Resumen de categorías con conteos (total + bajo mínimo) para las tarjetas
// del catálogo, sin descargar los productos.
export async function getCategoriasResumen() {
  const { data } = await api.get(`${BASE}/categorias/resumen`)
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
// Con `proyectoId` agrega `por_proyecto` (disponible para ese proyecto = bucket
// del proyecto + general libre) — feature stock por proyecto.
export async function getProductoDisponibilidad(id, { proyectoId } = {}) {
  const params = {}
  if (proyectoId) params.proyecto_id = proyectoId
  const { data } = await api.get(`${BASE}/productos/${id}/disponibilidad`, { params })
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

// Portada del rol inventario: existencias por almacén (para las tarjetas).
// Devuelve [{ almacen_id, nombre, ubicacion, total_productos, total_unidades, con_imagen }].
// Resumen de existencias por proyecto y almacén (matriz para la portada).
export async function getResumenProyectos() {
  const { data } = await api.get(`${BASE}/almacenes/resumen-proyectos`)
  return data
}

export async function getAlmacenesResumen() {
  const { data } = await api.get(`${BASE}/almacenes/resumen`)
  return data
}

// Galería paginada de productos con existencia en un almacén (foto + cantidad).
// Devuelve { almacen, items, total, total_unidades, page, per_page, pages }.
export async function getAlmacenStock(almacenId, { page = 1, perPage = 24, q, categoria, imagen, proyecto } = {}) {
  const params = { page, per_page: perPage }
  if (q) params.q = q
  if (categoria) params.categoria = categoria
  if (imagen) params.imagen = imagen      // 'con' | 'sin'
  if (proyecto) params.proyecto_id = proyecto  // <id> | 'general' — stock por proyecto
  const { data } = await api.get(`${BASE}/almacenes/${almacenId}/stock`, { params })
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

// --- Rejilla visual + stock por celda (Pausa 11) ---
export async function getEstanteLayout(estanteId) {
  const { data } = await api.get(`${BASE}/estantes/${estanteId}/layout`)
  return data
}

export async function saveEstanteLayout(estanteId, posiciones) {
  const { data } = await api.put(`${BASE}/estantes/${estanteId}/layout`, { posiciones })
  return data
}

// --- Movimientos ---
export async function getMovimientos({ producto_id, tipo, desde, hasta, limit = 200 } = {}) {
  const params = { limit }
  if (producto_id) params.producto_id = producto_id
  if (tipo) params.tipo = tipo
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
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

// Vale (PDF) de un movimiento ya registrado; se abre en una pestaña nueva.
export async function imprimirMovimiento(movId) {
  const res = await api.get(`${BASE}/movimientos/${movId}/pdf`, { responseType: 'blob' })
  _openBlobInTab(res)
}

// Editor de stock por bodega+proyecto: fija cantidades objetivo por bucket; el
// backend genera un AJUSTE por cada bucket que cambió.
export async function ajustarBuckets(productoId, payload) {
  const { data } = await api.post(`${BASE}/productos/${productoId}/ajustar-buckets`, payload)
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

// Abre el PDF del acta de toma en una pestaña. NO se puede usar un <a href>
// directo: el endpoint exige `Authorization: Bearer` (no hay auth por cookie),
// así que hay que bajarlo por axios (con el token) y abrir el blob — igual que
// imprimirSolicitud. Antes era getTomaPdfUrl() devolviendo una ruta relativa
// que además le faltaba el prefijo /api → 404/401.
export async function imprimirToma(tomaId) {
  // El interceptor de axios añade anti-caché a todas las descargas blob.
  const res = await api.get(`${BASE}/tomas/${tomaId}/pdf`, { responseType: 'blob' })
  _openBlobInTab(res)
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

// Ubicaciones (estante/celda) de cada material de la solicitud, para surtir rápido.
export async function getSolicitudUbicaciones(solId) {
  const { data } = await api.get(`${BASE}/solicitudes/${solId}/ubicaciones`)
  return data
}

// Entrega directa de mostrador: el de inventario surte material en el acto.
// payload: { proyecto, proyecto_id?, solicitante_trabajador_id?,
//            solicitante_nombre?, almacen_origen_id?, notas?, motivo?,
//            detalles: [{producto_id, cantidad, estante_id?}] }
export async function createEntregaDirecta(payload) {
  const { data } = await api.post(`${BASE}/solicitudes/entrega-directa`, payload)
  return data
}

// Typeahead de trabajadores activos para elegir solicitante en la entrega directa.
export async function buscarTrabajadores({ q = '', limit = 20 } = {}) {
  const { data } = await api.get(`${BASE}/trabajadores-busqueda`, { params: { q, limit } })
  return data
}

// --- Solicitudes de compra (procura) ---
// Módulo persistente de lista de compra. Distinto de solicitudes de material
// (surten del stock) y de OC express (PDF desechable). Solo rol inventario.
export async function getSolicitudesCompra({ skip = 0, limit = 200, estatus, proyecto_id, proveedor } = {}) {
  const params = { skip, limit }
  if (estatus) params.estatus = estatus
  if (proyecto_id) params.proyecto_id = proyecto_id
  if (proveedor) params.proveedor = proveedor
  const { data } = await api.get(`${BASE}/solicitudes-compra/`, { params })
  return data
}

export async function getSolicitudCompra(id) {
  const { data } = await api.get(`${BASE}/solicitudes-compra/${id}`)
  return data
}

// payload: { proveedor_sugerido?, proveedor_contacto?, proyecto_id?, prioridad?,
//   notas?, detalles: [{ producto_id?|descripcion_libre?, unidad?, cantidad_solicitada, precio_estimado?, notas? }] }
export async function createSolicitudCompra(payload) {
  const { data } = await api.post(`${BASE}/solicitudes-compra/`, payload)
  return data
}

export async function updateSolicitudCompraEstado(id, estatus) {
  const { data } = await api.patch(`${BASE}/solicitudes-compra/${id}/estado`, { estatus })
  return data
}

export async function patchSolicitudCompraDetalle(id, detId, payload) {
  const { data } = await api.patch(`${BASE}/solicitudes-compra/${id}/detalles/${detId}`, payload)
  return data
}

// payload: { almacen_destino_id?, motivo?, recepciones: [{ detalle_id, cantidad_recibida }] }
export async function recibirSolicitudCompra(id, payload) {
  const { data } = await api.post(`${BASE}/solicitudes-compra/${id}/recibir`, payload)
  return data
}

export async function cancelarSolicitudCompra(id) {
  const { data } = await api.delete(`${BASE}/solicitudes-compra/${id}`)
  return data
}

// Mapa de productos con compra activa (PENDIENTE/ORDENADA) para indicadores.
export async function getProductosConCompraActiva() {
  const { data } = await api.get(`${BASE}/solicitudes-compra/productos-activos`)
  return data  // [{ producto_id, solicitud_id, folio, estatus, cantidad_solicitada, cantidad_recibida }]
}

export async function imprimirSolicitudCompra(id) {
  const res = await api.get(`${BASE}/solicitudes-compra/${id}/pdf`, { responseType: 'blob' })
  _openBlobInTab(res)
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

// Borrado en cascada: elimina la categoría junto con TODOS sus productos
// (soft-delete en backend). Devuelve { productos_eliminados, ... }.
export async function deleteCategoriaConProductos(nombre) {
  const { data } = await api.delete(
    `${BASE}/categorias-config/${encodeURIComponent(nombre)}`,
    { params: { con_productos: 1 } },
  )
  return data
}

/**
 * Cuánto puede salir de una bodega, separado en «del proyecto» y «libre».
 *
 * En lote: las pantallas de varias líneas (entrega directa, entrega de una
 * solicitud) necesitan esto para TODOS sus renglones, y una petición por
 * renglón dispararía cuarenta al abrir un modal.
 *
 * Cada item trae los dos totales, nombrados por su REGLA y no por el tipo de
 * movimiento — ver `reglaDeDisponibilidad` en utils/buckets.js:
 *   con_fallback = proyecto + general   (SALIDA, AJUSTE−, entregas)
 *   exacto       = solo el bucket       (TRASPASO, REASIGNACION)
 */
export async function getDisponibilidadBuckets({ ids, almacenId, proyectoId }) {
  // `almacenId` es opcional: con bodega se responde «¿puedo mover esto desde
  // aquí?»; sin ella, «¿existe esto para este proyecto, en algún lado?» — que
  // es la pregunta al PEDIR material, donde todavía no hay bodega elegida.
  if (!ids?.length) return { items: [] }
  const { data } = await api.get(`${BASE}/productos/disponibilidad-buckets`, {
    params: {
      ids: ids.join(','),
      almacen_id: almacenId,
      proyecto_id: proyectoId || undefined,
    },
  })
  return data
}

// --- Proyectos (endpoint del módulo inventario; distinto del módulo de proyectos) ---
export async function getProyectosInventario() {
  const { data } = await api.get(`${BASE}/proyectos/`)
  return data
}

// --- Inventario → Proyectos: plan de materiales, consumo y costos ---
// Proyectos activos que el usuario puede planear (selector "crear/abrir plan").
// Con scoping por dueño: el coordinador solo recibe SUS proyectos; inventario y
// admin, todos. Distinto de getProyectosInventario() (catálogo genérico).
export async function getProyectosPlanificables() {
  const { data } = await api.get(`${BASE}/proyectos-materiales/proyectos`)
  return data
}

// Resumen por proyecto (planeado vs. consumido, %, costos).
export async function getProyectosMateriales() {
  const { data } = await api.get(`${BASE}/proyectos-materiales/`)
  return data
}

// Detalle de un proyecto: líneas planeado vs. entregado + totales.
export async function getProyectoMaterialDetalle(proyectoId) {
  const { data } = await api.get(`${BASE}/proyectos-materiales/${proyectoId}`)
  return data
}

// Reemplaza el plan completo del proyecto. `lineas` = [{ producto_id, cantidad_planeada, notas? }]
export async function guardarPlanMateriales(proyectoId, lineas) {
  const { data } = await api.post(`${BASE}/proyectos-materiales/${proyectoId}/plan`, { lineas })
  return data
}

export async function eliminarLineaPlan(proyectoId, lineaId) {
  const { data } = await api.delete(`${BASE}/proyectos-materiales/${proyectoId}/plan/${lineaId}`)
  return data
}

// Bitácora de cambios del plan (más reciente primero).
export async function getProyectoPlanHistorial(proyectoId, limit = 50) {
  const { data } = await api.get(`${BASE}/proyectos-materiales/${proyectoId}/historial`, { params: { limit } })
  return data
}

// Solicitudes (pedidos) ligadas al proyecto, con toda su info. El PDF se abre
// con imprimirSolicitud(id).
export async function getProyectoPedidos(proyectoId) {
  const { data } = await api.get(`${BASE}/proyectos-materiales/${proyectoId}/pedidos`)
  return data
}

/**
 * Material FÍSICO apartado al proyecto, desglosado por bodega.
 *
 * Distinto del detalle del proyecto: aquél compara planeado contra consumido
 * (qué se pensaba usar y qué ya se entregó); esto dice qué hay guardado ahora
 * mismo a nombre del proyecto. Antes había que entrar bodega por bodega y
 * sumar a mano.
 */
export async function getProyectoExistencias(proyectoId) {
  const { data } = await api.get(`${BASE}/proyectos-materiales/${proyectoId}/existencias`)
  return data
}

// ── Material por proyecto: asignar, devolver, importar ──────────────────────
// Sección «Material por proyecto». El proyecto es el CONTEXTO (va en la URL),
// no un campo más del formulario: por eso ninguna de estas funciones lo recibe
// dentro del payload.

// Tarjetas de la pantalla principal. General viene SIEMPRE primero, con
// `es_general: true` y `proyecto_id: null`.
export async function getResumenAsignacion() {
  const { data } = await api.get(`${BASE}/proyectos-materiales/resumen-asignacion`)
  return data
}

/**
 * Material libre — el que no está apartado a ninguna obra.
 *
 * Espejo de `getProyectoExistencias`, para el bucket General. Este SÍ pagina:
 * General suele tener el catálogo casi entero y bajarlo completo en cada visita
 * sería regalar megabytes por nada.
 */
export async function getExistenciasGeneral({ q = '', page = 1, perPage = 50 } = {}) {
  const { data } = await api.get(`${BASE}/proyectos-materiales/general/existencias`, {
    params: { q: q || undefined, page, per_page: perPage },
  })
  return data
}

/**
 * Simula la asignación sin escribir nada.
 *
 * Devuelve una línea por material con `estado` = ok | aviso | error, más
 * `actual` y `resultado` (el antes y el después, no el incremento).
 *
 * Comparte validación con `aplicarAsignacion` en el backend: lo que promete
 * esta llamada es exactamente lo que hará la otra. Por eso la vista previa se
 * puede mostrar como un hecho y no como una estimación.
 */
export async function previsualizarAsignacion(proyectoId, { lineas, origen = 'general', modo = 'sumar' }) {
  const { data } = await api.post(
    `${BASE}/proyectos-materiales/${proyectoId}/asignar/previsualizar`,
    { lineas, origen, modo },
  )
  return data
}

// Aplica en una sola transacción. `origen: 'general'` mueve stock que ya está
// en bodega (REASIGNACION); `origen: 'entrada'` registra material que acaba de
// llegar para la obra (ENTRADA). Son cosas distintas y quien captura elige.
export async function aplicarAsignacion(proyectoId, { lineas, origen = 'general', modo = 'sumar', motivo }) {
  const { data } = await api.post(
    `${BASE}/proyectos-materiales/${proyectoId}/asignar`,
    { lineas, origen, modo, motivo },
  )
  return data
}

// Saca material del proyecto. Sin `destino_proyecto_id` vuelve a General.
// Nunca es una salida: el material no deja el almacén, solo cambia de etiqueta.
export async function devolverMaterialProyecto(proyectoId, { lineas, destinoProyectoId = null, motivo }) {
  const { data } = await api.post(
    `${BASE}/proyectos-materiales/${proyectoId}/devolver`,
    { lineas, destino_proyecto_id: destinoProyectoId, motivo },
  )
  return data
}

// Plantilla de TRES columnas (SKU · Cantidad · Bodega), pre-llenada con los
// materiales que el proyecto ya tiene. La cantidad va vacía a propósito: para
// que subir el archivo sin tocarlo no duplique nada.
export async function descargarPlantillaAsignacion(proyectoId, etiqueta = 'proyecto') {
  const res = await api.get(
    `${BASE}/proyectos-materiales/${proyectoId}/plantilla-asignacion`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] }))
  const a = document.createElement('a')
  a.href = url
  a.download = `asignacion_${String(etiqueta).replace(/[^\w-]/g, '') || 'proyecto'}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Sube la plantilla llena y devuelve la MISMA previsualización que la captura a
// mano. No escribe: confirmar sigue siendo `aplicarAsignacion`.
export async function importarAsignacion(proyectoId, file, { origen = 'general', modo = 'sumar' } = {}) {
  const fd = new FormData()
  fd.append('archivo', file)
  fd.append('origen', origen)
  fd.append('modo', modo)
  const { data } = await api.post(
    `${BASE}/proyectos-materiales/${proyectoId}/asignar/importar`, fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
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
// Lee el `detail` de un error que viajó como Blob (descargas con responseType
// blob). Devuelve '' si el cuerpo no era JSON.
async function _detalleDeBlob(data) {
  if (!data || typeof data.text !== 'function') return ''
  try {
    return JSON.parse(await data.text())?.detail || ''
  } catch {
    return ''
  }
}

// La plantilla puede bajar con el destino del stock inicial ya resuelto: las
// columnas Almacén y Proyecto vienen prellenadas con lo que se eligió aquí (y
// con lista desplegable), así el usuario solo captura el material y no puede
// escribir una bodega o un proyecto que no existe.
export async function descargarPlantillaMateriales({ almacenId, proyectoId } = {}) {
  const params = {}
  if (almacenId) params.almacen_id = almacenId
  if (proyectoId) params.proyecto_id = proyectoId
  let res
  try {
    res = await api.get(`${BASE}/productos/plantilla-importar`, { params, responseType: 'blob' })
  } catch (err) {
    // Con responseType blob, el 400 del backend también llega como Blob: hay que
    // leerlo para poder mostrar el motivo real (bodega/proyecto inválido).
    const detail = await _detalleDeBlob(err?.response?.data)
    if (detail) { const e = new Error(detail); e.detail = detail; throw e }
    throw err
  }
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

// `previsualizar` recorre el archivo completo pero NO escribe: devuelve el plan
// (qué se crearía, qué cambiaría campo por campo, errores y posibles duplicados)
// para confirmarlo antes de aplicar. Es el mismo endpoint y el mismo recorrido,
// así que el plan y lo aplicado no se pueden separar.
export async function importarMateriales(file, categoriaMapeo, { previsualizar = false } = {}) {
  const fd = new FormData()
  fd.append('archivo', file)
  // Mapa {nombreEnArchivo: categoriaExistente} para categorías ambiguas. Vacío
  // en la primera subida; el backend responde necesita_confirmacion si aplica.
  if (categoriaMapeo && Object.keys(categoriaMapeo).length > 0) {
    fd.append('categoria_mapeo', JSON.stringify(categoriaMapeo))
  }
  if (previsualizar) fd.append('previsualizar', '1')
  const { data } = await api.post(`${BASE}/productos/importar`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// --- Stock mínimo en masa ---
// Sugiere el mínimo a partir del consumo real: unidades que salen por día en los
// últimos `diasConsumo`, por los `diasCobertura` que se quieran aguantar.
export async function sugerirMinimos({ productoIds, diasConsumo = 30, diasCobertura = 15 }) {
  const { data } = await api.post(`${BASE}/productos/minimos/sugerencia`, {
    producto_ids: productoIds,
    dias_consumo: diasConsumo,
    dias_cobertura: diasCobertura,
  })
  return data  // { dias_consumo, dias_cobertura, items: [...] }
}

// Aplica el mínimo a varios productos. Acepta un valor único para todos
// ({productoIds, stockMinimo}) o uno por producto ({items:[{id, stock_minimo}]}).
export async function actualizarMinimos({ productoIds, stockMinimo, items }) {
  const payload = items ? { items } : { producto_ids: productoIds, stock_minimo: stockMinimo }
  const { data } = await api.patch(`${BASE}/productos/minimos`, payload)
  return data  // { actualizados, sin_cambios, errores }
}

// --- Historial de importaciones y deshacer ---
// Cada carga masiva queda registrada con lo que le hizo a cada producto y los
// valores previos, que es lo que permite revertirla.
export async function getImportaciones(limit = 20) {
  const { data } = await api.get(`${BASE}/productos/importaciones`, { params: { limit } })
  return data
}

export async function getImportacionDetalle(id) {
  const { data } = await api.get(`${BASE}/productos/importaciones/${id}`)
  return data
}

// Revierte una importación. Solo deshace lo que sigue igual que como lo dejó:
// lo que se editó después se respeta y viene reportado en `notas`.
export async function deshacerImportacion(id) {
  const { data } = await api.post(`${BASE}/productos/importaciones/${id}/deshacer`, {})
  return data
}

// --- Imágenes de productos → Cloudflare R2 (WebP) ---
// Conteos por estado del pipeline: { enabled, ok, pendientes, procesando, error, total }.
// `enabled` es false en entornos sin R2 configurado (ej. local) → el SPA oculta la UI.
export async function getEstadoImagenes() {
  const { data } = await api.get(`${BASE}/productos/imagenes/estado`)
  return data
}

// Backfill: encola TODO el catálogo con imagen externa aún no migrada a R2.
// Devuelve { job_id, encolados }. El progreso llega por el evento de socket
// 'producto:imagen_progreso'.
export async function sincronizarImagenes() {
  const { data } = await api.post(`${BASE}/productos/imagenes/sincronizar`, {})
  return data
}

// Lista productos y categorías cuya imagen falló al subir a R2 (estado ERROR),
// con la URL que falló y el motivo, para que el usuario la corrija.
// Devuelve { total, items: [{ tipo, id, codigo, nombre, url_fallida, error }] }.
export async function getImagenesErrores() {
  const { data } = await api.get(`${BASE}/productos/imagenes/errores`)
  return data
}

// Exporta el catálogo activo ya lleno, para editar en Excel y reimportar (el
// import detecta y aplica solo los cambios).
// Acepta los MISMOS filtros del catálogo: sin ellos baja todo; con ellos baja
// solo esa selección, y reimportarla no afecta a los productos que no venían.
export async function exportarProductos({ categoria, q, stock, imagen, unidad, compra } = {}) {
  const params = {}
  if (categoria) params.categoria = categoria
  if (q) params.q = q
  if (stock) params.stock = stock
  if (imagen) params.imagen = imagen
  if (unidad) params.unidad = unidad
  if (compra) params.compra = 'activa'
  const filtrado = Object.keys(params).length > 0
  const res = await api.get(`${BASE}/productos/exportar`, { params, responseType: 'blob' })
  const blob = new Blob([res.data], { type: res.headers['content-type'] })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filtrado ? 'catalogo_filtrado.xlsx' : 'catalogo_materiales.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
