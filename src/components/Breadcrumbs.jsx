import { Link, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { flattenMenu, MENUS } from '../config/menus'

// Migas globales: se renderizan sobre el <main> en el Layout. Solo aparecen
// cuando hay 2+ segmentos en la URL (en `/perfil` o `/` no muestra nada).
//
// Algunas páginas ya manejan su propio breadcrumb dentro de PageHeader (ver
// SKIP_PREFIXES). Para esas omitimos las migas globales para no duplicar.

const SKIP_PREFIXES = [
  '/empleados',     // EmpleadosList / EmpleadoView / EmpleadoForm / EmpleadosImport ya traen breadcrumb propio
  '/horas/',        // ReporteCaptura ya trae breadcrumb propio (pero /horas a solas sí debería verlo)
  '/ajustes/',
  '/prenomina/',
  '/historico/',
  '/inventario/productos/',
]

// Diccionario para traducir segmentos no-mapeables al menú (verbos, acciones).
const SEGMENT_LABELS = {
  nuevo: 'Nuevo',
  editar: 'Editar',
  importar: 'Importar',
  bajas: 'Dados de baja',
  qr: 'QR',
  pago: 'Pago',
  kardex: 'Kardex',
  unidades: 'Unidades',
  asignaciones: 'Asignaciones',
  mantenimientos: 'Mantenimientos',
  incidencias: 'Incidencias',
  movil: 'Móvil',
  productos: 'Productos',
}

function labelize(seg) {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg]
  // Si es solo dígitos → muestra como #123
  if (/^\d+$/.test(seg)) return `#${seg}`
  // Si parece fecha YYYY-MM-DD → preservarla
  if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return seg
  // Capitaliza
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
}

export default function Breadcrumbs() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const crumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length < 2) return []

    // Skip si la página maneja su propio breadcrumb (ver SKIP_PREFIXES).
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return []

    // Construir mapa path → label desde el menú del rol actual para que
    // las migas usen exactamente los nombres que el usuario ya conoce.
    const menuItems = flattenMenu(user?.role, { isMobile: false })
    // Algunas rutas no están en flattenMenu (admin tiene un menú filtrado).
    // Para una cobertura más amplia, también revisamos MENUS.admin.
    const allItems = [...menuItems]
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      const adminItems = (MENUS.admin || []).flatMap((g) => g.items)
      for (const it of adminItems) {
        if (!allItems.find((a) => a.path === it.path)) allItems.push(it)
      }
    }
    const pathLabel = new Map(allItems.map((it) => [it.path, it.label]))

    const out = []
    let acc = ''
    for (let i = 0; i < segments.length; i++) {
      acc += '/' + segments[i]
      const fromMenu = pathLabel.get(acc)
      out.push({
        label: fromMenu || labelize(segments[i]),
        path: acc,
        // El último no es link
        isLast: i === segments.length - 1,
      })
    }
    return out
  }, [pathname, user?.role])

  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Ruta de navegación"
      className="text-xs text-ink-500 dark:text-ink-400 mb-4 flex items-center gap-1 flex-wrap"
    >
      <Link
        to="/"
        className="inline-flex items-center hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
        aria-label="Inicio"
      >
        <Home size={12} />
      </Link>
      {crumbs.map((c) => (
        <span key={c.path} className="inline-flex items-center gap-1">
          <ChevronRight size={12} className="text-ink-300 dark:text-ink-600 flex-shrink-0" />
          {c.isLast ? (
            <span className="text-ink-700 dark:text-ink-200 font-medium truncate max-w-[200px]" title={c.label}>
              {c.label}
            </span>
          ) : (
            <Link
              to={c.path}
              className="hover:text-ink-700 dark:hover:text-ink-200 transition-colors truncate max-w-[200px]"
              title={c.label}
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
