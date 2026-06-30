import {
  Home, User, Users, UserCog, FolderOpen, Clock, DollarSign, HandCoins,
  Settings2, IdCard, PieChart, FileClock, History,
  Package, Boxes, ArrowRightLeft, ClipboardList, Send, ScanLine, PlusSquare,
  BarChart3, HardHat, QrCode, BookOpen, FileSpreadsheet, Tag,
  Wrench, Hammer, AlertTriangle, ClipboardCheck, ShoppingCart, PackageCheck,
} from 'lucide-react'

// ── Menú por rol ─────────────────────────────────────────────────────────────
// Source of truth para el Sidebar y para el buscador del topbar.
// Cada item: { path, label, icon, end?, mobileOnly? }

export const MENUS = {
  // Admin y Super Admin: ven TODO
  admin: [
    {
      label: 'Cuenta',
      items: [
        { path: '/', label: 'Inicio', icon: Home, end: true },
        { path: '/perfil', label: 'Mi perfil', icon: User },
        { path: '/directorio', label: 'Directorio', icon: Users },
      ],
    },
    {
      label: 'Operación',
      items: [
        { path: '/empleados', label: 'Empleados', icon: UserCog },
        { path: '/credenciales', label: 'Credenciales', icon: IdCard },
        { path: '/proyectos', label: 'Proyectos', icon: FolderOpen },
        { path: '/horas', label: 'Horas', icon: Clock, end: true },
        // Asistencia QR (/horas/movil) es exclusiva del coordinador (2026-06-10):
        // la toma de asistencia en obra es su flujo, no del admin.
        { path: '/horas/qr', label: 'Tarjetas', icon: QrCode },
        { path: '/prenomina', label: 'Prenómina', icon: DollarSign },
        { path: '/proyecto-total', label: 'Proyecto Total', icon: PieChart },
        { path: '/historico', label: 'Histórico nóminas', icon: FileClock },
        { path: '/prestamos', label: 'Préstamos', icon: HandCoins },
        { path: '/ajustes', label: 'Ajustes Inbursa', icon: Settings2 },
      ],
    },
    {
      label: 'Administración',
      items: [
        { path: '/usuarios', label: 'Usuarios', icon: Users },
        { path: '/metricas', label: 'Métricas', icon: BarChart3 },
        { path: '/bitacora', label: 'Bitácora', icon: History },
        { path: '/manual', label: 'Manual de uso', icon: BookOpen },
      ],
    },
  ],

  // Coordinador: solo credenciales, horas y ficha técnica (espejo del menú Flask)
  coordinador: [
    {
      label: 'Cuenta',
      items: [
        { path: '/perfil', label: 'Mi perfil', icon: User },
        { path: '/directorio', label: 'Directorio', icon: Users },
      ],
    },
    {
      label: 'Operación',
      items: [
        { path: '/mis-proyectos', label: 'Mis Proyectos', icon: FolderOpen },
        { path: '/credenciales', label: 'Credenciales', icon: IdCard },
        { path: '/horas', label: 'Reporte de Horas', icon: Clock, end: true },
        { path: '/horas/movil', label: 'Asistencia QR', icon: ScanLine },
        { path: '/ficha', label: 'Ficha Técnica', icon: HardHat },
      ],
    },
    {
      // Coordinador puede armar y consultar SUS propios pedidos de material.
      label: 'Inventario',
      items: [
        { path: '/inventario/mis-pedidos', label: 'Pedir material', icon: Send },
        { path: '/inventario/solicitudes', label: 'Mis solicitudes', icon: ClipboardList },
      ],
    },
    {
      // Coordinador ve sus herramientas asignadas y puede solicitar baja / reportar
      // incidencias desde la ficha de cada unidad.
      label: 'Herramientas',
      items: [
        { path: '/inventario/mis-herramientas', label: 'Mis herramientas', icon: Hammer },
        { path: '/inventario/mis-incidencias', label: 'Mis incidencias / bajas', icon: AlertTriangle },
      ],
    },
    {
      label: 'Ayuda',
      items: [
        { path: '/manual-coordinador', label: 'Manual de uso', icon: BookOpen },
      ],
    },
  ],

  // Inventario: SOLO módulo de inventario
  inventario: [
    {
      label: 'Cuenta',
      items: [
        { path: '/', label: 'Inicio', icon: Home, end: true },
        { path: '/perfil', label: 'Mi perfil', icon: User },
      ],
    },
    {
      label: 'Materiales',
      items: [
        { path: '/inventario/catalogo', label: 'Catálogo', icon: Package },
        { path: '/inventario/bajo-minimo', label: 'Bajo mínimo', icon: AlertTriangle },
        { path: '/inventario/almacenes', label: 'Almacenes', icon: Boxes },
        { path: '/inventario/etiquetas', label: 'Etiquetas', icon: Tag },
      ],
    },
    {
      label: 'Movimientos',
      items: [
        { path: '/inventario/movimientos/nuevo', label: 'Registrar movimiento', icon: PlusSquare },
        { path: '/inventario/movimientos', label: 'Historial movimientos', icon: ArrowRightLeft, end: true },
        { path: '/inventario/tomas', label: 'Tomas físicas', icon: ClipboardCheck },
        { path: '/inventario/scanner', label: 'Escáner QR', icon: ScanLine, mobileOnly: true },
      ],
    },
    {
      label: 'Compras y solicitudes',
      items: [
        { path: '/inventario/entrega-directa', label: 'Entrega directa', icon: PackageCheck },
        { path: '/inventario/solicitudes', label: 'Solicitudes de material', icon: ClipboardList },
        { path: '/inventario/solicitudes-compra', label: 'Solicitudes de compra', icon: ShoppingCart },
      ],
    },
    {
      label: 'Proyectos y reportes',
      items: [
        { path: '/inventario/proyectos', label: 'Proyectos', icon: FolderOpen },
        { path: '/inventario/reportes', label: 'Reportes', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Herramientas',
      items: [
        { path: '/inventario/herramientas', label: 'Catálogo', icon: Wrench, end: true },
        { path: '/inventario/herramientas/unidades', label: 'Unidades', icon: Hammer },
        { path: '/inventario/herramientas/asignaciones', label: 'Asignaciones', icon: HardHat },
        { path: '/inventario/herramientas/mantenimientos', label: 'Mantenimientos', icon: Settings2 },
        { path: '/inventario/herramientas/incidencias', label: 'Incidencias y bajas', icon: AlertTriangle },
      ],
    },
    {
      label: 'Ayuda',
      items: [
        { path: '/inventario/manual', label: 'Manual de uso', icon: BookOpen },
      ],
    },
  ],

  // Finanzas: panel financiero de solo lectura (dispersión, préstamos, ajustes)
  finanzas: [
    {
      label: 'Cuenta',
      items: [
        { path: '/', label: 'Inicio', icon: Home, end: true },
        { path: '/perfil', label: 'Mi perfil', icon: User },
        { path: '/directorio', label: 'Directorio', icon: Users },
      ],
    },
    {
      label: 'Finanzas',
      items: [
        { path: '/finanzas', label: 'Panel financiero', icon: DollarSign },
      ],
    },
  ],

  // Solicitante de material: pide material + herramientas, ve sus incidencias
  solicitante_material: [
    {
      label: 'Cuenta',
      items: [
        { path: '/perfil', label: 'Mi perfil', icon: User },
      ],
    },
    {
      label: 'Inventario',
      items: [
        { path: '/inventario/mis-pedidos', label: 'Pedir material', icon: Send },
        { path: '/inventario/solicitudes', label: 'Mis solicitudes', icon: ClipboardList },
      ],
    },
    {
      label: 'Herramientas',
      items: [
        { path: '/inventario/mis-herramientas', label: 'Mis herramientas', icon: Hammer },
        { path: '/inventario/mis-incidencias', label: 'Mis incidencias / bajas', icon: AlertTriangle },
      ],
    },
  ],
}

// super_admin usa el mismo menú que admin
MENUS.super_admin = MENUS.admin

// Bottom nav de móvil: 4-5 atajos por rol. Se muestra solo en pantallas <md.
// Cada item es { path, label, icon, end? }.
export const BOTTOM_NAV = {
  admin: [
    { path: '/', label: 'Inicio', icon: Home, end: true },
    { path: '/horas', label: 'Horas', icon: Clock, end: true },
    { path: '/inventario/scanner', label: 'Escanear', icon: ScanLine },
    { path: '/prenomina', label: 'Prenómina', icon: DollarSign },
    { path: '/perfil', label: 'Cuenta', icon: User },
  ],
  coordinador: [
    { path: '/horas', label: 'Horas', icon: Clock, end: true },
    { path: '/horas/movil', label: 'Escanear', icon: ScanLine },
    { path: '/inventario/mis-pedidos', label: 'Pedidos', icon: Send },
    { path: '/inventario/solicitudes', label: 'Mis sols.', icon: ClipboardList },
    { path: '/perfil', label: 'Cuenta', icon: User },
  ],
  inventario: [
    { path: '/', label: 'Inicio', icon: Home, end: true },
    { path: '/inventario/scanner', label: 'Escanear', icon: ScanLine },
    { path: '/inventario/catalogo', label: 'Catálogo', icon: Package },
    { path: '/inventario/solicitudes', label: 'Solicitudes', icon: ClipboardList },
    { path: '/perfil', label: 'Cuenta', icon: User },
  ],
  solicitante_material: [
    { path: '/inventario/mis-pedidos', label: 'Pedir', icon: Send },
    { path: '/inventario/solicitudes', label: 'Mis sols.', icon: ClipboardList },
    { path: '/inventario/mis-herramientas', label: 'Mis herr.', icon: Hammer },
    { path: '/perfil', label: 'Cuenta', icon: User },
  ],
  finanzas: [
    { path: '/', label: 'Inicio', icon: Home, end: true },
    { path: '/finanzas', label: 'Finanzas', icon: DollarSign },
    { path: '/directorio', label: 'Directorio', icon: Users },
    { path: '/perfil', label: 'Cuenta', icon: User },
  ],
}
BOTTOM_NAV.super_admin = BOTTOM_NAV.admin

// Fallback: menú mínimo para roles no mapeados
export const DEFAULT_MENU = [
  {
    label: 'Cuenta',
    items: [
      { path: '/', label: 'Inicio', icon: Home, end: true },
      { path: '/perfil', label: 'Mi perfil', icon: User },
    ],
  },
]

// Aplana grupos → items (con su grupo padre como contexto). Útil para el
// buscador del topbar. Filtra los marcados como mobileOnly cuando se está
// en escritorio.
export function flattenMenu(role, { isMobile = false } = {}) {
  const groups = MENUS[role] ?? DEFAULT_MENU
  const out = []
  for (const g of groups) {
    for (const it of g.items) {
      if (it.mobileOnly && !isMobile) continue
      out.push({ ...it, group: g.label })
    }
  }
  return out
}
