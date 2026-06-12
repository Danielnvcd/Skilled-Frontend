import {
  UserRoundPlus, FileSpreadsheet, Users, DollarSign, QrCode, FolderPlus,
  Send, ClipboardList, Sun, Moon, LogOut, User, BookOpen, ScanLine,
  Package, BarChart3, History, HandCoins, Settings2, IdCard,
} from 'lucide-react'

// Comandos del command palette del topbar.
// A diferencia de los items del menú (que son destinos), un comando es una
// acción nombrada con verbo: "Crear empleado", "Cambiar tema", "Cerrar sesión".
// Cada comando recibe un `ctx = { navigate, toggleTheme, logout, theme }` al
// ejecutarse, así no necesita importar contextos React.
//
// Se filtran por rol con `roles: [...]`. Sin `roles` significa "todos".

const COMMANDS = [
  // ── Admin / Super admin ────────────────────────────────────────────────────
  {
    id: 'empleado-nuevo',
    label: 'Crear empleado',
    hint: 'Alta de RRHH',
    group: 'Empleados',
    icon: UserRoundPlus,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/empleados/nuevo'),
  },
  {
    id: 'empleado-importar',
    label: 'Importar empleados desde Excel',
    hint: 'Carga masiva',
    group: 'Empleados',
    icon: FileSpreadsheet,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/empleados/importar'),
  },
  {
    id: 'empleado-bajas',
    label: 'Ver empleados dados de baja',
    group: 'Empleados',
    icon: Users,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/empleados/bajas'),
  },
  {
    id: 'prenomina-ir',
    label: 'Generar prenómina del periodo actual',
    hint: 'Abre lista de periodos',
    group: 'Prenómina',
    icon: DollarSign,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/prenomina'),
  },
  {
    id: 'horas-qr',
    label: 'Tarjetas',
    group: 'Horas',
    icon: QrCode,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/horas/qr'),
  },
  {
    id: 'horas-asistencia',
    label: 'Tomar asistencia (escanear QR)',
    hint: 'Entrada/salida con credencial',
    group: 'Horas',
    icon: ScanLine,
    roles: ['coordinador'],
    run: ({ navigate }) => navigate('/horas/movil'),
  },
  {
    id: 'prestamos',
    label: 'Otorgar préstamo',
    group: 'Préstamos',
    icon: HandCoins,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/prestamos'),
  },
  {
    id: 'bitacora',
    label: 'Revisar bitácora',
    hint: 'Auditoría',
    group: 'Administración',
    icon: History,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/bitacora'),
  },
  {
    id: 'metricas',
    label: 'Ver métricas',
    group: 'Administración',
    icon: BarChart3,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/metricas'),
  },
  {
    id: 'ajustes',
    label: 'Ajustes Inbursa',
    group: 'Administración',
    icon: Settings2,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/ajustes'),
  },
  {
    id: 'credenciales',
    label: 'Generar credenciales',
    group: 'Credenciales',
    icon: IdCard,
    roles: ['admin', 'super_admin', 'coordinador'],
    run: ({ navigate }) => navigate('/credenciales'),
  },

  {
    id: 'finanzas-panel',
    label: 'Abrir panel financiero',
    hint: 'Dispersión, préstamos, ajustes',
    group: 'Finanzas',
    icon: DollarSign,
    roles: ['admin', 'super_admin', 'finanzas'],
    run: ({ navigate }) => navigate('/finanzas'),
  },

  // ── Inventario / solicitantes ──────────────────────────────────────────────
  {
    id: 'inv-pedir',
    label: 'Pedir material',
    group: 'Inventario',
    icon: Send,
    roles: ['admin', 'super_admin', 'coordinador', 'solicitante_material', 'inventario'],
    run: ({ navigate }) => navigate('/inventario/mis-pedidos'),
  },
  {
    id: 'inv-solicitudes',
    label: 'Ver mis solicitudes de material',
    group: 'Inventario',
    icon: ClipboardList,
    roles: ['admin', 'super_admin', 'coordinador', 'solicitante_material', 'inventario'],
    run: ({ navigate }) => navigate('/inventario/solicitudes'),
  },
  {
    id: 'inv-catalogo',
    label: 'Abrir catálogo de productos',
    group: 'Inventario',
    icon: Package,
    roles: ['admin', 'super_admin', 'inventario'],
    run: ({ navigate }) => navigate('/inventario/catalogo'),
  },
  {
    id: 'inv-scanner',
    label: 'Escanear QR de material',
    group: 'Inventario',
    icon: ScanLine,
    roles: ['admin', 'super_admin', 'inventario'],
    run: ({ navigate }) => navigate('/inventario/scanner'),
  },

  // ── Globales ───────────────────────────────────────────────────────────────
  {
    id: 'tema-toggle',
    label: 'Cambiar modo claro / oscuro',
    hint: 'Tema',
    group: 'Apariencia',
    icon: Sun,
    iconAlt: Moon,
    run: ({ toggleTheme }) => toggleTheme(),
    keepOpen: false,
  },
  {
    id: 'perfil',
    label: 'Ir a mi perfil',
    group: 'Cuenta',
    icon: User,
    run: ({ navigate }) => navigate('/perfil'),
  },
  {
    id: 'manual-admin',
    label: 'Abrir manual de uso',
    group: 'Ayuda',
    icon: BookOpen,
    roles: ['admin', 'super_admin'],
    run: ({ navigate }) => navigate('/manual'),
  },
  {
    id: 'manual-coord',
    label: 'Abrir manual de uso',
    group: 'Ayuda',
    icon: BookOpen,
    roles: ['coordinador'],
    run: ({ navigate }) => navigate('/manual-coordinador'),
  },
  {
    id: 'manual-inv',
    label: 'Abrir manual de uso',
    group: 'Ayuda',
    icon: BookOpen,
    roles: ['inventario'],
    run: ({ navigate }) => navigate('/inventario/manual'),
  },
  {
    id: 'logout',
    label: 'Cerrar sesión',
    group: 'Cuenta',
    icon: LogOut,
    run: ({ logout }) => logout(),
  },
]

export function getCommands(role) {
  return COMMANDS.filter((c) => !c.roles || c.roles.includes(role))
}
