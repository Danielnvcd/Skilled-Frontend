import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
// Login se carga eager: es la primera pantalla que ve el usuario sin sesión
// y evitamos un spinner extra en el arranque. El resto de páginas se carga
// lazy para partir el bundle en chunks por ruta — el SW del PWA precachea
// todos los chunks (globPatterns **/*.js), así que el offline y el
// autoUpdate siguen funcionando igual que con el bundle único. Dashboard
// va lazy a propósito: arrastra recharts (~370 kB) que no debe pagar el
// resto de roles en el arranque.
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Verify2FA = lazy(() => import('./pages/Verify2FA'))
const Profile = lazy(() => import('./pages/Profile'))
const Directorio = lazy(() => import('./pages/Directorio'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const SistemasEstado = lazy(() => import('./pages/sistemas/EstadoServidor'))
const SistemasPeticiones = lazy(() => import('./pages/sistemas/Peticiones'))
const SistemasSesiones = lazy(() => import('./pages/sistemas/SesionesActivas'))
const SistemasSeguridad = lazy(() => import('./pages/sistemas/EventosSeguridad'))
const SistemasCuentas = lazy(() => import('./pages/sistemas/Cuentas'))
const SistemasMantenimiento = lazy(() => import('./pages/sistemas/Mantenimiento'))
const EmpleadosList = lazy(() => import('./pages/empleados/EmpleadosList'))
const EmpleadoForm = lazy(() => import('./pages/empleados/EmpleadoForm'))
const EmpleadoView = lazy(() => import('./pages/empleados/EmpleadoView'))
const EmpleadosImport = lazy(() => import('./pages/empleados/EmpleadosImport'))
const ProyectosList = lazy(() => import('./pages/proyectos/ProyectosList'))
const MisProyectos = lazy(() => import('./pages/proyectos/MisProyectos'))
const ReportesList = lazy(() => import('./pages/horas/ReportesList'))
const ReporteCaptura = lazy(() => import('./pages/horas/ReporteCaptura'))
const PrenominaList = lazy(() => import('./pages/prenomina/PrenominaList'))
const PrenominaGenerar = lazy(() => import('./pages/prenomina/PrenominaGenerar'))
const PrenominaEditar = lazy(() => import('./pages/prenomina/PrenominaEditar'))
const PrenominaResumenPago = lazy(() => import('./pages/prenomina/PrenominaResumenPago'))
const PrestamosList = lazy(() => import('./pages/prestamos/PrestamosList'))
const AjustesList = lazy(() => import('./pages/ajustes/AjustesList'))
const AjustePeriodoDetalle = lazy(() => import('./pages/ajustes/AjustePeriodoDetalle'))
const CredencialesList = lazy(() => import('./pages/credenciales/CredencialesList'))
const ProyectoTotal = lazy(() => import('./pages/proyecto-total/ProyectoTotal'))
const HistoricoList = lazy(() => import('./pages/historico/HistoricoList'))
const HistoricoDetalle = lazy(() => import('./pages/historico/HistoricoDetalle'))
const Bitacora = lazy(() => import('./pages/Bitacora'))
const Metricas = lazy(() => import('./pages/Metricas'))
const InventarioDashboard = lazy(() => import('./pages/inventario/InventarioDashboard'))
const PortadaAlmacenes = lazy(() => import('./pages/inventario/PortadaAlmacenes'))
const CatalogoProductos = lazy(() => import('./pages/inventario/CatalogoProductos'))
const ProyectosInventario = lazy(() => import('./pages/inventario/ProyectosInventario'))
const MaterialPorProyecto = lazy(() => import('./pages/inventario/MaterialPorProyecto'))
const MaterialProyectoDetalle = lazy(() => import('./pages/inventario/MaterialProyectoDetalle'))
const MaterialGeneral = lazy(() => import('./pages/inventario/MaterialGeneral'))
const ProyectoInventarioDetalle = lazy(() => import('./pages/inventario/ProyectoInventarioDetalle'))
const ProductoKardex = lazy(() => import('./pages/inventario/ProductoKardex'))
const BajoMinimo = lazy(() => import('./pages/inventario/BajoMinimo'))
const Reportes = lazy(() => import('./pages/inventario/Reportes'))
const Etiquetas = lazy(() => import('./pages/inventario/Etiquetas'))
const AlmacenesEstantes = lazy(() => import('./pages/inventario/AlmacenesEstantes'))
const Tomas = lazy(() => import('./pages/inventario/Tomas'))
const TomaDetalle = lazy(() => import('./pages/inventario/TomaDetalle'))
const MovimientosInventario = lazy(() => import('./pages/inventario/MovimientosInventario'))
const RegistrarMovimiento = lazy(() => import('./pages/inventario/RegistrarMovimiento'))
const SolicitudesMaterial = lazy(() => import('./pages/inventario/SolicitudesMaterial'))
const EntregaDirecta = lazy(() => import('./pages/inventario/EntregaDirecta'))
const SolicitudesCompra = lazy(() => import('./pages/inventario/SolicitudesCompra'))
const MisPedidos = lazy(() => import('./pages/inventario/MisPedidos'))
const ScannerMovil = lazy(() => import('./pages/inventario/ScannerMovil'))
const ImportarMateriales = lazy(() => import('./pages/inventario/ImportarMateriales'))
const QREstante = lazy(() => import('./pages/inventario/QREstante'))
const HerramientasCatalogo = lazy(() => import('./pages/inventario/HerramientasCatalogo'))
const HerramientasUnidades = lazy(() => import('./pages/inventario/HerramientasUnidades'))
const HerramientaUnidadFicha = lazy(() => import('./pages/inventario/HerramientaUnidadFicha'))
const AsignacionesHerramienta = lazy(() => import('./pages/inventario/AsignacionesHerramienta'))
const MantenimientosHerramienta = lazy(() => import('./pages/inventario/MantenimientosHerramienta'))
const IncidenciasYBajas = lazy(() => import('./pages/inventario/IncidenciasYBajas'))
const MisHerramientas = lazy(() => import('./pages/inventario/MisHerramientas'))
const MisIncidencias = lazy(() => import('./pages/inventario/MisIncidencias'))
const FichaTecnica = lazy(() => import('./pages/ficha/FichaTecnica'))
const HorasMovil = lazy(() => import('./pages/horas/HorasMovil'))
const HorasAdminQR = lazy(() => import('./pages/horas/HorasAdminQR'))
const ManualAdmin = lazy(() => import('./pages/manual/ManualAdmin'))
const ManualCoordinador = lazy(() => import('./pages/manual/ManualCoordinador'))
const ManualInventario = lazy(() => import('./pages/manual/ManualInventario'))
const FinanzasPanel = lazy(() => import('./pages/finanzas/FinanzasPanel'))

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950">
      <div className="flex flex-col items-center gap-3 text-ink-600 dark:text-ink-300">
        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-sm">Cargando aplicación...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return user ? children : <Navigate to="/login" />
}

function RoleRoute({ allow, children }) {
  if (!allow) return <Navigate to="/" replace />
  return children
}

function RoleBasedHome() {
  const { user } = useAuth()
  if (user?.role === 'inventario') return <PortadaAlmacenes />
  if (user?.role === 'finanzas') return <FinanzasPanel />
  if (user?.role === 'solicitante_material') return <Navigate to="/inventario/mis-pedidos" replace />
  if (user?.role === 'coordinador') return <Navigate to="/mis-proyectos" replace />
  // `sistemas` NO ve el Dashboard: es la portada de RRHH y sus llamadas
  // (nómina, empleados) le devolverían 403. Su portada es el panel.
  if (user?.role === 'sistemas') return <Navigate to="/sistemas" replace />
  return <Dashboard />
}

export default function App() {
  const { user, isAdmin, isCoordinador, puedeGestionarSistema } = useAuth()

  const role = user?.role
  const isInventario = role === 'inventario' || isAdmin
  // Plan de materiales por proyecto: además del rol inventario/admin, el
  // coordinador planea los materiales de sus proyectos (crea/abre el plan y
  // selecciona materiales). Solo abre ESAS pantallas, no el resto de inventario.
  const canPlanMateriales = isInventario || isCoordinador
  // Coordinador también puede crear y ver SUS solicitudes/pedidos (cambio 2026-05-25).
  const canSolicit   = role === 'solicitante_material' || role === 'inventario' || role === 'coordinador' || isAdmin
  const canOperar    = isAdmin || isCoordinador
  // Compras (procura) es EXCLUSIVO de inventario: admin es RH y no entra.
  const inventarioSolo = role === 'inventario' || role === 'super_admin'

  return (
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<RoleBasedHome />} />
        <Route path="perfil"      element={<Profile />} />
        <Route path="perfil/:id"  element={<Profile />} />
        <Route path="directorio"  element={<Directorio />} />

        {/* Panel financiero: home del rol finanzas; el admin también puede verlo */}
        <Route path="finanzas"    element={<RoleRoute allow={role === 'finanzas' || isAdmin}><FinanzasPanel /></RoleRoute>} />

        {/* Panel de sistemas (TI/soporte). Eje de permisos independiente del de
            admin/RRHH: administra el sistema, no los datos de nómina. El
            backend además exige 2FA en cada endpoint; si falta, la vista lo
            explica y manda a activarlo en lugar de fallar en seco. */}
        <Route path="sistemas"             element={<RoleRoute allow={puedeGestionarSistema}><SistemasEstado /></RoleRoute>} />
        <Route path="sistemas/peticiones"  element={<RoleRoute allow={puedeGestionarSistema}><SistemasPeticiones /></RoleRoute>} />
        <Route path="sistemas/sesiones"    element={<RoleRoute allow={puedeGestionarSistema}><SistemasSesiones /></RoleRoute>} />
        <Route path="sistemas/seguridad"   element={<RoleRoute allow={puedeGestionarSistema}><SistemasSeguridad /></RoleRoute>} />
        <Route path="sistemas/cuentas"     element={<RoleRoute allow={puedeGestionarSistema}><SistemasCuentas /></RoleRoute>} />
        <Route path="sistemas/mantenimiento" element={<RoleRoute allow={puedeGestionarSistema}><SistemasMantenimiento /></RoleRoute>} />

        {/* La gestión de cuentas se movió de admin al rol sistemas. */}
        <Route path="usuarios"                element={<RoleRoute allow={puedeGestionarSistema}><Usuarios /></RoleRoute>} />
        {/* La bitácora completa es del eje de RRHH. El rol `sistemas` usa
            /sistemas/seguridad, que es la misma bitácora filtrada a eventos de
            seguridad. Dejarla abierta aquí solo servía para pintar una pantalla
            que después el backend rechazaba con 403. */}
        <Route path="bitacora"                element={<RoleRoute allow={isAdmin}><Bitacora /></RoleRoute>} />
        <Route path="manual"                  element={<RoleRoute allow={isAdmin}><ManualAdmin /></RoleRoute>} />
        <Route path="manual-coordinador"      element={<RoleRoute allow={isCoordinador || isAdmin}><ManualCoordinador /></RoleRoute>} />
        <Route path="metricas"                element={<RoleRoute allow={isAdmin}><Metricas /></RoleRoute>} />
        <Route path="prenomina"               element={<RoleRoute allow={isAdmin}><PrenominaList /></RoleRoute>} />
        <Route path="prenomina/:fecha"        element={<RoleRoute allow={isAdmin}><PrenominaGenerar /></RoleRoute>} />
        <Route path="prenomina/:fecha/editar" element={<RoleRoute allow={isAdmin}><PrenominaEditar /></RoleRoute>} />
        <Route path="prenomina/:fecha/pago"   element={<RoleRoute allow={isAdmin}><PrenominaResumenPago /></RoleRoute>} />
        <Route path="prestamos"               element={<RoleRoute allow={isAdmin}><PrestamosList /></RoleRoute>} />
        <Route path="ajustes"                 element={<RoleRoute allow={isAdmin}><AjustesList /></RoleRoute>} />
        <Route path="ajustes/:id"             element={<RoleRoute allow={isAdmin}><AjustePeriodoDetalle /></RoleRoute>} />
        <Route path="proyecto-total"          element={<RoleRoute allow={isAdmin}><ProyectoTotal /></RoleRoute>} />
        <Route path="historico"               element={<RoleRoute allow={isAdmin}><HistoricoList /></RoleRoute>} />
        <Route path="historico/:fecha"        element={<RoleRoute allow={isAdmin}><HistoricoDetalle /></RoleRoute>} />

        {/* Empleados y Proyectos: solo admin (el coordinador no los ve en Flask) */}
        <Route path="empleados"              element={<RoleRoute allow={isAdmin}><EmpleadosList /></RoleRoute>} />
        <Route path="empleados/bajas"        element={<RoleRoute allow={isAdmin}><EmpleadosList variante="bajas" /></RoleRoute>} />
        <Route path="empleados/nuevo"        element={<RoleRoute allow={isAdmin}><EmpleadoForm modo="nuevo" /></RoleRoute>} />
        <Route path="empleados/importar"     element={<RoleRoute allow={isAdmin}><EmpleadosImport /></RoleRoute>} />
        <Route path="empleados/:id"          element={<RoleRoute allow={isAdmin}><EmpleadoView /></RoleRoute>} />
        <Route path="empleados/:id/editar"   element={<RoleRoute allow={isAdmin}><EmpleadoForm modo="editar" /></RoleRoute>} />
        <Route path="proyectos"              element={<RoleRoute allow={isAdmin}><ProyectosList /></RoleRoute>} />

        {/* Admin + Coordinador: horas, credenciales, ficha técnica */}
        <Route path="horas"                  element={<RoleRoute allow={canOperar}><ReportesList /></RoleRoute>} />
        <Route path="horas/movil"            element={<RoleRoute allow={isCoordinador}><HorasMovil /></RoleRoute>} />
        <Route path="horas/qr"               element={<RoleRoute allow={isAdmin}><HorasAdminQR /></RoleRoute>} />
        <Route path="horas/:id"              element={<RoleRoute allow={canOperar}><ReporteCaptura /></RoleRoute>} />
        <Route path="credenciales"           element={<RoleRoute allow={canOperar}><CredencialesList /></RoleRoute>} />
        <Route path="ficha"                  element={<RoleRoute allow={isCoordinador || isAdmin}><FichaTecnica /></RoleRoute>} />
        <Route path="mis-proyectos"          element={<RoleRoute allow={isCoordinador || isAdmin}><MisProyectos /></RoleRoute>} />

        {/* Inventario: admin + rol inventario */}
        <Route path="inventario"             element={<RoleRoute allow={isInventario}><PortadaAlmacenes /></RoleRoute>} />
        {/* Actividad y auditoría: el antiguo panel de inicio (KPIs, gráficas,
            solicitudes y movimientos), reubicado fuera de la portada. */}
        <Route path="inventario/actividad"   element={<RoleRoute allow={isInventario}><InventarioDashboard /></RoleRoute>} />
        <Route path="inventario/catalogo"    element={<RoleRoute allow={isInventario}><CatalogoProductos /></RoleRoute>} />
        {/* Material por proyecto: asignar, mover y devolver existencias.
            Distinto de "inventario/proyectos", que es el PLAN (lo que se pensaba
            usar) — esto es el material físico apartado ahora mismo.
            "/general" convive con "/:id" sin conflicto: React Router ordena por
            especificidad y el segmento estático gana al dinámico. */}
        <Route path="inventario/material-proyecto"     element={<RoleRoute allow={isInventario}><MaterialPorProyecto /></RoleRoute>} />
        <Route path="inventario/material-proyecto/general" element={<RoleRoute allow={isInventario}><MaterialGeneral /></RoleRoute>} />
        <Route path="inventario/material-proyecto/:id" element={<RoleRoute allow={isInventario}><MaterialProyectoDetalle /></RoleRoute>} />
        <Route path="inventario/proyectos"   element={<RoleRoute allow={canPlanMateriales}><ProyectosInventario /></RoleRoute>} />
        <Route path="inventario/proyectos/:id" element={<RoleRoute allow={canPlanMateriales}><ProyectoInventarioDetalle /></RoleRoute>} />
        <Route path="inventario/productos/:id/kardex" element={<RoleRoute allow={isInventario}><ProductoKardex /></RoleRoute>} />
        <Route path="inventario/bajo-minimo" element={<RoleRoute allow={isInventario}><BajoMinimo /></RoleRoute>} />
        <Route path="inventario/reportes"    element={<RoleRoute allow={isInventario}><Reportes /></RoleRoute>} />
        <Route path="inventario/etiquetas"   element={<RoleRoute allow={isInventario}><Etiquetas /></RoleRoute>} />
        <Route path="inventario/importar"    element={<RoleRoute allow={isInventario}><ImportarMateriales /></RoleRoute>} />
        <Route path="inventario/almacenes"   element={<RoleRoute allow={isInventario}><AlmacenesEstantes /></RoleRoute>} />
        <Route path="inventario/qr/:id"      element={<RoleRoute allow={isInventario}><QREstante /></RoleRoute>} />
        <Route path="inventario/movimientos" element={<RoleRoute allow={isInventario}><MovimientosInventario /></RoleRoute>} />
        <Route path="inventario/movimientos/nuevo" element={<RoleRoute allow={isInventario}><RegistrarMovimiento /></RoleRoute>} />
        <Route path="inventario/solicitudes" element={<RoleRoute allow={canSolicit}><SolicitudesMaterial /></RoleRoute>} />
        <Route path="inventario/entrega-directa" element={<RoleRoute allow={isInventario}><EntregaDirecta /></RoleRoute>} />
        <Route path="inventario/solicitudes-compra" element={<RoleRoute allow={inventarioSolo}><SolicitudesCompra /></RoleRoute>} />
        <Route path="inventario/scanner"     element={<RoleRoute allow={isInventario}><ScannerMovil /></RoleRoute>} />
        <Route path="inventario/tomas"       element={<RoleRoute allow={isInventario}><Tomas /></RoleRoute>} />
        <Route path="inventario/tomas/:id"   element={<RoleRoute allow={isInventario}><TomaDetalle /></RoleRoute>} />
        <Route path="inventario/manual"      element={<RoleRoute allow={isInventario}><ManualInventario /></RoleRoute>} />

        {/* Pedir material: todos los roles pueden solicitarlo */}
        <Route path="inventario/mis-pedidos" element={<RoleRoute allow={canSolicit}><MisPedidos /></RoleRoute>} />

        {/* Herramientas — inventario + admin */}
        <Route path="inventario/herramientas"                element={<RoleRoute allow={isInventario}><HerramientasCatalogo /></RoleRoute>} />
        <Route path="inventario/herramientas/unidades"       element={<RoleRoute allow={isInventario}><HerramientasUnidades /></RoleRoute>} />
        <Route path="inventario/herramientas/unidades/:id"   element={<RoleRoute allow={canSolicit}><HerramientaUnidadFicha /></RoleRoute>} />
        <Route path="inventario/herramientas/asignaciones"   element={<RoleRoute allow={isInventario}><AsignacionesHerramienta /></RoleRoute>} />
        <Route path="inventario/herramientas/mantenimientos" element={<RoleRoute allow={isInventario}><MantenimientosHerramienta /></RoleRoute>} />
        <Route path="inventario/herramientas/incidencias"    element={<RoleRoute allow={isInventario}><IncidenciasYBajas /></RoleRoute>} />

        {/* Vistas para el solicitante */}
        <Route path="inventario/mis-herramientas"  element={<RoleRoute allow={canSolicit}><MisHerramientas /></RoleRoute>} />
        <Route path="inventario/mis-incidencias"   element={<RoleRoute allow={canSolicit}><MisIncidencias /></RoleRoute>} />
      </Route>
    </Routes>
    </Suspense>
  )
}
