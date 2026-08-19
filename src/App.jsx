import { lazy, Suspense, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { construirAcceso } from './config/permisos'
import Layout from './components/Layout'
import { RouteErrorBoundary, FullPageFallback } from './components/ErrorBoundary'
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
  const auth = useAuth()
  const { user } = auth

  // Quién puede abrir qué vive en `config/permisos.js`, no aquí. Es la misma
  // tabla que verifica el test contra `config/menus.js`, así que un enlace del
  // menú que apunte a una ruta prohibida para ese rol falla en CI en vez de
  // descubrirse cuando un usuario lo pulsa y rebota al inicio sin explicación.
  const acceso = useMemo(() => construirAcceso(auth), [auth])

  return (
    // Red de seguridad de último nivel: cubre lo que queda FUERA del Layout
    // (Login, Verify2FA) y al Layout mismo. Cuando salta esto ya no hay menú al
    // que volver, así que su fallback ocupa la página entera y ofrece recargar.
    <RouteErrorBoundary fallback={FullPageFallback}>
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
        <Route path="finanzas"    element={<RoleRoute allow={acceso['/finanzas']}><FinanzasPanel /></RoleRoute>} />

        {/* Panel de sistemas (TI/soporte). Eje de permisos independiente del de
            admin/RRHH: administra el sistema, no los datos de nómina. El
            backend además exige 2FA en cada endpoint; si falta, la vista lo
            explica y manda a activarlo en lugar de fallar en seco. */}
        <Route path="sistemas"             element={<RoleRoute allow={acceso['/sistemas']}><SistemasEstado /></RoleRoute>} />
        <Route path="sistemas/peticiones"  element={<RoleRoute allow={acceso['/sistemas/peticiones']}><SistemasPeticiones /></RoleRoute>} />
        <Route path="sistemas/sesiones"    element={<RoleRoute allow={acceso['/sistemas/sesiones']}><SistemasSesiones /></RoleRoute>} />
        <Route path="sistemas/seguridad"   element={<RoleRoute allow={acceso['/sistemas/seguridad']}><SistemasSeguridad /></RoleRoute>} />
        <Route path="sistemas/cuentas"     element={<RoleRoute allow={acceso['/sistemas/cuentas']}><SistemasCuentas /></RoleRoute>} />
        <Route path="sistemas/mantenimiento" element={<RoleRoute allow={acceso['/sistemas/mantenimiento']}><SistemasMantenimiento /></RoleRoute>} />

        {/* La gestión de cuentas se movió de admin al rol sistemas. */}
        <Route path="usuarios"                element={<RoleRoute allow={acceso['/usuarios']}><Usuarios /></RoleRoute>} />
        {/* La bitácora completa es del eje de RRHH. El rol `sistemas` usa
            /sistemas/seguridad, que es la misma bitácora filtrada a eventos de
            seguridad. Dejarla abierta aquí solo servía para pintar una pantalla
            que después el backend rechazaba con 403. */}
        <Route path="bitacora"                element={<RoleRoute allow={acceso['/bitacora']}><Bitacora /></RoleRoute>} />
        <Route path="manual"                  element={<RoleRoute allow={acceso['/manual']}><ManualAdmin /></RoleRoute>} />
        <Route path="manual-coordinador"      element={<RoleRoute allow={acceso['/manual-coordinador']}><ManualCoordinador /></RoleRoute>} />
        <Route path="metricas"                element={<RoleRoute allow={acceso['/metricas']}><Metricas /></RoleRoute>} />
        <Route path="prenomina"               element={<RoleRoute allow={acceso['/prenomina']}><PrenominaList /></RoleRoute>} />
        <Route path="prenomina/:fecha"        element={<RoleRoute allow={acceso['/prenomina/:fecha']}><PrenominaGenerar /></RoleRoute>} />
        <Route path="prenomina/:fecha/editar" element={<RoleRoute allow={acceso['/prenomina/:fecha/editar']}><PrenominaEditar /></RoleRoute>} />
        <Route path="prenomina/:fecha/pago"   element={<RoleRoute allow={acceso['/prenomina/:fecha/pago']}><PrenominaResumenPago /></RoleRoute>} />
        <Route path="prestamos"               element={<RoleRoute allow={acceso['/prestamos']}><PrestamosList /></RoleRoute>} />
        <Route path="ajustes"                 element={<RoleRoute allow={acceso['/ajustes']}><AjustesList /></RoleRoute>} />
        <Route path="ajustes/:id"             element={<RoleRoute allow={acceso['/ajustes/:id']}><AjustePeriodoDetalle /></RoleRoute>} />
        <Route path="proyecto-total"          element={<RoleRoute allow={acceso['/proyecto-total']}><ProyectoTotal /></RoleRoute>} />
        <Route path="historico"               element={<RoleRoute allow={acceso['/historico']}><HistoricoList /></RoleRoute>} />
        <Route path="historico/:fecha"        element={<RoleRoute allow={acceso['/historico/:fecha']}><HistoricoDetalle /></RoleRoute>} />

        {/* Empleados y Proyectos: solo admin (el coordinador no los ve en Flask) */}
        <Route path="empleados"              element={<RoleRoute allow={acceso['/empleados']}><EmpleadosList /></RoleRoute>} />
        <Route path="empleados/bajas"        element={<RoleRoute allow={acceso['/empleados/bajas']}><EmpleadosList variante="bajas" /></RoleRoute>} />
        <Route path="empleados/nuevo"        element={<RoleRoute allow={acceso['/empleados/nuevo']}><EmpleadoForm modo="nuevo" /></RoleRoute>} />
        <Route path="empleados/importar"     element={<RoleRoute allow={acceso['/empleados/importar']}><EmpleadosImport /></RoleRoute>} />
        <Route path="empleados/:id"          element={<RoleRoute allow={acceso['/empleados/:id']}><EmpleadoView /></RoleRoute>} />
        <Route path="empleados/:id/editar"   element={<RoleRoute allow={acceso['/empleados/:id/editar']}><EmpleadoForm modo="editar" /></RoleRoute>} />
        <Route path="proyectos"              element={<RoleRoute allow={acceso['/proyectos']}><ProyectosList /></RoleRoute>} />

        {/* Admin + Coordinador: horas, credenciales, ficha técnica */}
        <Route path="horas"                  element={<RoleRoute allow={acceso['/horas']}><ReportesList /></RoleRoute>} />
        <Route path="horas/movil"            element={<RoleRoute allow={acceso['/horas/movil']}><HorasMovil /></RoleRoute>} />
        <Route path="horas/qr"               element={<RoleRoute allow={acceso['/horas/qr']}><HorasAdminQR /></RoleRoute>} />
        <Route path="horas/:id"              element={<RoleRoute allow={acceso['/horas/:id']}><ReporteCaptura /></RoleRoute>} />
        <Route path="credenciales"           element={<RoleRoute allow={acceso['/credenciales']}><CredencialesList /></RoleRoute>} />
        <Route path="ficha"                  element={<RoleRoute allow={acceso['/ficha']}><FichaTecnica /></RoleRoute>} />
        <Route path="mis-proyectos"          element={<RoleRoute allow={acceso['/mis-proyectos']}><MisProyectos /></RoleRoute>} />

        {/* Inventario: admin + rol inventario */}
        <Route path="inventario"             element={<RoleRoute allow={acceso['/inventario']}><PortadaAlmacenes /></RoleRoute>} />
        {/* Actividad y auditoría: el antiguo panel de inicio (KPIs, gráficas,
            solicitudes y movimientos), reubicado fuera de la portada. */}
        <Route path="inventario/actividad"   element={<RoleRoute allow={acceso['/inventario/actividad']}><InventarioDashboard /></RoleRoute>} />
        <Route path="inventario/catalogo"    element={<RoleRoute allow={acceso['/inventario/catalogo']}><CatalogoProductos /></RoleRoute>} />
        {/* Material por proyecto: asignar, mover y devolver existencias.
            Distinto de "inventario/proyectos", que es el PLAN (lo que se pensaba
            usar) — esto es el material físico apartado ahora mismo.
            "/general" convive con "/:id" sin conflicto: React Router ordena por
            especificidad y el segmento estático gana al dinámico. */}
        <Route path="inventario/material-proyecto"     element={<RoleRoute allow={acceso['/inventario/material-proyecto']}><MaterialPorProyecto /></RoleRoute>} />
        <Route path="inventario/material-proyecto/general" element={<RoleRoute allow={acceso['/inventario/material-proyecto/general']}><MaterialGeneral /></RoleRoute>} />
        <Route path="inventario/material-proyecto/:id" element={<RoleRoute allow={acceso['/inventario/material-proyecto/:id']}><MaterialProyectoDetalle /></RoleRoute>} />
        <Route path="inventario/proyectos"   element={<RoleRoute allow={acceso['/inventario/proyectos']}><ProyectosInventario /></RoleRoute>} />
        <Route path="inventario/proyectos/:id" element={<RoleRoute allow={acceso['/inventario/proyectos/:id']}><ProyectoInventarioDetalle /></RoleRoute>} />
        <Route path="inventario/productos/:id/kardex" element={<RoleRoute allow={acceso['/inventario/productos/:id/kardex']}><ProductoKardex /></RoleRoute>} />
        <Route path="inventario/bajo-minimo" element={<RoleRoute allow={acceso['/inventario/bajo-minimo']}><BajoMinimo /></RoleRoute>} />
        <Route path="inventario/reportes"    element={<RoleRoute allow={acceso['/inventario/reportes']}><Reportes /></RoleRoute>} />
        <Route path="inventario/etiquetas"   element={<RoleRoute allow={acceso['/inventario/etiquetas']}><Etiquetas /></RoleRoute>} />
        <Route path="inventario/importar"    element={<RoleRoute allow={acceso['/inventario/importar']}><ImportarMateriales /></RoleRoute>} />
        <Route path="inventario/almacenes"   element={<RoleRoute allow={acceso['/inventario/almacenes']}><AlmacenesEstantes /></RoleRoute>} />
        <Route path="inventario/qr/:id"      element={<RoleRoute allow={acceso['/inventario/qr/:id']}><QREstante /></RoleRoute>} />
        <Route path="inventario/movimientos" element={<RoleRoute allow={acceso['/inventario/movimientos']}><MovimientosInventario /></RoleRoute>} />
        <Route path="inventario/movimientos/nuevo" element={<RoleRoute allow={acceso['/inventario/movimientos/nuevo']}><RegistrarMovimiento /></RoleRoute>} />
        <Route path="inventario/solicitudes" element={<RoleRoute allow={acceso['/inventario/solicitudes']}><SolicitudesMaterial /></RoleRoute>} />
        <Route path="inventario/entrega-directa" element={<RoleRoute allow={acceso['/inventario/entrega-directa']}><EntregaDirecta /></RoleRoute>} />
        <Route path="inventario/solicitudes-compra" element={<RoleRoute allow={acceso['/inventario/solicitudes-compra']}><SolicitudesCompra /></RoleRoute>} />
        <Route path="inventario/scanner"     element={<RoleRoute allow={acceso['/inventario/scanner']}><ScannerMovil /></RoleRoute>} />
        <Route path="inventario/tomas"       element={<RoleRoute allow={acceso['/inventario/tomas']}><Tomas /></RoleRoute>} />
        <Route path="inventario/tomas/:id"   element={<RoleRoute allow={acceso['/inventario/tomas/:id']}><TomaDetalle /></RoleRoute>} />
        <Route path="inventario/manual"      element={<RoleRoute allow={acceso['/inventario/manual']}><ManualInventario /></RoleRoute>} />

        {/* Pedir material: todos los roles pueden solicitarlo */}
        <Route path="inventario/mis-pedidos" element={<RoleRoute allow={acceso['/inventario/mis-pedidos']}><MisPedidos /></RoleRoute>} />

        {/* Herramientas — inventario + admin */}
        <Route path="inventario/herramientas"                element={<RoleRoute allow={acceso['/inventario/herramientas']}><HerramientasCatalogo /></RoleRoute>} />
        <Route path="inventario/herramientas/unidades"       element={<RoleRoute allow={acceso['/inventario/herramientas/unidades']}><HerramientasUnidades /></RoleRoute>} />
        <Route path="inventario/herramientas/unidades/:id"   element={<RoleRoute allow={acceso['/inventario/herramientas/unidades/:id']}><HerramientaUnidadFicha /></RoleRoute>} />
        <Route path="inventario/herramientas/asignaciones"   element={<RoleRoute allow={acceso['/inventario/herramientas/asignaciones']}><AsignacionesHerramienta /></RoleRoute>} />
        <Route path="inventario/herramientas/mantenimientos" element={<RoleRoute allow={acceso['/inventario/herramientas/mantenimientos']}><MantenimientosHerramienta /></RoleRoute>} />
        <Route path="inventario/herramientas/incidencias"    element={<RoleRoute allow={acceso['/inventario/herramientas/incidencias']}><IncidenciasYBajas /></RoleRoute>} />

        {/* Vistas para el solicitante */}
        <Route path="inventario/mis-herramientas"  element={<RoleRoute allow={acceso['/inventario/mis-herramientas']}><MisHerramientas /></RoleRoute>} />
        <Route path="inventario/mis-incidencias"   element={<RoleRoute allow={acceso['/inventario/mis-incidencias']}><MisIncidencias /></RoleRoute>} />
      </Route>
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  )
}
