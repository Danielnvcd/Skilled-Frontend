import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Tag, Printer, Trash2, QrCode, BarChart3, Layers,
  Search, Loader2, Check, Plus, ListChecks, X, Package,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Modal, InfoTip, Pagination,
} from '../../components/ui'
import { generarEtiquetasPdf, getProductos, getCategorias } from '../../api/inventario'
import { useProductoSearch } from '../../hooks/useProductoSearch'
import { extractApiError } from '../../utils/apiError'

const FORMATOS = [
  { value: 'avery_5160', label: 'Avery 5160 — 30 etiquetas/hoja (2.625" × 1")', porHoja: 30 },
  { value: 'avery_5163', label: 'Avery 5163 — 10 etiquetas/hoja (4" × 2")', porHoja: 10 },
]
const TOPE_TOTAL = 500

// El backend acota `limit` a 1000. Para "seleccionar todos" hay que paginar.
const PAGE = 1000

// Trae TODOS los productos que coinciden con el filtro, paginando en bloques.
async function fetchTodosProductos({ q = '', categoria } = {}) {
  const acc = []
  let skip = 0
  // Bucle de paginación: corta cuando una página viene incompleta.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await getProductos({ q, categoria, skip, limit: PAGE })
    acc.push(...(page || []))
    if (!page || page.length < PAGE) break
    skip += PAGE
  }
  return acc
}

export default function Etiquetas() {
  const [formato, setFormato] = useState('avery_5160')
  const [tipo, setTipo] = useState('barcode')
  // items = [{producto_id, codigo, descripcion, categoria, unidad, cantidad}]
  // Guardamos los datos del producto en el propio item: ya no precargamos el
  // catálogo completo (no escala a miles), el picker trae el producto al elegirlo.
  const [items, setItems] = useState([])
  const [generando, setGenerando] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const totalEtiquetas = items.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0)
  const formatoActual = FORMATOS.find((f) => f.value === formato) ?? FORMATOS[0]
  const hojas = Math.ceil(totalEtiquetas / formatoActual.porHoja) || 0
  const excedeTope = totalEtiquetas > TOPE_TOTAL

  const quitar = (id) => setItems((prev) => prev.filter((i) => i.producto_id !== id))
  const cambiarCantidad = (id, valor) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, cantidad: valor } : i)),
    )
  }

  // El modal devuelve la lista de productos seleccionados. Conservamos las
  // cantidades de los que ya estaban; los nuevos entran con cantidad 1.
  const aplicarSeleccion = (productos) => {
    setItems((prev) => {
      const cantPrevia = new Map(prev.map((i) => [i.producto_id, i.cantidad]))
      return productos.map((p) => ({
        producto_id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        categoria: p.categoria,
        unidad: p.unidad,
        cantidad: cantPrevia.get(p.id) ?? 1,
      }))
    })
  }

  const generar = async () => {
    if (items.length === 0) {
      toast.error('Selecciona al menos un producto')
      return
    }
    const itemsValidos = items
      .map((i) => ({ producto_id: i.producto_id, cantidad: Number(i.cantidad) || 0 }))
      .filter((i) => i.cantidad > 0)
    if (itemsValidos.length === 0) {
      toast.error('Captura cantidades mayores a 0')
      return
    }
    if (itemsValidos.reduce((a, i) => a + i.cantidad, 0) > TOPE_TOTAL) {
      toast.error(`No puedes pedir más de ${TOPE_TOTAL} etiquetas en un PDF`)
      return
    }
    setGenerando(true)
    try {
      await generarEtiquetasPdf({ formato, tipo, items: itemsValidos })
      toast.success('PDF de etiquetas listo')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el PDF'))
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={Tag}
        title="Etiquetas imprimibles"
        description="Genera un PDF Avery con código de barras o QR para tus productos."
      />

      {/* Configuración */}
      <Card className="mt-6 !p-5">
        <h3 className="font-semibold text-ink-900 dark:text-ink-100 mb-3">Configuración del PDF</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 flex items-center gap-1">
              Formato de hoja
              <InfoTip text="Tamaño de las etiquetas Avery. 5160 = 30 etiquetas chicas por hoja; 5163 = 10 etiquetas grandes por hoja. Usa el que tengas en la impresora." />
            </label>
            <Select value={formato} onChange={(e) => setFormato(e.target.value)}>
              {FORMATOS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 flex items-center gap-1">
              Tipo de código
              <InfoTip text="Código de barras (Code128): lo lee cualquier escáner común, más rápido de generar. QR: se escanea con la cámara del celular." />
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                title="Code128 — lo lee un escáner común"
                onClick={() => setTipo('barcode')}
                className={`inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition ${
                  tipo === 'barcode'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-brand-400'
                }`}
              >
                <BarChart3 size={14} /> Código de barras
              </button>
              <button
                type="button"
                title="Código QR — se escanea con la cámara del celular"
                onClick={() => setTipo('qr')}
                className={`inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition ${
                  tipo === 'qr'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-brand-400'
                }`}
              >
                <QrCode size={14} /> Código QR
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <div className={`p-3 rounded-md border text-sm ${
              excedeTope
                ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200'
                : 'border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-900'
            }`}>
              <div className="flex items-center gap-2">
                <Layers size={14} />
                <span className="font-semibold">
                  {totalEtiquetas} etiquetas · {hojas} hoja{hojas === 1 ? '' : 's'}
                </span>
              </div>
              {excedeTope && (
                <p className="text-xs mt-1">
                  Excede el tope de {TOPE_TOTAL} etiquetas por PDF. Genera el resto en otra
                  tanda (por ejemplo, filtrando por categoría).
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Productos seleccionados */}
      <Card className="mt-4 !p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100 flex items-center gap-1">
            Productos a etiquetar <span className="text-ink-500 font-normal">({items.length})</span>
            <InfoTip text="Lista de productos que saldrán en el PDF. Ajusta cuántas etiquetas quieres de cada uno en la columna “Etiquetas”." />
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setModalOpen(true)}
              title="Abre el catálogo para elegir productos o seleccionarlos todos"
            >
              <Package size={16} className="mr-1.5" />
              Agregar productos
            </Button>
            <Button
              variant="primary"
              onClick={generar}
              loading={generando}
              disabled={generando || items.length === 0 || excedeTope || totalEtiquetas === 0}
              title={
                items.length === 0
                  ? 'Primero agrega productos'
                  : excedeTope
                    ? `Excede ${TOPE_TOTAL} etiquetas: genera por partes`
                    : 'Genera y abre el PDF de etiquetas'
              }
            >
              <Printer size={16} className="mr-1.5" />
              Generar PDF
            </Button>
          </div>
        </div>
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <Layers size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Máximo <strong>{TOPE_TOTAL} etiquetas por PDF</strong>. Si tienes muchos productos
            (p. ej. todo el catálogo), genéralos por partes: filtra por categoría o estante e
            imprime en tandas de hasta {TOPE_TOTAL}.
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-ink-500 py-3">Usa “Agregar productos” para elegir qué etiquetar.</p>
        ) : (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-right px-3 py-2 w-28">Etiquetas</th>
                  <th className="px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {items.map((i) => {
                  return (
                    <tr key={i.producto_id}>
                      <td className="px-3 py-2 font-mono text-xs">{i.codigo}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{i.descripcion}</p>
                        <p className="text-xs text-ink-500">{i.categoria} · {i.unidad}</p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={i.cantidad}
                          onChange={(e) => cambiarCantidad(i.producto_id, e.target.value)}
                          className="w-20 px-2 py-1 rounded border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => quitar(i.producto_id)} title="Quitar">
                          <Trash2 size={14} className="text-rose-600" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: elegir productos a etiquetar (mismo patrón que estantes) */}
      <ProductosEtiquetaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        seleccionInicial={items}
        onConfirm={(productos) => { aplicarSeleccion(productos); setModalOpen(false) }}
      />
    </div>
  )
}

/* ─── Modal de selección: catálogo (izq) + seleccionados (der) ──────────────── */
function ProductosEtiquetaModal({ open, onClose, seleccionInicial, onConfirm }) {
  const [categorias, setCategorias] = useState([])
  const [asignados, setAsignados] = useState([])   // objetos producto-like
  const [saving, setSaving] = useState(false)

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [qDeb, setQDeb] = useState('')
  const [seleccionandoTodos, setSeleccionandoTodos] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])
  // Catálogo paginado por páginas: el paginador navega el resto (nada inalcanzable).
  const { opciones: resultados, loading: buscando, page, setPage, total, totalPages, size } = useProductoSearch({
    q: qDeb, categoria: cat, enabled: open, pageSize: 50,
  })

  // Al abrir: precarga seleccionados desde los items actuales y resetea filtros.
  useEffect(() => {
    if (!open) return
    setQ(''); setCat('')
    setAsignados(seleccionInicial.map((i) => ({
      id: i.producto_id,
      codigo: i.codigo,
      descripcion: i.descripcion,
      categoria: i.categoria,
      unidad: i.unidad,
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => setCategorias([]))
  }, [])

  const asignadosIds = useMemo(() => new Set(asignados.map((p) => p.id)), [asignados])

  const agregar = (p) => setAsignados((prev) => {
    if (prev.some((x) => x.id === p.id)) return prev
    if (prev.length >= TOPE_TOTAL) {
      toast.error(`Máximo ${TOPE_TOTAL} productos por PDF. Genera el resto en otra tanda.`)
      return prev
    }
    return [...prev, p]
  })
  const quitar = (id) => setAsignados((prev) => prev.filter((p) => p.id !== id))
  const limpiar = () => setAsignados([])

  // Agrega de golpe los productos que coinciden con la búsqueda/categoría
  // actuales (sin filtro = todo el catálogo), paginando contra el backend.
  // Tope: no pasa de TOPE_TOTAL seleccionados (un PDF no admite más).
  const seleccionarTodos = async () => {
    setSeleccionandoTodos(true)
    try {
      const todos = await fetchTodosProductos({ q: q.trim(), categoria: cat || undefined })
      setAsignados((prev) => {
        const yaIds = new Set(prev.map((p) => p.id))
        const candidatos = todos.filter((p) => !yaIds.has(p.id))
        const espacio = TOPE_TOTAL - prev.length
        if (espacio <= 0) {
          toast.error(`Ya tienes el máximo de ${TOPE_TOTAL} productos. Genera el resto en otra tanda.`)
          return prev
        }
        const nuevos = candidatos.slice(0, espacio)
        if (nuevos.length === 0) {
          toast('No hay productos nuevos que agregar')
        } else if (candidatos.length > nuevos.length) {
          toast(`Se agregaron ${nuevos.length} (tope de ${TOPE_TOTAL} por PDF). Genera el resto en otra tanda.`)
        } else {
          toast.success(`${nuevos.length} producto(s) agregado(s)`)
        }
        return [...prev, ...nuevos]
      })
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron cargar los productos'))
    } finally {
      setSeleccionandoTodos(false)
    }
  }

  const confirmar = () => {
    setSaving(true)
    onConfirm(asignados)
    setSaving(false)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar productos a etiquetar"
      description="Agrega desde el catálogo (izquierda) los productos que quieres etiquetar. Usa “Seleccionar todos” para añadir todo el catálogo o lo que coincida con el filtro."
      size="xl"
      footer={
        <>
          <span className="text-xs text-ink-500 mr-auto">{asignados.length} / {TOPE_TOTAL} seleccionado(s)</span>
          <Button variant="secondary" onClick={onClose} disabled={saving} title="Cierra sin guardar los cambios">Cancelar</Button>
          <Button onClick={confirmar} loading={saving} title="Pasa los productos seleccionados a la lista de etiquetas">Aplicar</Button>
        </>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        {/* Izquierda: catálogo */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1">
              Catálogo
              <InfoTip text="Toca un producto para agregarlo a la derecha. Usa el buscador o el filtro de categoría para encontrarlo más rápido." />
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={seleccionarTodos}
              loading={seleccionandoTodos}
              disabled={seleccionandoTodos}
              title={`Agrega todos los productos que coincidan con el filtro actual, hasta un máximo de ${TOPE_TOTAL} por PDF`}
            >
              <ListChecks size={14} className="mr-1.5" />
              {cat || q.trim() ? 'Seleccionar todos (filtro)' : 'Seleccionar todos'}
            </Button>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar código o descripción…"
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
              />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-36">
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 h-[48vh] overflow-y-auto">
            {buscando ? (
              <div className="px-3 py-3 text-xs text-ink-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Buscando…</div>
            ) : resultados.length === 0 ? (
              <div className="px-3 py-6 text-xs text-ink-400 text-center">Sin resultados</div>
            ) : (
              resultados.map((p) => {
                const ya = asignadosIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={ya}
                    onClick={() => agregar(p)}
                    title={ya ? 'Ya está seleccionado' : 'Clic para agregar a etiquetar'}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${ya ? 'opacity-50 cursor-default' : 'hover:bg-brand-50 dark:hover:bg-brand-900/20'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 dark:text-ink-100 truncate leading-tight">{p.descripcion}</p>
                      <p className="text-[11px] font-mono text-ink-400">{p.codigo}</p>
                    </div>
                    <span className="text-[10px] text-ink-400 tabular-nums flex-shrink-0">{p.stock_actual} {p.unidad}</span>
                    {ya ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0"><Check size={13} /> Agregado</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex-shrink-0"><Plus size={13} /> Agregar</span>
                    )}
                  </button>
                )
              })
            )}
            {!buscando && totalPages > 1 && (
              <div className="px-3 pb-1">
                <Pagination page={page} totalPages={totalPages} totalElements={total} size={size} onChange={setPage} />
              </div>
            )}
          </div>
        </div>

        {/* Derecha: seleccionados */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1">
              Seleccionados
              <InfoTip text="Productos que pasarán a la lista de etiquetas al dar “Aplicar”. Quita los que no quieras con su botón de quitar." />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-500">{asignados.length}</span>
              {asignados.length > 0 && (
                <Button variant="ghost" size="sm" onClick={limpiar} title="Quitar todos">
                  <Trash2 size={13} className="mr-1 text-rose-600" /> Limpiar
                </Button>
              )}
            </div>
          </div>
          {asignados.length === 0 ? (
            <div className="h-[48vh] flex items-center justify-center text-center text-sm text-ink-400 border border-dashed border-ink-300 dark:border-ink-700 rounded-lg px-4">
              Ningún producto seleccionado todavía.<br />Agrégalos desde el catálogo de la izquierda.
            </div>
          ) : (
            <div className="border border-ink-200 dark:border-ink-800 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 h-[48vh] overflow-y-auto">
              {asignados.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-ink-50 dark:hover:bg-ink-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate leading-tight">{p.descripcion}</p>
                    <p className="text-[11px] font-mono text-ink-400">{p.codigo}</p>
                  </div>
                  {p.categoria && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 flex-shrink-0">{p.categoria}</span>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => quitar(p.id)} title="Quitar">
                    <X size={14} className="text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
