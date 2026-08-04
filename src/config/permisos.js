/**
 * Autorización del cliente: quién puede abrir qué ruta.
 *
 * ── Por qué existe este archivo ──────────────────────────────────────────────
 * Antes había dos fuentes de verdad que nadie obligaba a coincidir:
 *   · `App.jsx`      — expresiones sueltas dentro de cada `<RoleRoute allow={…}>`
 *   · `config/menus.js` — la lista de enlaces que ve cada rol
 * Añadir una pantalla exigía tocar las dos, y olvidar una daba el peor de los
 * resultados: un enlace visible en el menú que al pulsarlo rebota a `/` sin
 * explicar nada. Ahora `App.jsx` consume el mapa de abajo y un test
 * (`permisos.test.js`) verifica que TODO enlace de `menus.js` esté permitido
 * para el rol que lo ve.
 *
 * ── Qué NO es ────────────────────────────────────────────────────────────────
 * Esto no es seguridad: el bundle es público y cualquiera puede saltárselo desde
 * las devtools. La autoridad es el backend, que revalida cada endpoint. Lo de
 * aquí sirve para no pintar pantallas que después van a devolver 403.
 */

/**
 * Deriva las banderas de permiso a partir del usuario autenticado.
 * Espeja `is_admin()` / `puede_gestionar_sistema()` del backend.
 */
export function buildPerms(user) {
  const role = user?.role
  const isSuperAdmin = role === 'super_admin'
  // `isAdmin` = acceso a la operación de RRHH/nómina. `sistemas` NO entra aquí
  // a propósito: administra el sistema (cuentas, sesiones, servidor), no los
  // sueldos ni los expedientes.
  const isAdmin = role === 'admin' || isSuperAdmin
  // Eje independiente: administración del sistema. super_admin cruza los dos
  // porque es la cuenta de recuperación.
  const isSistemas = role === 'sistemas'
  const puedeGestionarSistema = isSistemas || isSuperAdmin
  const isCoordinador = role === 'coordinador'
  const isInventario = role === 'inventario'
  const isSolicitante = role === 'solicitante_material'
  const isFinanzas = role === 'finanzas'
  return {
    role,
    isSuperAdmin,
    isAdmin,
    isSistemas,
    puedeGestionarSistema,
    isCoordinador,
    isInventario,
    isSolicitante,
    isFinanzas,
    // El panel de sistemas exige 2FA; lo reflejamos en el cliente para poder
    // mandar a inscribirlo ANTES de que el backend devuelva 403 y la pantalla
    // quede en un error seco. El backend sigue siendo la autoridad.
    tiene2fa: !!user?.totp_enabled,
  }
}

/**
 * Mapa `ruta absoluta → puede abrirla`, para el usuario que representan `perms`.
 * Las rutas con parámetro se escriben igual que en `App.jsx` (`/empleados/:id`).
 */
export function construirAcceso(perms) {
  const { role, isAdmin, isCoordinador, puedeGestionarSistema } = perms || {}

  // ── Grupos de acceso ───────────────────────────────────────────────────────
  // El módulo de inventario completo: su rol dedicado, y admin por herencia.
  const inventario = role === 'inventario' || isAdmin
  // Plan de materiales por proyecto: además de inventario/admin, el coordinador
  // planea los materiales de SUS proyectos (crea/abre el plan y selecciona
  // materiales). Solo abre esas pantallas, no el resto del módulo.
  const planMateriales = inventario || isCoordinador
  // Pedir material y consultar lo propio (herramientas, incidencias, pedidos).
  // El coordinador entró aquí el 2026-05-25.
  const solicitar =
    role === 'solicitante_material' || role === 'inventario' || role === 'coordinador' || isAdmin
  // Operación de obra: horas, credenciales.
  const operar = isAdmin || isCoordinador
  // Compras (procura) es EXCLUSIVO de inventario: admin es RRHH y no entra.
  const soloInventario = role === 'inventario' || role === 'super_admin'

  return {
    // Abiertas a cualquier sesión iniciada.
    '/': true,
    '/perfil': true,
    '/perfil/:id': true,
    '/directorio': true,

    // Panel financiero: home del rol finanzas; el admin también puede verlo.
    '/finanzas': role === 'finanzas' || isAdmin,

    // Panel de sistemas (TI/soporte).
    '/sistemas': puedeGestionarSistema,
    '/sistemas/peticiones': puedeGestionarSistema,
    '/sistemas/sesiones': puedeGestionarSistema,
    '/sistemas/seguridad': puedeGestionarSistema,
    '/sistemas/cuentas': puedeGestionarSistema,
    '/sistemas/mantenimiento': puedeGestionarSistema,
    // La gestión de cuentas se movió de admin al rol sistemas.
    '/usuarios': puedeGestionarSistema,

    // RRHH / nómina.
    // La bitácora completa es del eje de RRHH. El rol `sistemas` usa
    // /sistemas/seguridad, que es la misma bitácora filtrada a seguridad.
    '/bitacora': isAdmin,
    '/manual': isAdmin,
    '/manual-coordinador': isCoordinador || isAdmin,
    '/metricas': isAdmin,
    '/prenomina': isAdmin,
    '/prenomina/:fecha': isAdmin,
    '/prenomina/:fecha/editar': isAdmin,
    '/prenomina/:fecha/pago': isAdmin,
    '/prestamos': isAdmin,
    '/ajustes': isAdmin,
    '/ajustes/:id': isAdmin,
    '/proyecto-total': isAdmin,
    '/historico': isAdmin,
    '/historico/:fecha': isAdmin,

    // Empleados y Proyectos: solo admin (el coordinador no los ve en Flask).
    '/empleados': isAdmin,
    '/empleados/bajas': isAdmin,
    '/empleados/nuevo': isAdmin,
    '/empleados/importar': isAdmin,
    '/empleados/:id': isAdmin,
    '/empleados/:id/editar': isAdmin,
    '/proyectos': isAdmin,

    // Admin + Coordinador.
    '/horas': operar,
    '/horas/movil': isCoordinador,
    '/horas/qr': isAdmin,
    '/horas/:id': operar,
    '/credenciales': operar,
    '/ficha': isCoordinador || isAdmin,
    '/mis-proyectos': isCoordinador || isAdmin,

    // Inventario.
    '/inventario': inventario,
    '/inventario/actividad': inventario,
    '/inventario/catalogo': inventario,
    '/inventario/material-proyecto': inventario,
    '/inventario/material-proyecto/general': inventario,
    '/inventario/material-proyecto/:id': inventario,
    '/inventario/proyectos': planMateriales,
    '/inventario/proyectos/:id': planMateriales,
    '/inventario/productos/:id/kardex': inventario,
    '/inventario/bajo-minimo': inventario,
    '/inventario/reportes': inventario,
    '/inventario/etiquetas': inventario,
    '/inventario/importar': inventario,
    '/inventario/almacenes': inventario,
    '/inventario/qr/:id': inventario,
    '/inventario/movimientos': inventario,
    '/inventario/movimientos/nuevo': inventario,
    '/inventario/solicitudes': solicitar,
    '/inventario/entrega-directa': inventario,
    '/inventario/solicitudes-compra': soloInventario,
    '/inventario/scanner': inventario,
    '/inventario/tomas': inventario,
    '/inventario/tomas/:id': inventario,
    '/inventario/manual': inventario,

    // Pedir material: todos los roles con permiso de solicitar.
    '/inventario/mis-pedidos': solicitar,

    // Herramientas — inventario + admin.
    '/inventario/herramientas': inventario,
    '/inventario/herramientas/unidades': inventario,
    '/inventario/herramientas/unidades/:id': solicitar,
    '/inventario/herramientas/asignaciones': inventario,
    '/inventario/herramientas/mantenimientos': inventario,
    '/inventario/herramientas/incidencias': inventario,

    // Vistas del solicitante.
    '/inventario/mis-herramientas': solicitar,
    '/inventario/mis-incidencias': solicitar,
  }
}

/** Roles que el sistema conoce. Lo usa el test de consistencia con `menus.js`. */
export const ROLES = [
  'admin',
  'super_admin',
  'sistemas',
  'coordinador',
  'inventario',
  'finanzas',
  'solicitante_material',
]
