import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as cache from './resourceCache'

beforeEach(() => {
  cache.clearAll()
})

describe('serializeKey', () => {
  it('deja los strings tal cual', () => {
    expect(cache.serializeKey('empleados')).toBe('empleados')
  })

  it('serializa [namespace, params] de forma estable', () => {
    expect(cache.serializeKey(['productos', { page: 1 }])).toBe('productos:{"page":1}')
  })

  it('los mismos params en el mismo orden dan la misma clave', () => {
    const a = cache.serializeKey(['productos', { q: 'cable', page: 2 }])
    const b = cache.serializeKey(['productos', { q: 'cable', page: 2 }])
    expect(a).toBe(b)
  })
})

describe('namespaceOf', () => {
  it('toma la primera parte de la clave', () => {
    expect(cache.namespaceOf('empleados:activos')).toBe('empleados')
    expect(cache.namespaceOf(['productos', { page: 1 }])).toBe('productos')
    expect(cache.namespaceOf(42)).toBeNull()
  })
})

describe('get / set', () => {
  it('guarda datos con marca de tiempo y limpia el error previo', () => {
    cache.setError('k', new Error('falló'))
    cache.set('k', { total: 3 })
    const e = cache.get('k')
    expect(e.data).toEqual({ total: 3 })
    expect(e.error).toBeNull()
    expect(e.ts).toBeGreaterThan(0)
  })

  it('devuelve null para una clave desconocida', () => {
    expect(cache.get('no-existe')).toBeNull()
  })

  it('setError conserva los datos ya cacheados', () => {
    // Importa para el comportamiento "stale-while-revalidate": si el refetch
    // falla, la pantalla debe seguir mostrando lo último bueno.
    cache.set('k', { total: 3 })
    cache.setError('k', new Error('500'))
    expect(cache.get('k').data).toEqual({ total: 3 })
    expect(cache.get('k').error).toBeInstanceOf(Error)
  })
})

describe('invalidate', () => {
  it('marca como obsoletas todas las claves del namespace sin borrar los datos', () => {
    cache.set('productos', [1])
    cache.set('productos:{"page":1}', [2])
    cache.set('productos:{"page":2}', [3])
    cache.set('empleados', [4])

    cache.invalidate('productos')

    expect(cache.get('productos').ts).toBe(0)
    expect(cache.get('productos:{"page":1}').ts).toBe(0)
    expect(cache.get('productos:{"page":2}').ts).toBe(0)
    // Los datos siguen ahí para pintar mientras llega lo nuevo.
    expect(cache.get('productos:{"page":1}').data).toEqual([2])
    // Otro namespace no se toca.
    expect(cache.get('empleados').ts).toBeGreaterThan(0)
  })

  it('no confunde namespaces con prefijo común', () => {
    // 'productos' NO debe invalidar 'productos-historicos'.
    cache.set('productos:{"page":1}', [1])
    cache.set('productos-historicos:{"page":1}', [2])
    cache.invalidate('productos')
    expect(cache.get('productos-historicos:{"page":1}').ts).toBeGreaterThan(0)
  })

  it('avisa a los suscriptores con el tipo `invalidate`', () => {
    const cb = vi.fn()
    cache.set('productos:a', [1])
    cache.subscribe('productos:a', cb)
    cache.invalidate('productos')
    expect(cb).toHaveBeenCalledWith('invalidate')
  })

  it('ignora un prefijo vacío', () => {
    cache.set('productos', [1])
    cache.invalidate('')
    expect(cache.get('productos').ts).toBeGreaterThan(0)
  })
})

describe('subscribe', () => {
  it('notifica update y error, y deja de notificar al desuscribirse', () => {
    const cb = vi.fn()
    const off = cache.subscribe('k', cb)

    cache.set('k', 1)
    expect(cb).toHaveBeenLastCalledWith('update')

    cache.setError('k', new Error('x'))
    expect(cb).toHaveBeenLastCalledWith('error')

    off()
    cache.set('k', 2)
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('clearAll', () => {
  it('borra todo y avisa para que las vistas montadas vuelvan a pedir', () => {
    // Es la garantía de privacidad al cambiar de cuenta: sin esto, la cuenta
    // nueva ve las listas de la anterior hasta que responda el refetch.
    const cb = vi.fn()
    cache.set('empleados', [{ nombre: 'privado' }])
    cache.subscribe('empleados', cb)

    cache.clearAll()

    expect(cache.get('empleados')).toBeNull()
    expect(cb).toHaveBeenCalledWith('invalidate')
  })
})
