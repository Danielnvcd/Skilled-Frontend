import {
  Home, User, Users, UserCog, FolderOpen, Clock, DollarSign, HandCoins,
  Settings2, IdCard, PieChart, FileClock, History,
  Package, Boxes, ArrowRightLeft, ClipboardList, Send, ScanLine, PlusSquare,
  BarChart3, HardHat, QrCode, BookOpen,
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
        { path: '/horas/movil', label: 'Escanear QR', icon: ScanLine, mobileOnly: true },
        { path: '/horas/qr', label: 'QR Trabajadores', icon: QrCode },
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
        { path: '/credenciales', label: 'Credenciales', icon: IdCard },
        { path: '/horas', label: 'Reporte de Horas', icon: Clock, end: true },
        { path: '/horas/movil', label: 'Escanear QR', icon: ScanLine, mobileOnly: true },
        { path: '/ficha', label: 'Ficha Técnica', icon: HardHat },
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
      label: 'Inventario',
      items: [
        { path: '/inventario/catalogo', label: 'Catálogo', icon: Package },
        { path: '/inventario/almacenes', label: 'Almacenes', icon: Boxes },
        { path: '/inventario/movimientos', label: 'Historial movimientos', icon: ArrowRightLeft },
        { path: '/inventario/movimientos/nuevo', label: 'Registrar movimiento', icon: PlusSquare },
        { path: '/inventario/solicitudes', label: 'Solicitudes', icon: ClipboardList },
        { path: '/inventario/scanner', label: 'Escáner QR', icon: ScanLine, mobileOnly: true },
      ],
    },
  ],

  // Solicitante de material: SOLO puede crear y ver sus pedidos
  solicitante_material: [
    {
      label: 'Cuenta',
      items: [
        { path: '/', label: 'Inicio', icon: Home, end: true },
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
  ],
}

// super_admin usa el mismo menú que admin
MENUS.super_admin = MENUS.admin

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
