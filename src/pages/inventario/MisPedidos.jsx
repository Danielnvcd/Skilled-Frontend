import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Send, Plus, Minus, Check, Trash2, Search, ShoppingCart,
  Wrench, Hexagon, Circle, ArrowDown, GitBranch, Boxes as BoxesIcon, Pipette, Printer, Package,
} from 'lucide-react'
import {
  Button, Card, PageHeader, Modal, Input, Select,
} from '../../components/ui'
import { getProductos, createSolicitud, getProyectosInventario } from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const CAT_CFG = {
  'Tornillería':        { color: '#4F46E5', bg: '#EEF2FF', Icon: Wrench },
  'Tuercas':            { color: '#B45309', bg: '#FFFBEB', Icon: Hexagon },
  'Rondanas':           { color: '#0891B2', bg: '#ECFEFF', Icon: Circle },
  'Pijas':              { color: '#7C3AED', bg: '#F5F3FF', Icon: ArrowDown },
  'Abrazaderas':        { color: '#059669', bg: '#ECFDF5', Icon: GitBranch },
  'Soportería':         { color: '#DC2626', bg: '#FEF2F2', Icon: BoxesIcon },
  'Tubería/Accesorios': { color: '#0284C7', bg: '#F0F9FF', Icon: Pipette },
}
const CAT_DEFAULT = { color: '#6B7280', bg: '#F3F4F6', Icon: Package }

const getCatCfg = (cat) => CAT_CFG[cat] || CAT_DEFAULT

export default function MisPedidos() {
  const [productos, setProductos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('Todas')
  const [proyecto, setProyecto] = useState('')
  const [notas, setNotas] = useState('')

  const [cart, setCart] = useState([])
  const [qtyModal, setQtyModal] = useState(null) // { producto, cantidad }

  useEffect(() => {
    Promise.all([
      getProductos({ limit: 500 }),
      getProyectosInventario().catch(() => []),
    ])
      .then(([prods, projs]) => {
        setProductos(prods)
        setProyectos(projs)
      })
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar catálogo')))
      .finally(() => setLoading(false))
  }, [])

  const categorias = useMemo(() => {
    const set = new Set()
    productos.forEach((p) => p.categoria && set.add(p.categoria))
    return ['Todas', ...Array.from(set).sort()]
  }, [productos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return productos.filter((p) => {
      const matchCat = activeCat === 'Todas' || p.categoria === activeCat
      const matchQ = !q || p.descripcion?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [productos, activeCat, search])

  const openQtyModal = (producto) => {
    const enCart = cart.find((c) => c.id === producto.id)
    setQtyModal({ producto, cantidad: enCart ? enCart.cantidad : 1 })
  }

  const confirmQty = () => {
    if (!qtyModal) return
    const qty = Number(qtyModal.cantidad)
    if (!qty || qty <= 0) {
      toast.error('La cantidad debe ser mayor a cero')
      return
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.id === qtyModal.producto.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], cantidad: qty }
        return copy
      }
      const p = qtyModal.producto
      return [...prev, { id: p.id, codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad, categoria: p.categoria, cantidad: qty }]
    })
    setQtyModal(null)
  }

  const adjustCartQty = (id, delta) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.id !== id) return [item]
        const nueva = Math.round((item.cantidad + delta) * 10) / 10
        if (nueva <= 0) return []
        return [{ ...item, cantidad: nueva }]
      })
    )
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id))

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un artículo a tu pedido')
      return
    }
    setSaving(true)
    try {
      const payload = {
        proyecto: proyecto || null,
        detalles: cart.map((item) => ({ producto_id: item.id, cantidad_solicitada: item.cantidad })),
      }
      await createSolicitud(payload)
      toast.success(`Solicitud enviada (${cart.length} ítems)`)
      setCart([])
      setProyecto('')
      setNotas('')
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo enviar la solicitud'))
    } finally {
      setSaving(false)
    }
  }

  const handlePrintPDF = () => {
    if (cart.length === 0) {
      toast.error('Agrega artículos antes de imprimir')
      return
    }
    const folio = 'SOL-' + Date.now().toString().slice(-6)
    const fecha = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const proyectoTxt = proyecto || '—'
    const notasHTML = notas.trim()
      ? `<div class="notes-box"><div class="notes-label">Observaciones</div><div class="notes-text">${escapeHTML(notas.trim())}</div></div>`
      : ''
    const filas = cart.map((item, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${escapeHTML(item.descripcion)}</td>
        <td><span class="sku">${escapeHTML(item.codigo)}</span></td>
        <td class="r bold ac">${item.cantidad}</td>
        <td class="muted">${escapeHTML(item.unidad || '')}</td>
      </tr>`).join('')

    const win = window.open('', '_blank', 'width=860,height=1100')
    if (!win) {
      toast.error('Activa las ventanas emergentes para ver el PDF')
      return
    }
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Solicitud ${folio}</title>
    <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:44px 52px;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start}
    .logo{font-size:28px;font-weight:900;letter-spacing:-.03em;color:#111}
    .logo span{color:#4F46E5}
    .logo-sub{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-top:5px}
    .folio-box{text-align:right}
    .folio-num{font-size:18px;font-weight:900;color:#111}
    .folio-date{font-size:11px;color:#888;margin-top:4px}
    .divider{border:none;border-top:3px solid #111;margin:16px 0 20px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 40px;margin-bottom:20px}
    .info-field label{font-size:9px;font-weight:900;color:#888;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:3px}
    .info-field span{font-size:13px;font-weight:600;color:#111;display:block;padding-bottom:5px;border-bottom:1px solid #E5E7EB}
    .notes-box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:7px;padding:12px 16px;margin-bottom:20px}
    .notes-label{font-size:9px;font-weight:900;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
    .notes-text{font-size:12px;color:#374151;line-height:1.5}
    .section-title{font-size:10px;font-weight:900;color:#6B7280;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}
    .table-wrap{border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#111827}
    thead th{color:#fff;padding:10px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:800}
    tbody tr:nth-child(even) td{background:#F9FAFB}
    tbody td{padding:10px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle}
    .c{text-align:center}.r{text-align:right}.bold{font-weight:800;color:#4F46E5}
    .ac{font-size:15px}.muted{color:#9CA3AF;font-size:11px;font-weight:600}
    .sku{display:inline-block;background:#F3F4F6;color:#6B7280;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
    .sig-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:48px}
    .sig{text-align:center}
    .sig-line{border-top:1.5px solid #374151;padding-top:8px;font-size:10px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    @media print{@page{margin:1.5cm 2cm;size:letter}body{padding:0}}
    </style></head><body>
    <div class="header">
      <div><div class="logo">SKIL<span>LED</span></div><div class="logo-sub">Solicitud de Materiales</div></div>
      <div class="folio-box"><div class="folio-num">${folio}</div><div class="folio-date">${fecha}</div></div>
    </div>
    <div class="divider"></div>
    <div class="info-grid">
      <div class="info-field"><label>Proyecto</label><span>${escapeHTML(proyectoTxt)}</span></div>
      <div class="info-field"><label>Total de materiales</label><span>${cart.length} línea${cart.length !== 1 ? 's' : ''}</span></div>
    </div>
    ${notasHTML}
    <div class="section-title">Materiales Solicitados</div>
    <div class="table-wrap"><table>
      <thead><tr><th class="c" style="width:36px">#</th><th>Descripción del Material</th><th>Código (SKU)</th><th class="r" style="width:72px">Cant.</th><th style="width:56px">Unidad</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    <div class="sig-grid">
      <div class="sig"><div class="sig-line">Solicitante</div></div>
      <div class="sig"><div class="sig-line">Jefe de Almacén</div></div>
      <div class="sig"><div class="sig-line">Autorizado por</div></div>
    </div>
    <script>window.onload=function(){window.focus();window.print();}<\/script>
    </body></html>`)
    win.document.close()
  }

  const cartCount = cart.reduce((acc, i) => acc + 1, 0)

  return (
    <div>
      <PageHeader
        icon={Send}
        title="Pedir material"
        description="Selecciona productos del catálogo y envía tu solicitud al almacén."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Búsqueda */}
          <Card className="!p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por descripción o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full h-9 pl-9 pr-3 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
            </div>
          </Card>

          {/* Chips categorías */}
          <div className="flex flex-wrap gap-2">
            {categorias.map((cat) => {
              const isAll = cat === 'Todas'
              const cfg = isAll ? null : getCatCfg(cat)
              const isActive = cat === activeCat
              const style = cfg
                ? {
                    color: isActive ? 'white' : cfg.color,
                    background: isActive ? cfg.color : cfg.bg,
                    borderColor: isActive ? cfg.color : cfg.bg,
                  }
                : {
                    color: isActive ? 'white' : '#374151',
                    background: isActive ? '#374151' : '#F3F4F6',
                    borderColor: isActive ? '#374151' : '#E5E7EB',
                  }
              const Icon = cfg?.Icon || Search
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={style}
                >
                  <Icon size={13} strokeWidth={2.5} />
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Grid de productos */}
          <div>
            <p className="text-xs text-ink-500 mb-2 px-1">{filtered.length} materiales</p>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-ink-100 dark:bg-ink-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-10 text-center text-ink-500">
                <Search size={32} className="mx-auto mb-2 text-ink-300" />
                <p className="text-sm font-semibold">No se encontraron materiales</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filtered.map((p) => {
                  const cfg = getCatCfg(p.categoria)
                  const stock = parseFloat(p.stock_actual)
                  const bajo = stock <= parseFloat(p.stock_minimo)
                  const enCart = cart.find((c) => c.id === p.id)
                  const Icon = cfg.Icon
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openQtyModal(p)}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl text-left hover:border-brand-400 hover:shadow-sm transition-all"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <Icon size={20} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-ink-900 dark:text-ink-100 truncate">
                          {p.descripcion}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-black bg-ink-100 dark:bg-ink-800 text-ink-500 px-1.5 py-0.5 rounded uppercase">
                            {p.codigo}
                          </span>
                          <span className={`text-[10px] font-semibold ${bajo ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {Number.isInteger(stock) ? stock : stock.toFixed(1)} {p.unidad}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          enCart
                            ? 'bg-emerald-500 text-white'
                            : 'bg-ink-100 dark:bg-ink-800 text-ink-500 group-hover:bg-brand-500 group-hover:text-white'
                        }`}
                      >
                        {enCart ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Carrito */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 dark:text-ink-100 flex items-center gap-2">
                <ShoppingCart size={16} /> Mi solicitud
              </h3>
              <span className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded">
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </span>
            </div>

            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-ink-200 dark:border-ink-700 rounded-2xl">
                  <ShoppingCart size={32} className="mx-auto mb-2 text-ink-300" />
                  <p className="text-ink-400 text-xs font-medium">Agrega materiales del catálogo</p>
                </div>
              ) : (
                cart.map((item) => {
                  const cfg = getCatCfg(item.categoria)
                  const Icon = cfg.Icon
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2.5 bg-ink-50 dark:bg-ink-800/50 rounded-xl border border-ink-200 dark:border-ink-800"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        <Icon size={16} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-ink-900 dark:text-ink-100 truncate leading-tight">
                          {item.descripcion}
                        </p>
                        <p className="text-[9px] font-black text-ink-400 uppercase">{item.codigo}</p>
                      </div>
                      <div className="inline-flex items-center gap-1 bg-white dark:bg-ink-900 rounded-md border border-ink-200 dark:border-ink-700">
                        <button
                          type="button"
                          onClick={() => adjustCartQty(item.id, -1)}
                          className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-brand-600"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold min-w-[24px] text-center">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => adjustCartQty(item.id, +1)}
                          className="w-6 h-6 inline-flex items-center justify-center text-ink-500 hover:text-brand-600"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-ink-300 hover:text-rose-500 transition-colors p-1 flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-4 border-t border-ink-200 dark:border-ink-800 space-y-3">
              <Select label="Proyecto" value={proyecto} onChange={(e) => setProyecto(e.target.value)}>
                <option value="">Sin proyecto asociado</option>
                {proyectos.map((p) => {
                  const txt = `${p.numero_proyecto} — ${p.nombre || ''}`.trim()
                  return <option key={p.id} value={txt}>{txt}</option>
                })}
              </Select>

              <Input
                label="Observaciones (opcional)"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas para el almacén..."
              />

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSubmit}
                  loading={saving}
                  disabled={cart.length === 0}
                  leftIcon={<Send size={14} />}
                >
                  Enviar solicitud
                </Button>
                <Button
                  variant="secondary"
                  onClick={handlePrintPDF}
                  disabled={cart.length === 0}
                  leftIcon={<Printer size={14} />}
                >
                  Imprimir PDF
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal cantidad */}
      <Modal
        open={!!qtyModal}
        onClose={() => setQtyModal(null)}
        title="Cantidad a solicitar"
        footer={
          <>
            <Button variant="secondary" onClick={() => setQtyModal(null)}>Cancelar</Button>
            <Button onClick={confirmQty}>Agregar al pedido</Button>
          </>
        }
      >
        {qtyModal && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-ink-900 dark:text-ink-100">{qtyModal.producto.descripcion}</p>
              <p className="text-xs text-ink-500 font-mono mt-1">{qtyModal.producto.codigo}</p>
              <p className="text-xs text-ink-500 mt-2">
                Stock disponible:{' '}
                <strong>{qtyModal.producto.stock_actual} {qtyModal.producto.unidad}</strong>
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setQtyModal({ ...qtyModal, cantidad: Math.max(0.1, Math.round((Number(qtyModal.cantidad) - 1) * 10) / 10) })}
                className="w-12 h-12 rounded-xl bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 flex items-center justify-center"
              >
                <Minus size={20} />
              </button>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={qtyModal.cantidad}
                onChange={(e) => setQtyModal({ ...qtyModal, cantidad: e.target.value })}
                onFocus={(e) => e.target.select()}
                className="w-28 h-12 text-center text-2xl font-bold rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setQtyModal({ ...qtyModal, cantidad: Math.round((Number(qtyModal.cantidad) + 1) * 10) / 10 })}
                className="w-12 h-12 rounded-xl bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </div>
            <p className="text-center text-xs text-ink-500">Unidad: {qtyModal.producto.unidad}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}
