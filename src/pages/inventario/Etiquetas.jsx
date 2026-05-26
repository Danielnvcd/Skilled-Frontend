import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Tag, Printer, Plus, Trash2, Search, QrCode, BarChart3, Layers,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Skeleton,
} from '../../components/ui'
import { getProductos, generarEtiquetasPdf } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const FORMATOS = [
  { value: 'avery_5160', label: 'Avery 5160 — 30 etiquetas/hoja (2.625" × 1")', porHoja: 30 },
  { value: 'avery_5163', label: 'Avery 5163 — 10 etiquetas/hoja (4" × 2")', porHoja: 10 },
]
const TOPE_TOTAL = 500

export default function Etiquetas() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [formato, setFormato] = useState('avery_5160')
  const [tipo, setTipo] = useState('barcode')
  // items = [{producto_id, cantidad}]
  const [items, setItems] = useState([])
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    getProductos({ limit: 1000 })
      .then(setProductos)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar productos')))
      .finally(() => setLoading(false))
  }, [])

  const productosMap = useMemo(() => {
    const m = new Map()
    productos.forEach((p) => m.set(p.id, p))
    return m
  }, [productos])

  const productosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q),
    )
  }, [productos, search])

  const yaSeleccionados = useMemo(
    () => new Set(items.map((i) => i.producto_id)),
    [items],
  )

  const totalEtiquetas = items.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0)
  const formatoActual = FORMATOS.find((f) => f.value === formato) ?? FORMATOS[0]
  const hojas = Math.ceil(totalEtiquetas / formatoActual.porHoja) || 0
  const excedeTope = totalEtiquetas > TOPE_TOTAL

  const agregar = (p) => {
    if (yaSeleccionados.has(p.id)) return
    setItems((prev) => [...prev, { producto_id: p.id, cantidad: 1 }])
  }
  const quitar = (id) => setItems((prev) => prev.filter((i) => i.producto_id !== id))
  const cambiarCantidad = (id, valor) => {
    setItems((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, cantidad: valor } : i)),
    )
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
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Formato de hoja</label>
            <Select value={formato} onChange={(e) => setFormato(e.target.value)}>
              {FORMATOS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1 block">Tipo de código</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
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
                <p className="text-xs mt-1">Excede el tope de {TOPE_TOTAL} etiquetas.</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Productos seleccionados */}
      <Card className="mt-4 !p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100">
            Productos a etiquetar <span className="text-ink-500 font-normal">({items.length})</span>
          </h3>
          <Button
            variant="primary"
            onClick={generar}
            loading={generando}
            disabled={generando || items.length === 0 || excedeTope || totalEtiquetas === 0}
          >
            <Printer size={16} className="mr-1.5" />
            Generar PDF
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-ink-500 py-3">Agrega productos desde la lista de abajo.</p>
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
                  const p = productosMap.get(i.producto_id)
                  if (!p) return null
                  return (
                    <tr key={i.producto_id}>
                      <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{p.descripcion}</p>
                        <p className="text-xs text-ink-500">{p.categoria} · {p.unidad}</p>
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

      {/* Catálogo para agregar */}
      <Card className="mt-4 !p-5">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100 flex-1">Catálogo de productos</h3>
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="border border-ink-200 dark:border-ink-800 rounded-lg max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900 text-xs text-ink-500 uppercase sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-left px-3 py-2 hidden sm:table-cell">Categoría</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
                {productosFiltrados.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-500">
                    Sin productos {search ? 'para esa búsqueda' : ''}.
                  </td></tr>
                )}
                {productosFiltrados.map((p) => {
                  const usado = yaSeleccionados.has(p.id)
                  return (
                    <tr key={p.id} className={usado ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-mono text-xs">{p.codigo}</td>
                      <td className="px-3 py-2">{p.descripcion}</td>
                      <td className="px-3 py-2 text-xs text-ink-500 hidden sm:table-cell">{p.categoria}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => agregar(p)}
                          disabled={usado}
                          title={usado ? 'Ya está agregado' : 'Agregar a etiquetas'}
                        >
                          <Plus size={14} className="mr-1" /> {usado ? 'Agregado' : 'Agregar'}
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
    </div>
  )
}
