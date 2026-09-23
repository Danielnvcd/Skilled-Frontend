import api from './axios'

// Lectores biométricos Hikvision. Todos estos endpoints exigen rol admin o
// super_admin (mismo eje que Empleados y Nómina): el lector decide quién abre
// una puerta y guarda la cara de la gente, así que no es del eje de sistemas.
//
// La contraseña del lector viaja HACIA el backend al crear o cambiarla, pero
// nunca vuelve: las respuestas solo traen `tiene_password: true|false`.

// ── Dispositivos ────────────────────────────────────────────────────────────

export async function getDispositivos() {
  const { data } = await api.get('/hikvision/dispositivos')
  return data.items
}

export async function getDispositivo(id) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}`)
  return data
}

export async function crearDispositivo(payload) {
  const { data } = await api.post('/hikvision/dispositivos', payload)
  return data
}

/**
 * Actualiza el lector. Mandar `password: ''` significa «no la cambies»:
 * el backend solo la reemplaza si llega con contenido, porque un lector sin
 * contraseña no serviría de nada.
 */
export async function actualizarDispositivo(id, payload) {
  const { data } = await api.put(`/hikvision/dispositivos/${id}`, payload)
  return data
}

export async function eliminarDispositivo(id) {
  const { data } = await api.delete(`/hikvision/dispositivos/${id}`)
  return data
}

/**
 * Prueba de vida y credenciales. Devuelve { ok, dispositivo, info, hora }.
 *
 * OJO al llamarlo en bucle: Hikvision bloquea la cuenta ~30 minutos tras
 * varios intentos con contraseña incorrecta, y el backend limita a 10/min
 * justamente por eso.
 */
export async function probarDispositivo(id) {
  const { data } = await api.post(`/hikvision/dispositivos/${id}/probar`)
  return data
}

// ── Empleados y sincronización ──────────────────────────────────────────────

/** Empleados de oficina con su estado en ESTE lector, más un resumen. */
export async function getEmpleadosDeLector(id) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}/empleados`)
  return data
}

/**
 * Envía los empleados indicados al lector.
 *
 * Responde 200 aunque alguno falle: el detalle por persona viene en
 * `resultados`, y `resumen` trae los totales. Que uno falle no cancela a los
 * demás, así que la UI debe pintar la lista completa, no solo el error.
 */
export async function sincronizarEmpleados(id, trabajadorIds) {
  const { data } = await api.post(`/hikvision/dispositivos/${id}/sincronizar`, {
    trabajador_ids: trabajadorIds,
  })
  return data
}

export async function quitarEmpleadoDeLector(id, trabajadorId) {
  const { data } = await api.delete(`/hikvision/dispositivos/${id}/empleados/${trabajadorId}`)
  return data
}

/**
 * Cambia la foto del empleado y la manda al lector en un solo paso.
 *
 * El backend PRIMERO la prueba contra el lector y solo si su motor facial la
 * acepta la guarda como foto de perfil. Si la rechaza responde 422 con el
 * motivo y no cambia nada: ni el ERP ni el rostro que el lector ya tenía.
 * Devuelve { ok, accion, empleado } con la fila ya actualizada.
 */
export async function cambiarFotoEnLector(id, trabajadorId, archivo) {
  const fd = new FormData()
  fd.append('foto', archivo)
  const { data } = await api.post(
    `/hikvision/dispositivos/${id}/empleados/${trabajadorId}/foto`, fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

// Rutas de imágenes con JWT: se pintan con <AuthImage src={...} />, no con un
// <img src> directo (el navegador no manda el header Authorization).

/** Miniatura de la foto de perfil. `version` cambia con cada foto nueva. */
export function rutaFotoPerfil(trabajadorId, version) {
  return `/trabajadores/${trabajadorId}/foto/thumb${version ? `?v=${version}` : ''}`
}

/** Rostro que el lector tiene registrado: la cara con la que compara de verdad. */
export function rutaRostroLector(id, trabajadorId, version) {
  return `/hikvision/dispositivos/${id}/empleados/${trabajadorId}/rostro${version ? `?v=${version}` : ''}`
}

// ── Equipo: estado, reloj y auditoría ───────────────────────────────────────

/** Info del equipo, reloj (con `desfase_segundos` y `en_hora`) y capacidad usada. */
export async function getEstadoEquipo(id) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}/estado`)
  return data
}

/** Pone el reloj del lector en la hora del servidor. Queda en la bitácora. */
export async function ajustarHoraLector(id) {
  const { data } = await api.post(`/hikvision/dispositivos/${id}/hora`)
  return data
}

/**
 * ERP vs. equipo: `solo_en_equipo` (dados de alta fuera del ERP — abren la
 * puerta sin que el ERP lo sepa) y `solo_en_erp` (el ERP cree que están y el
 * equipo ya no los tiene).
 */
export async function getAuditoria(id) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}/auditoria`)
  return data
}

/** Borra del equipo a un usuario que NO dio de alta el ERP. */
export async function borrarUsuarioAjeno(id, employeeNo) {
  const { data } = await api.delete(
    `/hikvision/dispositivos/${id}/usuarios-equipo/${encodeURIComponent(employeeNo)}`,
  )
  return data
}

// ── Actividad ───────────────────────────────────────────────────────────────

/**
 * Eventos de acceso GUARDADOS en el ERP (más recientes primero) y el resumen
 * de hoy. No consulta al lector: los guarda el proceso de escucha en cuanto
 * ocurren y avisa por Socket.IO con `hikvision:evento`.
 *
 * `tiempo_real.en_vivo` dice si esa escucha está conectada ahora; si no, la
 * lista puede ir atrasada y conviene ofrecer `traerEventos`.
 *
 * filtro: 'todos' | 'permitidos' | 'denegados'; horas: 1..744; limite: 1..200.
 */
export async function getEventos(id, { filtro = 'todos', horas = 24, limite = 100 } = {}) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}/eventos`, {
    params: { filtro, horas, limite },
  })
  return data
}

/** Trae del lector lo pendiente, una vez. Para cuando la escucha no corre. */
export async function traerEventos(id) {
  const { data } = await api.post(`/hikvision/dispositivos/${id}/eventos/sincronizar`)
  return data
}

// Eventos de Socket.IO que refrescan la actividad: uno nuevo guardado, o la
// escucha que se conectó/desconectó (cambia el indicador «En vivo»).
export const EVENTOS_ACTIVIDAD = ['hikvision:evento', 'hikvision:changed']

/** Ruta (para <AuthImage>/<ImageViewer authPath>) de la foto que tomó el lector. */
export function rutaCaptura(id, captura) {
  return `/hikvision/dispositivos/${id}/eventos/captura?ruta=${encodeURIComponent(captura)}`
}

// ── Puerta y relé ───────────────────────────────────────────────────────────

/** Parámetros de la puerta (incluye cuántos segundos cierra el relé) y estado en vivo. */
export async function getPuerta(id) {
  const { data } = await api.get(`/hikvision/dispositivos/${id}/puerta`)
  return data
}

/**
 * Apertura remota: cierra el relé durante su `openDuration` configurado.
 *
 * Abre una puerta FÍSICA y queda en la bitácora con el usuario que lo hizo,
 * incluso si falla. El backend limita a 6/min a propósito.
 *
 * No hace falta llamarlo para el uso normal: los empleados sincronizados
 * activan el relé solos al ser reconocidos por el lector.
 */
export async function abrirPuerta(id) {
  const { data } = await api.post(`/hikvision/dispositivos/${id}/puerta/abrir`)
  return data
}

// ── Etiquetas de estado ─────────────────────────────────────────────────────
// Espejo de los estados que guarda el backend en `hikvision_sync_empleado`
// (más `NO_AGREGADO`, que es la ausencia de fila).

export const ESTADOS = {
  NO_AGREGADO: { texto: 'No agregado', tono: 'neutral' },
  PENDIENTE: { texto: 'Pendiente', tono: 'warning' },
  SINCRONIZADO: { texto: 'Sincronizado', tono: 'success' },
  // Está en el lector, pero su foto, nombre o número cambiaron después en la
  // ficha. El backend lo deriva al listar; no es un estado guardado.
  DESACTUALIZADO: { texto: 'Desactualizado', tono: 'info' },
  ERROR: { texto: 'Error', tono: 'danger' },
}

export function etiquetaEstado(estado) {
  return ESTADOS[estado] || ESTADOS.NO_AGREGADO
}
