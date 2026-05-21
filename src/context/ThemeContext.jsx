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
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.style.colorScheme = theme
    try { localStorage.setItem('theme', theme) } catch {}
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
