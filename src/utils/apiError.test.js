import { describe, it, expect } from 'vitest'
import { extractApiError } from './apiError'

describe('extractApiError', () => {
  it('devuelve el detail cuando es un string', () => {
    const err = { response: { data: { detail: 'Producto no encontrado' } } }
    expect(extractApiError(err)).toBe('Producto no encontrado')
  })

  it('aplana el objeto de validación de Marshmallow', () => {
    // Este es el caso que justifica el helper: leer `data.detail` en crudo
    // pinta "[object Object]" en el toast y el usuario no se entera de qué
    // campo está mal.
    const err = {
      response: {
        data: {
          detail: {
            codigo: ['Ya existe un producto con ese código.'],
            stock_minimo: ['Debe ser mayor o igual a 0.'],
          },
        },
      },
    }
    expect(extractApiError(err)).toBe(
      'Ya existe un producto con ese código. Debe ser mayor o igual a 0.',
    )
  })

  it('prioriza `fields` sobre `detail`', () => {
    const err = {
      response: { data: { fields: { nombre: 'Requerido' }, detail: 'Error de validación' } },
    }
    expect(extractApiError(err)).toBe('Requerido')
  })

  it('cae a `error` y luego a `message`', () => {
    expect(extractApiError({ response: { data: { error: 'Sin permisos' } } })).toBe('Sin permisos')
    expect(extractApiError({ response: { data: { message: 'Ups' } } })).toBe('Ups')
  })

  it('sin respuesta usa el mensaje del propio error (red caída, timeout)', () => {
    expect(extractApiError({ message: 'Network Error' })).toBe('Network Error')
  })

  it('usa el fallback cuando no hay nada aprovechable', () => {
    expect(extractApiError({}, 'No se pudo guardar')).toBe('No se pudo guardar')
    expect(extractApiError({ response: { data: {} } }, 'No se pudo guardar')).toBe(
      'No se pudo guardar',
    )
  })

  it('no revienta con entradas basura', () => {
    expect(() => extractApiError(null)).not.toThrow()
    expect(() => extractApiError(undefined)).not.toThrow()
    expect(extractApiError(null)).toBe('Ocurrió un error')
  })
})
