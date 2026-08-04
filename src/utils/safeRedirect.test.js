import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './safeRedirect'

// jsdom sirve la app desde http://localhost:3000 por defecto; el `origin` real
// es lo que usa la verificación final del helper.
describe('safeRedirectPath', () => {
  it('acepta rutas internas normales', () => {
    expect(safeRedirectPath('/inventario/catalogo')).toBe('/inventario/catalogo')
    expect(safeRedirectPath('/horas/12?tab=captura')).toBe('/horas/12?tab=captura')
    expect(safeRedirectPath('/perfil#datos')).toBe('/perfil#datos')
  })

  it('rechaza URLs absolutas a otro origen', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('http://evil.com/login')).toBe('/')
  })

  it('rechaza el protocol-relative `//evil.com`', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/')
  })

  it('rechaza la barra invertida — el bypass de CVE-2025-68470', () => {
    // El parser WHATWG convierte `\` en `/`, así que `/\evil.com` se resuelve
    // como `//evil.com` → https://evil.com/. Es el caso que documenta el módulo.
    expect(safeRedirectPath('/\\evil.com')).toBe('/')
    expect(safeRedirectPath('/algo/\\evil.com')).toBe('/')
  })

  it('rechaza caracteres de control que el navegador elimina al parsear', () => {
    expect(safeRedirectPath('/\t/evil.com')).toBe('/')
    expect(safeRedirectPath('/\n/evil.com')).toBe('/')
    expect(safeRedirectPath('/\r/evil.com')).toBe('/')
  })

  it('rechaza userinfo con `@`', () => {
    expect(safeRedirectPath('/@evil.com')).toBe('/')
  })

  it('rechaza javascript: y data:', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
    expect(safeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/')
  })

  it('rechaza entradas no string o vacías', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('')).toBe('/')
    expect(safeRedirectPath('   ')).toBe('/')
    expect(safeRedirectPath({ toString: () => '/ok' })).toBe('/')
  })

  it('respeta el fallback indicado', () => {
    expect(safeRedirectPath('https://evil.com', '/inventario')).toBe('/inventario')
  })
})
