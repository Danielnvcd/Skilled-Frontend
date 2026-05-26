import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle, History, Filter, RefreshCw, TrendingDown,
  Package, Search, ShoppingCart, MessageCircle, Download, X,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Select, Skeleton, EmptyState,
  Table, THead, TH, TBody, TR, TD, Badge, Modal, Input, Textarea,
} from '../../components/ui'
import {
  getProductosBajoMinimo,
  sugerirOCExpress,
  generarOCExpressPdf,
  descargarPdfDesdeUrl,
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

const URGENCIA_META = {
  critico:  { label: 'Crítico',    tone: 'danger',  rowBg: 'bg-rose-50/60 dark:bg-rose-900/10', icon: '🔥', sub: '< 7 días' },
  alto:     { label: 'Alto',       tone: 'warning', rowBg: 'bg-amber-50/60 dark:bg-amber-900/10', icon: '⚠️', sub: '< 14 días' },
  medio:    { label: 'Medio',      tone: 'info',    rowBg: '', icon: '•', sub: '≥ 14 días' },
  estatico: { label: 'Sin consumo', tone: 'neutral', rowBg: '', icon: '·', sub: 'No se mueve' },
}

export default function BajoMinimo() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [urgenciaFiltro, setUrgenciaFiltro] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [ocModalOpen, setOcModalOpen] = useState(false)

  const cargar = () => {
    setLoading(true)
    getProductosBajoMinimo()
      .then(setItems)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar productos bajo mínimo')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const categorias = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const filtrados = useMemo(() => {
    let r = items
    if (urgenciaFiltro) r = r.filter((i) => i.urgencia === urgenciaFiltro)
    if (categoriaFiltro) r = r.filter((i) => i.categoria === categoriaFiltro)
    if (search.trim()) {
      const s = search.toLowerCase()
      r = r.filter((i) =>
        i.codigo?.toLowerCase().includes(s) ||
        i.descripcion?.toLowerCase().includes(s)
      )
    }
    return r
  }, [items, urgenciaFiltro, categoriaFiltro, search])

  const stats = useMemo(() => {
    const acc = { critico: 0, alto: 0, medio: 0, estatico: 0 }
    for (const i of items) acc[i.urgencia] = (acc[i.urgencia] || 0) + 1
    return acc
  }, [items])

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAllVisibles = () => {
    setSelected((prev) => {
      const visibles = filtrados.map((p) => p.id)
      const todosSeleccionados = visibles.every((id) => prev.has(id))
      const next = new Set(prev)
      if (todosSeleccionados) {
        visibles.forEach((id) => next.delete(id))
      } else {
        visibles.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const limpiarSeleccion = () => setSelected(new Set())

  const abrirGenerarOC = () => {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un producto')
      return
    }
    setOcModalOpen(true)
  }

  return (
    <div>
      <PageHeader
        icon={AlertTriangle}
        title="Productos bajo mínimo"
        description="Listado de productos en o bajo el umbral de reabastecimiento, ordenados por urgencia."
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={cargar}>
            Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
        <KpiCard label="Crítico (<7d)" value={stats.critico} tone="rose" icon={TrendingDown} active={urgenciaFiltro === 'critico'} onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'critico' ? '' : 'critico')} />
        <KpiCard label="Alto (<14d)"   value={stats.alto}    tone="amber" icon={AlertTriangle} active={urgenciaFiltro === 'alto'}    onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'alto' ? '' : 'alto')} />
        <KpiCard label="Medio"          value={stats.medio}   tone="sky"   icon={Package}       active={urgenciaFiltro === 'medio'}   onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'medio' ? '' : 'medio')} />
        <KpiCard label="Sin consumo"   value={stats.estatico} tone="ink"   icon={Package}      active={urgenciaFiltro === 'estatico'} onClick={() => setUrgenciaFiltro(urgenciaFiltro === 'estatico' ? '' : 'estatico')} />
      </div>

      {/* Filtros */}
      <Card className="p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
          <Filter size={12} /> Filtros
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Búsqueda</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código o descripción"
              className="w-full pl-8 pr-2 py-1 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Categoría</label>
          <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        {(search || categoriaFiltro || urgenciaFiltro) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setCategoriaFiltro(''); setUrgenciaFiltro('') }}
          >
            Limpiar
          </Button>
        )}
      </Card>

      {/* Barra de selección — visible cuando hay productos seleccionados */}
      {selected.size > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap items-center justify-between gap-3 ring-2 ring-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-900/10">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              {selected.size} producto{selected.size === 1 ? '' : 's'} seleccionado{selected.size === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={limpiarSeleccion}
              className="text-xs text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 underline"
            >
              limpiar
            </button>
          </div>
          <Button
            variant="primary"
            leftIcon={<ShoppingCart size={14} />}
            onClick={abrirGenerarOC}
          >
            Generar OC express
          </Button>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos bajo mínimo"
          description="Todo el inventario está por encima de su nivel de reabastecimiento."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin coincidencias"
          description="Cambia los filtros para ver más resultados."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TH style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={filtrados.length > 0 && filtrados.every((p) => selected.has(p.id))}
                  onChange={toggleAllVisibles}
                  aria-label="Seleccionar todos los visibles"
                />
              </TH>
              <TH>Urgencia</TH>
              <TH>Código</TH>
              <TH>Descripción</TH>
              <TH>Categoría</TH>
              <TH align="right">Stock</TH>
              <TH align="right">Mínimo</TH>
              <TH align="right">Faltante</TH>
              <TH align="right">Consumo/día</TH>
              <TH align="right">Días restantes</TH>
              <TH align="right">Acciones</TH>
            </THead>
            <TBody>
              {filtrados.map((p) => {
                const meta = URGENCIA_META[p.urgencia] || URGENCIA_META.medio
                const checked = selected.has(p.id)
                return (
                  <TR key={p.id} className={meta.rowBg}>
                    <TD>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelected(p.id)}
                        aria-label={`Seleccionar ${p.codigo}`}
                      />
                    </TD>
                    <TD>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </TD>
                    <TD className="font-mono text-xs">{p.codigo}</TD>
                    <TD className="font-medium">{p.descripcion}</TD>
                    <TD className="text-sm">{p.categoria}</TD>
                    <TD align="right" className="font-mono font-bold tabular-nums">{p.stock_actual} <span className="text-[10px] text-ink-400">{p.unidad}</span></TD>
                    <TD align="right" className="font-mono tabular-nums">{p.stock_minimo}</TD>
                    <TD align="right" className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      −{p.faltante}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums">{p.consumo_promedio_30d}</TD>
                    <TD align="right" className="font-mono font-bold tabular-nums">
                      {p.dias_de_stock_restante === null ? (
                        <span className="text-ink-400 italic">—</span>
                      ) : (
                        <span className={
                          p.dias_de_stock_restante < 7 ? 'text-rose-600 dark:text-rose-400' :
                          p.dias_de_stock_restante < 14 ? 'text-amber-600 dark:text-amber-400' :
                          'text-ink-700 dark:text-ink-200'
                        }>
                          {p.dias_de_stock_restante}d
                        </span>
                      )}
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1">
                        <Link to={`/inventario/productos/${p.id}/kardex`}>
                          <Button variant="ghost" size="icon-sm" title="Ver kardex">
                            <History size={14} />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Agregar a orden de compra"
                          onClick={() => toggleSelected(p.id)}
                        >
                          <ShoppingCart size={14} className={checked ? 'text-indigo-600' : ''} />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <OCExpressModal
        open={ocModalOpen}
        onClose={() => setOcModalOpen(false)}
        productoIds={Array.from(selected)}
        onGenerado={() => { /* deja la selección, por si quiere reintentar */ }}
      />
    </div>
  )
}

const KPI_TONES = {
  rose:  { ring: 'ring-rose-500/30',  icon: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300',     val: 'text-rose-700 dark:text-rose-300' },
  amber: { ring: 'ring-amber-500/30', icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300', val: 'text-amber-700 dark:text-amber-300' },
  sky:   { ring: 'ring-sky-500/30',   icon: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300',         val: 'text-sky-700 dark:text-sky-300' },
  ink:   { ring: 'ring-ink-400/30',   icon: 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300',             val: 'text-ink-900 dark:text-ink-100' },
}

function KpiCard({ label, value, tone, icon: Icon, active, onClick }) {
  const t = KPI_TONES[tone] || KPI_TONES.ink
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl px-3 py-3 flex items-center gap-3 transition-all hover:shadow-md ${active ? `ring-2 ${t.ring}` : ''}`}
    >
      <span className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${t.icon}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <div className={`text-2xl font-extrabold leading-tight ${t.val}`}>{value}</div>
      </div>
    </button>
  )
}

/* ─── Modal de OC express ──────────────────────────────────────────────────── */

function OCExpressModal({ open, onClose, productoIds, onGenerado }) {
  const [loading, setLoading] = useState(false)
  // grupos: [{ proveedor, contacto, notas, items: [{producto_id, codigo, descripcion, unidad,
  //   stock_actual, stock_minimo, consumo_promedio_30d, cantidad_sugerida, cantidad }] }]
  const [grupos, setGrupos] = useState([])
  // Resultados por proveedor después de generar: { [proveedor]: { url, whatsappLink, folio } }
  const [resultados, setResultados] = useState({})
  const [generando, setGenerando] = useState({})  // { [proveedor]: bool }

  useEffect(() => {
    if (!open || productoIds.length === 0) return
    setLoading(true)
    setResultados({})
    sugerirOCExpress(productoIds)
      .then((data) => {
        // Cada item arranca con cantidad = cantidad_sugerida (editable).
        const enriched = (data.grupos || []).map((g) => ({
          proveedor: g.proveedor,
          contacto: g.contacto || '',
          notas: '',
          items: g.items.map((it) => ({ ...it, cantidad: it.cantidad_sugerida })),
        }))
        setGrupos(enriched)
      })
      .catch((err) => {
        toast.error(extractApiError(err, 'No se pudo cargar la sugerencia'))
        onClose()
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productoIds.join(',')])

  const setGrupoField = (idx, field, value) => {
    setGrupos((prev) => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }
  const setItemCantidad = (gIdx, iIdx, value) => {
    setGrupos((prev) => prev.map((g, i) =>
      i !== gIdx ? g : {
        ...g,
        items: g.items.map((it, j) => j !== iIdx ? it : { ...it, cantidad: value }),
      }
    ))
  }
  const quitarItem = (gIdx, iIdx) => {
    setGrupos((prev) => prev.map((g, i) =>
      i !== gIdx ? g : { ...g, items: g.items.filter((_, j) => j !== iIdx) }
    ).filter((g) => g.items.length > 0))
  }

  const generarUno = async (gIdx) => {
    const g = grupos[gIdx]
    if (!g) return
    const proveedor = g.proveedor === 'Sin proveedor'
      ? (g.contacto?.trim() ? `Proveedor (${g.contacto.trim()})` : 'Sin proveedor')
      : g.proveedor
    if (!proveedor || !proveedor.trim()) {
      toast.error('Falta nombre de proveedor')
      return
    }
    const items = g.items
      .map((it) => ({ producto_id: it.producto_id, cantidad: Number(it.cantidad) }))
      .filter((it) => it.cantidad > 0)
    if (items.length === 0) {
      toast.error('Ningún ítem con cantidad > 0')
      return
    }
    setGenerando((prev) => ({ ...prev, [g.proveedor]: true }))
    try {
      const res = await generarOCExpressPdf({
        proveedor,
        contacto: g.contacto || '',
        notas: g.notas || '',
        items,
      })
      setResultados((prev) => ({ ...prev, [g.proveedor]: res }))
      // Abrimos el PDF en pestaña nueva.
      const w = window.open(res.url, '_blank')
      if (!w) toast.success(`PDF ${res.folio} listo — usa "Descargar" abajo.`)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo generar el PDF'))
    } finally {
      setGenerando((prev) => ({ ...prev, [g.proveedor]: false }))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generar órdenes de compra express"
      description="Una orden por proveedor. Edita cantidades, contacto y notas antes de generar el PDF."
      size="xl"
    >
      {loading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : grupos.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin productos para sugerir"
          description="Vuelve a seleccionar productos en la tabla."
        />
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {grupos.map((g, gIdx) => {
            const resultado = resultados[g.proveedor]
            const isGenerating = !!generando[g.proveedor]
            const totalItems = g.items.length
            return (
              <Card key={g.proveedor + gIdx} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-ink-500 tracking-wider">Proveedor</div>
                    <div className="text-lg font-bold">{g.proveedor}</div>
                  </div>
                  <Badge tone={g.proveedor === 'Sin proveedor' ? 'warning' : 'info'}>
                    {totalItems} ítem{totalItems === 1 ? '' : 's'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Contacto (tel/email)"
                    value={g.contacto}
                    onChange={(e) => setGrupoField(gIdx, 'contacto', e.target.value)}
                    placeholder="55 1234 5678"
                  />
                  <Textarea
                    label="Notas / observaciones"
                    rows={1}
                    value={g.notas}
                    onChange={(e) => setGrupoField(gIdx, 'notas', e.target.value)}
                    placeholder="Entregar en planta 2, etc."
                  />
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TH>Código</TH>
                      <TH>Descripción</TH>
                      <TH align="right">Stock / Mín.</TH>
                      <TH align="right">Consumo/día</TH>
                      <TH align="right">Sugerido</TH>
                      <TH align="right">Cantidad a comprar</TH>
                      <TH align="right">Quitar</TH>
                    </THead>
                    <TBody>
                      {g.items.map((it, iIdx) => (
                        <TR key={it.producto_id}>
                          <TD className="font-mono text-xs">{it.codigo}</TD>
                          <TD>{it.descripcion}</TD>
                          <TD align="right" className="font-mono text-xs">
                            {it.stock_actual} / {it.stock_minimo} {it.unidad}
                          </TD>
                          <TD align="right" className="font-mono tabular-nums">{it.consumo_promedio_30d}</TD>
                          <TD align="right" className="font-mono tabular-nums text-ink-500">
                            {it.cantidad_sugerida}
                          </TD>
                          <TD align="right" style={{ width: 130 }}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={it.cantidad}
                              onChange={(e) => setItemCantidad(gIdx, iIdx, e.target.value)}
                              className="w-24 text-right font-mono tabular-nums rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-sm"
                            />
                          </TD>
                          <TD align="right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Quitar línea"
                              onClick={() => quitarItem(gIdx, iIdx)}
                            >
                              <X size={14} />
                            </Button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {resultado && (
                    <>
                      <Badge tone="success">{resultado.folio}</Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Download size={13} />}
                        onClick={() => descargarPdfDesdeUrl(resultado.url, `${resultado.folio}.pdf`)}
                      >
                        Descargar
                      </Button>
                      {resultado.whatsappLink && (
                        <a href={resultado.whatsappLink} target="_blank" rel="noopener noreferrer">
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<MessageCircle size={13} />}
                          >
                            WhatsApp
                          </Button>
                        </a>
                      )}
                    </>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<ShoppingCart size={13} />}
                    disabled={isGenerating || g.items.length === 0}
                    onClick={() => generarUno(gIdx)}
                  >
                    {isGenerating ? 'Generando…' : resultado ? 'Regenerar PDF' : 'Generar PDF'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-ink-200 dark:border-ink-700">
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  )
}
