import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Warehouse } from 'lucide-react'
import { Button, Input, Skeleton, Select } from '../../../components/ui'
import { getProductoStocks, ajustarBuckets } from '../../../api/inventario'
import { extractApiError } from '../../../utils/apiError'
import { unidadPermiteDecimales } from '../../../utils/unidades'

// Piezas compartidas de la pantalla de Catálogo, extraídas de
// `CatalogoProductos.jsx` para que ese archivo no siga creciendo por encima de
// las 2 000 líneas. Mismo criterio y misma estructura que `materialProyecto/`.
// El contenido es el mismo de antes: solo cambió de archivo.

// Casilla de selección: una sola definición para galería, tabla y móvil, así
// las tres vistas no se van separando visualmente con el tiempo.
export const CHECKBOX_CLS = 'h-4 w-4 rounded border-ink-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500 cursor-pointer'

// Dónde te quedaste la última vez: cuadrícula de categorías, dentro de una
// categoría, o "ver todos". Se guarda aparte de `catalogo_vista` (galería vs
// tabla) porque son dos cosas distintas: una es QUÉ estás mirando y la otra
// CÓMO. Sin esto el catálogo siempre abría en la cuadrícula y había que volver
// a navegar a la misma categoría cada vez.
//
// A propósito NO se guardan la búsqueda ni los filtros avanzados: restaurar un
// filtro que no está a la vista deja el catálogo recortado sin explicación.
const UBICACION_KEY = 'catalogo_ubicacion'

export function ubicacionInicial() {
  try {
    const u = JSON.parse(localStorage.getItem(UBICACION_KEY) || 'null')
    return {
      verTodos: !!u?.verTodos,
      categoria: typeof u?.categoria === 'string' ? u.categoria : '',
    }
  } catch {
    return { verTodos: false, categoria: '' }
  }
}

// ── Campo (label + valor) de la ficha de detalle del producto ────────────────
// Se usa en el modal que se abre al hacer click en la imagen de un producto.
/**
 * Agrupa los buckets de stock POR PROYECTO, con las bodegas como detalle.
 *
 * El API devuelve una fila por combinación (bodega, proyecto), que es el grano
 * natural del almacenamiento pero no el de la pregunta que hace el usuario:
 * «¿cuánto material tengo del proyecto Norte?». Sin agrupar, contestarla obliga
 * a localizar sus filas entre todas y sumarlas de cabeza.
 *
 * General (proyecto_id null) va primero por convención: es el stock libre y el
 * punto de referencia contra el que se leen los demás.
 */
export function agruparPorProyecto(buckets) {
  const grupos = new Map()
  for (const b of buckets || []) {
    const cantidad = Number(b.cantidad) || 0
    if (cantidad <= 0) continue
    const clave = b.proyecto_id ?? 'general'
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        proyecto_id: b.proyecto_id ?? null,
        proyecto_nombre: b.proyecto_nombre,
        proyecto_descripcion: b.proyecto_descripcion,
        total: 0,
        almacenes: [],
      })
    }
    const g = grupos.get(clave)
    g.total += cantidad
    g.almacenes.push({ nombre: b.almacen_nombre, cantidad })
  }

  for (const g of grupos.values()) {
    // Redondeo a 2 decimales: sumar flotantes produce colas como 169.99999997.
    g.total = Math.round(g.total * 100) / 100
    g.almacenes.sort((a, b) => b.cantidad - a.cantidad)
  }

  return [...grupos.values()].sort((a, b) => {
    if (a.proyecto_id === null) return -1
    if (b.proyecto_id === null) return 1
    return b.total - a.total
  })
}

export function DetalleCampo({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">{label}</dt>
      <dd className={`text-ink-800 dark:text-ink-100 break-words ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

// ── Editor de stock por bodega+proyecto (feature stock por proyecto) ─────────
// En la EDICIÓN de un producto: muestra cada bucket (almacén·proyecto) con su
// cantidad actual y una cantidad objetivo editable; permite agregar buckets. Al
// guardar llama ajustarBuckets → el backend genera un AJUSTE por cada cambio.
export function BucketEditor({ productoId, unidad, almacenes, proyectos, onSaved }) {
  const [rows, setRows] = useState([])       // [{ almacen_id, proyecto_id, almacen_nombre, proyecto_nombre, actual, objetivo }]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nuevoAlmacen, setNuevoAlmacen] = useState('')
  const [nuevoProyecto, setNuevoProyecto] = useState('')
  const permiteDecimales = unidadPermiteDecimales(unidad)

  const cargar = () => {
    setLoading(true)
    getProductoStocks(productoId, { incluirVacios: true })
      .then((d) => {
        const bs = (d.stocks_proyecto || []).map((b) => ({
          almacen_id: b.almacen_id,
          proyecto_id: b.proyecto_id ?? null,
          almacen_nombre: b.almacen_nombre,
          proyecto_nombre: b.proyecto_nombre || 'General',
          actual: Number(b.cantidad) || 0,
          objetivo: String(Number(b.cantidad) || 0),
        }))
        setRows(bs)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [productoId])

  const claveDe = (almacenId, proyId) => `${almacenId}:${proyId ?? 0}`
  const clavesExistentes = new Set(rows.map((r) => claveDe(r.almacen_id, r.proyecto_id)))

  const setObjetivo = (idx, val) => setRows((prev) => prev.map((r, i) =>
    i === idx ? { ...r, objetivo: permiteDecimales ? val : val.replace(/[.,].*$/, '') } : r,
  ))

  const agregarBucket = () => {
    if (!nuevoAlmacen) return
    const proyId = nuevoProyecto ? Number(nuevoProyecto) : null
    if (clavesExistentes.has(claveDe(Number(nuevoAlmacen), proyId))) {
      toast.error('Ese almacén y proyecto ya está en la lista')
      return
    }
    const alm = almacenes.find((a) => String(a.id) === String(nuevoAlmacen))
    const proy = proyectos.find((p) => String(p.id) === String(nuevoProyecto))
    setRows((prev) => [...prev, {
      almacen_id: Number(nuevoAlmacen),
      proyecto_id: proyId,
      almacen_nombre: alm ? alm.nombre : `Almacén #${nuevoAlmacen}`,
      proyecto_nombre: proy ? proy.numero_proyecto : 'General',
      actual: 0,
      objetivo: '',
    }])
    setNuevoAlmacen(''); setNuevoProyecto('')
  }

  const hayCambios = rows.some((r) => r.objetivo !== '' && Number(r.objetivo) !== r.actual)
  const hayInvalido = rows.some((r) => r.objetivo === '' || isNaN(Number(r.objetivo)) || Number(r.objetivo) < 0)

  const guardar = async () => {
    if (!hayCambios || hayInvalido) return
    setSaving(true)
    try {
      const buckets = rows.map((r) => ({
        almacen_id: r.almacen_id,
        proyecto_id: r.proyecto_id ?? null,
        cantidad_objetivo: Number(r.objetivo),
      }))
      const res = await ajustarBuckets(productoId, { buckets })
      toast.success(`Stock ajustado (${res?.buckets_ajustados ?? 0} bucket${(res?.buckets_ajustados ?? 0) === 1 ? '' : 's'})`)
      cargar()
      onSaved?.()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo ajustar el stock'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-ink-200 dark:border-ink-800 p-3 space-y-3 bg-ink-50/50 dark:bg-ink-900/30">
      <div className="flex items-center gap-2">
        <Warehouse size={14} className="text-ink-500" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Stock por bodega y proyecto</p>
      </div>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-ink-500">Sin existencias registradas. Agrega un bucket para capturar stock.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, idx) => {
            const objetivoNum = Number(r.objetivo)
            // Redondeado a 2 decimales: la resta de flotantes convierte
            // `10.5 − 10.2` en `0.2999999999999998`, que no cabe en la columna y
            // además hacía que un bucket sin cambio real se pintara como
            // cambiado por un residuo de 1e-17. Los productos por metro (cable)
            // son justo los que caen aquí.
            const delta = r.objetivo === '' || isNaN(objetivoNum)
              ? 0
              : Math.round((objetivoNum - r.actual) * 100) / 100
            return (
              <div key={claveDe(r.almacen_id, r.proyecto_id)} className="flex items-center gap-2 text-sm">
                {/* El `truncate` va en el contenedor, no en el `span`: en un
                    elemento inline `overflow:hidden` no aplica, así que el
                    recorte no ocurría y un nombre de bodega largo se desbordaba
                    sobre el input en vez de cortarse. Aquí trunca la línea
                    entera (bodega · proyecto), que es como se lee. */}
                <div className="flex-1 min-w-0 truncate" title={`${r.almacen_nombre} · ${r.proyecto_nombre}`}>
                  <span className="font-medium text-ink-800 dark:text-ink-100">{r.almacen_nombre}</span>
                  <span className="text-ink-400"> · </span>
                  <span className="text-ink-500">{r.proyecto_nombre}</span>
                </div>
                <span className="text-[11px] text-ink-400 tabular-nums w-16 text-right">actual: {r.actual}</span>
                <Input
                  type="number" min="0"
                  step={permiteDecimales ? '0.01' : 1}
                  value={r.objetivo}
                  onChange={(e) => setObjetivo(idx, e.target.value)}
                  wrapperClassName="w-24"
                  className="h-9 text-center tabular-nums"
                />
                <span className={`text-[11px] font-bold tabular-nums w-14 text-right ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-ink-300'}`}>
                  {delta > 0 ? `+${delta}` : delta < 0 ? delta : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Agregar bucket nuevo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
        <Select label="Bodega" value={nuevoAlmacen} onChange={(e) => setNuevoAlmacen(e.target.value)} wrapperClassName="flex-1">
          <option value="">Selecciona…</option>
          {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </Select>
        <Select label="Proyecto" value={nuevoProyecto} onChange={(e) => setNuevoProyecto(e.target.value)} wrapperClassName="flex-1">
          <option value="">General (sin proyecto)</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.numero_proyecto}{p.nombre ? ` — ${p.nombre}` : ''}</option>)}
        </Select>
        <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={agregarBucket} disabled={!nuevoAlmacen}>
          Agregar
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-500 italic">Cada cambio genera un AJUSTE trazable en el kardex.</p>
        <Button type="button" size="sm" loading={saving} disabled={!hayCambios || hayInvalido} onClick={guardar}>
          Guardar ajustes de stock
        </Button>
      </div>
    </div>
  )
}

// Contraparte de `ubicacionInicial`: guarda dónde se quedó el usuario. Vive
// aquí para que `UBICACION_KEY` no se escriba desde dos archivos distintos.
export function guardarUbicacion({ verTodos, categoria }) {
  try {
    localStorage.setItem(UBICACION_KEY, JSON.stringify({ verTodos, categoria }))
  } catch {
    // localStorage lleno o bloqueado (modo privado): no es motivo para romper
    // la navegación, simplemente no se recuerda la ubicación.
  }
}
