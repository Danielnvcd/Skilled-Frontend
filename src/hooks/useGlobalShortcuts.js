import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Atajos de teclado tipo Linear / GitHub: presionar `g` y luego una letra
// navega a la sección correspondiente. El estado intermedio se resetea
// después de 1.5s sin tecla siguiente.
//
// Se ignoran cuando el foco está en un input, textarea, select o elemento
// contenteditable, para no robar tecleo al usuario que está escribiendo.
//
// La tabla de atajos depende del rol: cada rol tiene sus propios destinos
// para que `g e` signifique lo correcto en cada contexto.

const SHORTCUTS = {
  admin: {
    e: '/empleados',
    p: '/prenomina',
    h: '/horas',
    b: '/bitacora',
    d: '/directorio',
    r: '/proyectos',
    i: '/inventario/catalogo',
    u: '/usuarios',
    c: '/credenciales',
    t: '/proyecto-total',
    m: '/metricas',
  },
  coordinador: {
    h: '/horas',
    d: '/directorio',
    p: '/mis-proyectos',
    c: '/credenciales',
    f: '/ficha',
    s: '/inventario/solicitudes',
  },
  inventario: {
    c: '/inventario/catalogo',
    s: '/inventario/solicitudes',
    m: '/inventario/movimientos',
    t: '/inventario/tomas',
    e: '/inventario/etiquetas',
    h: '/inventario/herramientas',
    b: '/inventario/bajo-minimo',
    r: '/inventario/reportes',
  },
  solicitante_material: {
    p: '/inventario/mis-pedidos',
    s: '/inventario/solicitudes',
    h: '/inventario/mis-herramientas',
  },
}
// super_admin usa la misma tabla que admin
SHORTCUTS.super_admin = SHORTCUTS.admin

function isEditableTarget(el) {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export default function useGlobalShortcuts() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Bandera de "estoy esperando la 2da tecla del chord". Se resetea a 1500ms
  // o cuando se completa el chord. Va en ref para no causar re-render.
  const awaitingRef = useRef(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const role = user?.role
    if (!role) return
    const map = SHORTCUTS[role]
    if (!map) return

    const clearAwait = () => {
      awaitingRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const onKey = (e) => {
      // Ignora si hay modificadores (Ctrl, Meta, Alt) — esos son otros atajos.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Ignora si el foco está en un input.
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()

      if (awaitingRef.current) {
        // Segunda tecla del chord. Buscar destino.
        const dest = map[key]
        clearAwait()
        if (dest) {
          e.preventDefault()
          navigate(dest)
        }
        return
      }

      if (key === 'g') {
        // Arranca el chord. No prevenimos default para no interferir si el
        // usuario simplemente está navegando con teclado.
        awaitingRef.current = true
        timerRef.current = setTimeout(clearAwait, 1500)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearAwait()
    }
  }, [navigate, user?.role])
}
