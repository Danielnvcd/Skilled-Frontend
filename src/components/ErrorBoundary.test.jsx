import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import ErrorBoundary, { RouteErrorBoundary, FullPageFallback } from './ErrorBoundary'

// React escribe el error en consola además de propagarlo a la frontera. Lo
// silenciamos para que la salida de los tests no parezca un fallo real.
let consoleError
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleError.mockRestore()
})

function Explota({ cuando = true }) {
  if (cuando) throw new Error('boom: producto.stock es undefined')
  return <p>contenido sano</p>
}

describe('ErrorBoundary', () => {
  it('deja pasar a los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>contenido sano</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido sano')).toBeInTheDocument()
  })

  it('atrapa el error de render y muestra el fallback en vez de la pantalla en blanco', () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo falló en esta pantalla')).toBeInTheDocument()
    // Lo que de verdad importa: el árbol NO quedó vacío.
    expect(document.body.textContent.trim()).not.toBe('')
  })

  it('registra el error en consola para que sea reportable', () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    )
    const marcados = consoleError.mock.calls.filter((c) => c[0] === '[ErrorBoundary]')
    expect(marcados).toHaveLength(1)
    expect(marcados[0][1]).toBeInstanceOf(Error)
  })

  it('el botón Reintentar vuelve a montar los hijos', async () => {
    const user = userEvent.setup()
    // Bandera externa, no un contador interno: React 18 en desarrollo vuelve a
    // invocar el componente que lanzó para poder construir el stack, así que un
    // "falla solo la primera vez" se consumiría en esa segunda invocación y el
    // test dejaría de probar lo que dice.
    let debeFallar = true
    function Inestable() {
      if (debeFallar) throw new Error('boom')
      return <p>contenido sano</p>
    }
    render(
      <ErrorBoundary>
        <Inestable />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo falló en esta pantalla')).toBeInTheDocument()

    debeFallar = false // la causa se corrigió (p. ej. el refetch ya trae datos buenos)
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(screen.getByText('contenido sano')).toBeInTheDocument()
  })

  it('se rearma al cambiar resetKey', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Explota />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo falló en esta pantalla')).toBeInTheDocument()
    rerender(
      <ErrorBoundary resetKey="/b">
        <Explota cuando={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido sano')).toBeInTheDocument()
  })

  it('acepta un fallback propio', () => {
    render(
      <ErrorBoundary fallback={FullPageFallback}>
        <Explota />
      </ErrorBoundary>,
    )
    expect(screen.getByText('La aplicación no pudo continuar')).toBeInTheDocument()
  })
})

describe('RouteErrorBoundary', () => {
  it('permite navegar fuera de la pantalla caída sin recargar', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/rota']}>
        {/* El enlace vive FUERA de la frontera, igual que el Sidebar real. */}
        <Link to="/sana">ir a sana</Link>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/rota" element={<Explota />} />
            <Route path="/sana" element={<p>contenido sano</p>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText('Algo falló en esta pantalla')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'ir a sana' }))
    // Sin el rearme por `resetKey`, aquí seguiríamos viendo el fallback.
    expect(screen.getByText('contenido sano')).toBeInTheDocument()
    expect(screen.queryByText('Algo falló en esta pantalla')).not.toBeInTheDocument()
  })
})
