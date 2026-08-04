import { describe, it, expect } from 'vitest'
import {
  parseFecha,
  fmtFecha,
  fmtFechaCorta,
  fmtFechaLarga,
  fmtFechaHora,
  fmtMoneda,
  fmtNumero,
} from './format'

describe('parseFecha', () => {
  it('ancla las fechas SIN hora al huso local, no a UTC', () => {
    // La razón de ser del módulo. `new Date('2026-08-04')` es medianoche UTC,
    // que en México es el 3 de agosto a las 18:00 — un día menos en pantalla.
    const d = parseFecha('2026-08-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7) // agosto
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(0)
  })

  it('respeta los timestamps completos tal cual', () => {
    const d = parseFecha('2026-08-04T18:30:00Z')
    expect(d.toISOString()).toBe('2026-08-04T18:30:00.000Z')
  })

  it('acepta Date y epoch', () => {
    const ahora = new Date()
    expect(parseFecha(ahora)).toBe(ahora)
    expect(parseFecha(0).getTime()).toBe(0)
  })

  it('devuelve null para lo que no es una fecha', () => {
    expect(parseFecha(null)).toBeNull()
    expect(parseFecha(undefined)).toBeNull()
    expect(parseFecha('')).toBeNull()
    expect(parseFecha('no soy una fecha')).toBeNull()
    expect(parseFecha(new Date('x'))).toBeNull()
    expect(parseFecha({})).toBeNull()
  })
})

describe('formatos de fecha', () => {
  it('no corre el día en una fecha sin hora', () => {
    expect(fmtFecha('2026-08-04')).toContain('04')
    expect(fmtFecha('2026-08-04')).toContain('2026')
    expect(fmtFechaCorta('2026-08-04')).toBe('04/08/2026')
    expect(fmtFechaLarga('2026-08-04')).toBe('04 de agosto de 2026')
  })

  it('formatea fecha y hora', () => {
    // 18:30 UTC = 12:30 en Ciudad de México (UTC-6).
    const s = fmtFechaHora('2026-08-04T18:30:00Z')
    expect(s).toContain('04/08/2026')
    expect(s).toContain('12:30')
  })

  it('usa el placeholder cuando no hay valor', () => {
    expect(fmtFecha(null)).toBe('—')
    expect(fmtFechaCorta(undefined)).toBe('—')
    expect(fmtFechaHora('')).toBe('—')
    // Las pantallas que antes devolvían '' pueden pedirlo.
    expect(fmtFecha(null, '')).toBe('')
  })

  it('no revienta con basura', () => {
    expect(fmtFecha('no soy una fecha')).toBe('—')
    expect(() => fmtFechaLarga({})).not.toThrow()
  })
})

describe('fmtMoneda', () => {
  it('siempre lleva dos decimales', () => {
    expect(fmtMoneda(1234.5)).toBe('$1,234.50')
    expect(fmtMoneda(0)).toBe('$0.00')
    expect(fmtMoneda('1234.567')).toBe('$1,234.57')
  })

  it('maneja negativos', () => {
    expect(fmtMoneda(-500)).toContain('500.00')
  })

  it('usa el placeholder en vez de mostrar $NaN', () => {
    expect(fmtMoneda(null)).toBe('—')
    expect(fmtMoneda('')).toBe('—')
    expect(fmtMoneda('abc')).toBe('—')
  })
})

describe('fmtNumero', () => {
  it('no fuerza decimales en cantidades enteras', () => {
    expect(fmtNumero(3)).toBe('3')
    expect(fmtNumero(12.5)).toBe('12.5')
    expect(fmtNumero(1234.567)).toBe('1,234.57')
  })

  it('respeta maxDecimales', () => {
    expect(fmtNumero(1.23456, { maxDecimales: 3 })).toBe('1.235')
    expect(fmtNumero(1.6, { maxDecimales: 0 })).toBe('2')
  })

  it('usa el placeholder en vez de NaN', () => {
    expect(fmtNumero(null)).toBe('—')
    expect(fmtNumero('abc')).toBe('—')
    expect(fmtNumero(0)).toBe('0')
  })
})
