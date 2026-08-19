import { describe, it, expect } from 'vitest'
import { buildPerms, construirAcceso, ROLES } from './permisos'
import { MENUS, BOTTOM_NAV, DEFAULT_MENU } from './menus'

const accesoDe = (role) => construirAcceso(buildPerms({ role }))

// ─────────────────────────────────────────────────────────────────────────────
// 1. Equivalencia con la implementación anterior
//
// Antes de este refactor, cada `<RoleRoute allow={…}>` de App.jsx llevaba su
// propia expresión. Abajo están TRANSCRITAS TAL CUAL, y el test comprueba que
// el mapa nuevo da el mismo booleano para cada rol y cada ruta. Es la red que
// permite afirmar que mover los permisos a una tabla no cambió quién entra a
// dónde. Si algún día se cambia un permiso a propósito, se cambia aquí también
// y el diff deja constancia de la decisión.
// ─────────────────────────────────────────────────────────────────────────────
function accesoOriginal(role) {
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin' || isSuperAdmin
  const puedeGestionarSistema = role === 'sistemas' || isSuperAdmin
  const isCoordinador = role === 'coordinador'

  const isInventario = role === 'inventario' || isAdmin
  const canPlanMateriales = isInventario || isCoordinador
  const canSolicit =
    role === 'solicitante_material' || role === 'inventario' || role === 'coordinador' || isAdmin
  const canOperar = isAdmin || isCoordinador
  const inventarioSolo = role === 'inventario' || role === 'super_admin'

  return {
    '/': true,
    '/perfil': true,
    '/perfil/:id': true,
    '/directorio': true,
    '/finanzas': role === 'finanzas' || isAdmin,
    '/sistemas': puedeGestionarSistema,
    '/sistemas/peticiones': puedeGestionarSistema,
    '/sistemas/sesiones': puedeGestionarSistema,
    '/sistemas/seguridad': puedeGestionarSistema,
    '/sistemas/cuentas': puedeGestionarSistema,
    '/sistemas/mantenimiento': puedeGestionarSistema,
    '/usuarios': puedeGestionarSistema,
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
    '/empleados': isAdmin,
    '/empleados/bajas': isAdmin,
    '/empleados/nuevo': isAdmin,
    '/empleados/importar': isAdmin,
    '/empleados/:id': isAdmin,
    '/empleados/:id/editar': isAdmin,
    '/proyectos': isAdmin,
    '/horas': canOperar,
    '/horas/movil': isCoordinador,
    '/horas/qr': isAdmin,
    '/horas/:id': canOperar,
    '/credenciales': canOperar,
    '/ficha': isCoordinador || isAdmin,
    '/mis-proyectos': isCoordinador || isAdmin,
    '/inventario': isInventario,
    '/inventario/actividad': isInventario,
    '/inventario/catalogo': isInventario,
    '/inventario/material-proyecto': isInventario,
    '/inventario/material-proyecto/general': isInventario,
    '/inventario/material-proyecto/:id': isInventario,
    '/inventario/proyectos': canPlanMateriales,
    '/inventario/proyectos/:id': canPlanMateriales,
    '/inventario/productos/:id/kardex': isInventario,
    '/inventario/bajo-minimo': isInventario,
    '/inventario/reportes': isInventario,
    '/inventario/etiquetas': isInventario,
    '/inventario/importar': isInventario,
    '/inventario/almacenes': isInventario,
    '/inventario/qr/:id': isInventario,
    '/inventario/movimientos': isInventario,
    '/inventario/movimientos/nuevo': isInventario,
    '/inventario/solicitudes': canSolicit,
    '/inventario/entrega-directa': isInventario,
    '/inventario/solicitudes-compra': inventarioSolo,
    '/inventario/scanner': isInventario,
    '/inventario/tomas': isInventario,
    '/inventario/tomas/:id': isInventario,
    '/inventario/manual': isInventario,
    '/inventario/mis-pedidos': canSolicit,
    '/inventario/herramientas': isInventario,
    '/inventario/herramientas/unidades': isInventario,
    '/inventario/herramientas/unidades/:id': canSolicit,
    '/inventario/herramientas/asignaciones': isInventario,
    '/inventario/herramientas/mantenimientos': isInventario,
    '/inventario/herramientas/incidencias': isInventario,
    '/inventario/mis-herramientas': canSolicit,
    '/inventario/mis-incidencias': canSolicit,
  }
}

describe('construirAcceso — equivalencia con los permisos originales', () => {
  it.each(ROLES)('no cambia ningún permiso para el rol %s', (role) => {
    const nuevo = accesoDe(role)
    const viejo = accesoOriginal(role)
    // Mismas rutas cubiertas...
    expect(Object.keys(nuevo).sort()).toEqual(Object.keys(viejo).sort())
    // ...y misma respuesta en cada una.
    for (const ruta of Object.keys(viejo)) {
      expect({ ruta, permitido: !!nuevo[ruta] }).toEqual({ ruta, permitido: !!viejo[ruta] })
    }
  })

  it('un usuario sin sesión no accede a nada protegido', () => {
    const acceso = construirAcceso(buildPerms(null))
    expect(acceso['/empleados']).toBeFalsy()
    expect(acceso['/sistemas']).toBeFalsy()
    expect(acceso['/inventario/catalogo']).toBeFalsy()
  })

  it('no revienta si se le pasa nada', () => {
    expect(() => construirAcceso(undefined)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. El motivo de existir del módulo: menú y autorización no pueden divergir.
// ─────────────────────────────────────────────────────────────────────────────
function rutasDelMenu(role) {
  const grupos = MENUS[role] ?? DEFAULT_MENU
  const rutas = grupos.flatMap((g) => g.items.map((i) => i.path))
  return [...new Set([...rutas, ...(BOTTOM_NAV[role] ?? []).map((i) => i.path)])]
}

describe('menus.js concuerda con los permisos', () => {
  it.each(ROLES)('todo enlace visible para %s apunta a una ruta que ese rol puede abrir', (role) => {
    const acceso = accesoDe(role)
    const prohibidos = rutasDelMenu(role).filter((p) => !acceso[p])
    // Si esto falla: o el enlace sobra en menus.js, o falta el permiso en
    // permisos.js. Un enlace sin permiso rebota al inicio sin decir por qué.
    expect({ role, prohibidos }).toEqual({ role, prohibidos: [] })
  })

  it.each(ROLES)('todo enlace visible para %s corresponde a una ruta declarada', (role) => {
    const acceso = accesoDe(role)
    const desconocidos = rutasDelMenu(role).filter((p) => !(p in acceso))
    // Atrapa el typo (`/inventario/catalogos`) y el enlace a una pantalla que
    // se borró del router pero se quedó en el menú.
    expect({ role, desconocidos }).toEqual({ role, desconocidos: [] })
  })
})
