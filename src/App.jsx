import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Verify2FA from './pages/Verify2FA'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Directorio from './pages/Directorio'
import Usuarios from './pages/Usuarios'
import EmpleadosList from './pages/empleados/EmpleadosList'
import EmpleadoForm from './pages/empleados/EmpleadoForm'
import EmpleadoView from './pages/empleados/EmpleadoView'
import EmpleadosImport from './pages/empleados/EmpleadosImport'
import ProyectosList from './pages/proyectos/ProyectosList'
import ReportesList from './pages/horas/ReportesList'
import ReporteCaptura from './pages/horas/ReporteCaptura'
import PrenominaList from './pages/prenomina/PrenominaList'
import PrenominaGenerar from './pages/prenomina/PrenominaGenerar'
import PrenominaEditar from './pages/prenomina/PrenominaEditar'
import PrestamosList from './pages/prestamos/PrestamosList'
import AjustesList from './pages/ajustes/AjustesList'
import AjustePeriodoDetalle from './pages/ajustes/AjustePeriodoDetalle'
import CredencialesList from './pages/credenciales/CredencialesList'
import ProyectoTotal from './pages/proyecto-total/ProyectoTotal'
import HistoricoList from './pages/historico/HistoricoList'
import HistoricoDetalle from './pages/historico/HistoricoDetalle'
import Bitacora from './pages/Bitacora'
import Metricas from './pages/Metricas'
import InventarioDashboard from './pages/inventario/InventarioDashboard'
import CatalogoProductos from './pages/inventario/CatalogoProductos'
import AlmacenesEstantes from './pages/inventario/AlmacenesEstantes'
import MovimientosInventario from './pages/inventario/MovimientosInventario'
import RegistrarMovimiento from './pages/inventario/RegistrarMovimiento'
import SolicitudesMaterial from './pages/inventario/SolicitudesMaterial'
import MisPedidos from './pages/inventario/MisPedidos'
import ScannerMovil from './pages/inventario/ScannerMovil'
import ImportarMateriales from './pages/inventario/ImportarMateriales'
import QREstante from './pages/inventario/QREstante'
import FichaTecnica from './pages/ficha/FichaTecnica'
import HorasMovil from './pages/horas/HorasMovil'
import HorasAdminQR from './pages/horas/HorasAdminQR'
import ManualAdmin from './pages/manual/ManualAdmin'

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
  if (user?.role === 'inventario') return <InventarioDashboard />
  if (user?.role === 'solicitante_material') return <Navigate to="/inventario/mis-pedidos" replace />
  if (user?.role === 'coordinador') return <Navigate to="/horas" replace />
  return <Dashboard />
}

export default function App() {
  const { user, isAdmin, isCoordinador } = useAuth()

  const role = user?.role
  const isInventario = role === 'inventario' || isAdmin
  const canSolicit   = role === 'solicitante_material' || role === 'inventario' || isAdmin
  const canOperar    = isAdmin || isCoordinador

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<RoleBasedHome />} />
        <Route path="perfil"      element={<Profile />} />
        <Route path="perfil/:id"  element={<Profile />} />
        <Route path="directorio"  element={<Directorio />} />

        {/* Solo admin */}
        <Route path="usuarios"                element={<RoleRoute allow={isAdmin}><Usuarios /></RoleRoute>} />
        <Route path="bitacora"                element={<RoleRoute allow={isAdmin}><Bitacora /></RoleRoute>} />
        <Route path="manual"                  element={<RoleRoute allow={isAdmin}><ManualAdmin /></RoleRoute>} />
        <Route path="metricas"                element={<RoleRoute allow={isAdmin}><Metricas /></RoleRoute>} />
        <Route path="prenomina"               element={<RoleRoute allow={isAdmin}><PrenominaList /></RoleRoute>} />
        <Route path="prenomina/:fecha"        element={<RoleRoute allow={isAdmin}><PrenominaGenerar /></RoleRoute>} />
        <Route path="prenomina/:fecha/editar" element={<RoleRoute allow={isAdmin}><PrenominaEditar /></RoleRoute>} />
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
        <Route path="horas/movil"            element={<RoleRoute allow={canOperar}><HorasMovil /></RoleRoute>} />
        <Route path="horas/qr"               element={<RoleRoute allow={isAdmin}><HorasAdminQR /></RoleRoute>} />
        <Route path="horas/:id"              element={<RoleRoute allow={canOperar}><ReporteCaptura /></RoleRoute>} />
        <Route path="credenciales"           element={<RoleRoute allow={canOperar}><CredencialesList /></RoleRoute>} />
        <Route path="ficha"                  element={<RoleRoute allow={isCoordinador || isAdmin}><FichaTecnica /></RoleRoute>} />

        {/* Inventario: admin + rol inventario */}
        <Route path="inventario"             element={<RoleRoute allow={isInventario}><InventarioDashboard /></RoleRoute>} />
        <Route path="inventario/catalogo"    element={<RoleRoute allow={isInventario}><CatalogoProductos /></RoleRoute>} />
        <Route path="inventario/importar"    element={<RoleRoute allow={isInventario}><ImportarMateriales /></RoleRoute>} />
        <Route path="inventario/almacenes"   element={<RoleRoute allow={isInventario}><AlmacenesEstantes /></RoleRoute>} />
        <Route path="inventario/qr/:id"      element={<RoleRoute allow={isInventario}><QREstante /></RoleRoute>} />
        <Route path="inventario/movimientos" element={<RoleRoute allow={isInventario}><MovimientosInventario /></RoleRoute>} />
        <Route path="inventario/movimientos/nuevo" element={<RoleRoute allow={isInventario}><RegistrarMovimiento /></RoleRoute>} />
        <Route path="inventario/solicitudes" element={<RoleRoute allow={isInventario}><SolicitudesMaterial /></RoleRoute>} />
        <Route path="inventario/scanner"     element={<RoleRoute allow={isInventario}><ScannerMovil /></RoleRoute>} />

        {/* Pedir material: todos los roles pueden solicitarlo */}
        <Route path="inventario/mis-pedidos" element={<RoleRoute allow={canSolicit}><MisPedidos /></RoleRoute>} />
      </Route>
    </Routes>
  )
}
