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

export default function App() {
  const { user, isAdmin } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/verify-2fa" element={<Verify2FA />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="perfil/:id" element={<Profile />} />
        <Route path="directorio" element={<Directorio />} />
        <Route
          path="usuarios"
          element={<RoleRoute allow={isAdmin}><Usuarios /></RoleRoute>}
        />
        <Route
          path="bitacora"
          element={<RoleRoute allow={isAdmin}><Bitacora /></RoleRoute>}
        />
        <Route path="proyectos" element={<ProyectosList />} />
        <Route path="horas" element={<ReportesList />} />
        <Route path="horas/:id" element={<ReporteCaptura />} />
        <Route
          path="prenomina"
          element={<RoleRoute allow={isAdmin}><PrenominaList /></RoleRoute>}
        />
        <Route
          path="prenomina/:fecha"
          element={<RoleRoute allow={isAdmin}><PrenominaGenerar /></RoleRoute>}
        />
        <Route
          path="prenomina/:fecha/editar"
          element={<RoleRoute allow={isAdmin}><PrenominaEditar /></RoleRoute>}
        />
        <Route
          path="prestamos"
          element={<RoleRoute allow={isAdmin}><PrestamosList /></RoleRoute>}
        />
        <Route
          path="ajustes"
          element={<RoleRoute allow={isAdmin}><AjustesList /></RoleRoute>}
        />
        <Route
          path="ajustes/:id"
          element={<RoleRoute allow={isAdmin}><AjustePeriodoDetalle /></RoleRoute>}
        />
        <Route path="credenciales" element={<CredencialesList />} />
        <Route
          path="proyecto-total"
          element={<RoleRoute allow={isAdmin}><ProyectoTotal /></RoleRoute>}
        />
        <Route
          path="historico"
          element={<RoleRoute allow={isAdmin}><HistoricoList /></RoleRoute>}
        />
        <Route
          path="historico/:fecha"
          element={<RoleRoute allow={isAdmin}><HistoricoDetalle /></RoleRoute>}
        />
        <Route path="empleados" element={<EmpleadosList />} />
        <Route path="empleados/bajas" element={<EmpleadosList variante="bajas" />} />
        <Route path="empleados/nuevo" element={<EmpleadoForm modo="nuevo" />} />
        <Route path="empleados/importar" element={<EmpleadosImport />} />
        <Route path="empleados/:id" element={<EmpleadoView />} />
        <Route path="empleados/:id/editar" element={<EmpleadoForm modo="editar" />} />
      </Route>
    </Routes>
  )
}
