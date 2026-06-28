import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext(null)

function resolveInitial() {
  if (typeof window === 'undefined') return 'dark'
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitial)

  useEffect(() => {
    const root = document.documentElement

    // Al cambiar de tema, el navegador intenta animar la transición de color de
    // TODOS los elementos con `transition-*` a la vez. En pantallas con tablas
    // grandes (p. ej. Bajo mínimo, que carga todos los productos) eso satura el
    // hilo principal → el cambio se siente lento y el sidebar se traba. Técnica
    // estándar: desactivar transiciones/animaciones mientras se aplica la clase
    // y restaurarlas en el siguiente frame (el cambio de color es instantáneo).
    const killTransitions = document.createElement('style')
    killTransitions.appendChild(
      document.createTextNode('*,*::before,*::after{transition:none!important;animation:none!important}')
    )
    document.head.appendChild(killTransitions)

    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.style.colorScheme = theme
    try { localStorage.setItem('theme', theme) } catch {}

    // Forzar reflow para que el navegador aplique el color SIN transición…
    window.getComputedStyle(root).getPropertyValue('opacity')
    // …y reactivar transiciones en el siguiente frame.
    const raf = window.requestAnimationFrame(() => {
      if (killTransitions.parentNode) killTransitions.parentNode.removeChild(killTransitions)
    })

    return () => {
      window.cancelAnimationFrame(raf)
      if (killTransitions.parentNode) killTransitions.parentNode.removeChild(killTransitions)
    }
  }, [theme])

  const setTheme = useCallback((value) => {
    setThemeState(value === 'dark' ? 'dark' : 'light')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext) || { theme: 'light', setTheme: () => {}, toggleTheme: () => {} }
}
