import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, Plus, Edit2, Trash2, QrCode, Printer, Package, Search, Check, Loader2, X, LayoutGrid, AlertTriangle, List, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Table, THead, TH, TBody, TR, TD, Select, Pagination
} from '../../components/ui'
import {
  getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen,
  getEstantesPorAlmacen, createEstante, updateEstante, deleteEstante,
  getCategorias,
  getEstanteLayout, saveEstanteLayout,
} from '../../api/inventario'
import { useProductoSearch } from '../../hooks/useProductoSearch'
import EstanteGrid from '../../components/inventario/EstanteGrid'
import { extractApiError } from '../../utils/apiError'
import { useSocket } from '../../context/SocketContext'

export default function AlmacenesEstantes() {
  const [almacenes, setAlmacenes] = useState([])
  const [estantes, setEstantes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [selectedAlmacen, setSelectedAlmacen] = useState(null)
  
  const [loadingAlm, setLoadingAlm] = useState(true)
  const [loadingEst, setLoadingEst] = useState(false)

  // Modals state
  const [formAlmacen, setFormAlmacen] = useState(null)
  const [formEstante, setFormEstante] = useState(null)
  
  const [confirmDelAlm, setConfirmDelAlm] = useState(null)
  const [confirmDelEst, setConfirmDelEst] = useState(null)

  // Modal de acomodar productos en la rejilla del estante.
  const [productosModalEstante, setProductosModalEstante] = useState(null)
  // Vista de estantes: 'tabla' (lista) o 'visual' (racks como se ven).
  const [vistaEstantes, setVistaEstantes] = useState('tabla')
  // En vista visual, qué estante se está mirando (id).
  const [estanteVisualSelId, setEstanteVisualSelId] = useState(null)

  const [saving, setSaving] = useState(false)

  const loadAlmacenes = () => {
    setLoadingAlm(true)
    getAlmacenes()
      .then(setAlmacenes)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar almacenes')))
      .finally(() => setLoadingAlm(false))
  }

  const loadEstantes = (almacenId) => {
    setLoadingEst(true)
    getEstantesPorAlmacen(almacenId)
      .then(setEstantes)
      .catch((err) => toast.error(extractApiError(err, 'Error al cargar estantes')))
      .finally(() => setLoadingEst(false))
  }

  useEffect(() => {
    loadAlmacenes()
    getCategorias().then(setCategorias).catch(() => setCategorias([]))
  }, [])

  useEffect(() => {
    if (selectedAlmacen) {
      loadEstantes(selectedAlmacen.id)
    } else {
      setEstantes([])
    }
  }, [selectedAlmacen])

  // Realtime: refresca cuando otro admin edita almacenes o estantes. Filtra
  // estantes por almacen seleccionado para no recargar la lista actual si el
  // cambio fue en otro almacén.
  const { on } = useSocket()
  useEffect(() => {
    const offAlm = on('almacen:changed', () => loadAlmacenes())
    const offEst = on('estante:changed', (payload) => {
      if (!selectedAlmacen) return
      const almId = payload?.almacen_id
      if (almId == null || Number(almId) === selectedAlmacen.id) {
        loadEstantes(selectedAlmacen.id)
      }
    })
    return () => { offAlm(); offEst() }
  }, [on, selectedAlmacen])

  // --- Handlers Almacen ---
  const handleSaveAlmacen = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (formAlmacen.id) {
        const actualizado = await updateAlmacen(formAlmacen.id, formAlmacen)
        toast.success('Almacén actualizado')
        // Sincroniza el panel derecho si se editó el almacén seleccionado
        // (antes seguía mostrando el nombre viejo).
        if (selectedAlmacen?.id === formAlmacen.id) {
          setSelectedAlmacen(actualizado || { ...selectedAlmacen, ...formAlmacen })
        }
      } else {
        await createAlmacen(formAlmacen)
        toast.success('Almacén creado')
      }
      setFormAlmacen(null)
      loadAlmacenes()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar almacén'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAlmacen = async () => {
    if (!confirmDelAlm) return
    try {
      await deleteAlmacen(confirmDelAlm.id)
      toast.success('Almacén eliminado')
      if (selectedAlmacen?.id === confirmDelAlm.id) setSelectedAlmacen(null)
      loadAlmacenes()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al eliminar'))
    } finally {
      setConfirmDelAlm(null)
    }
  }

  // --- Handlers Estante ---
  const handleSaveEstante = async (e, { openQR = false } = {}) => {
    e.preventDefault()
    setSaving(true)
    try {
      let estanteId = formEstante.id
      if (formEstante.id) {
        await updateEstante(formEstante.id, formEstante)
        toast.success('Estante actualizado')
      } else {
        const creado = await createEstante({ ...formEstante, almacen_id: selectedAlmacen.id })
        estanteId = creado?.id
        toast.success('Estante creado')
      }
      setFormEstante(null)
      loadEstantes(selectedAlmacen.id)
      if (openQR && estanteId) {
        window.open(`/inventario/qr/${estanteId}`, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar estante'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEstante = async () => {
    if (!confirmDelEst) return
    try {
      await deleteEstante(confirmDelEst.id)
      toast.success('Estante eliminado')
      loadEstantes(selectedAlmacen.id)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al eliminar'))
    } finally {
      setConfirmDelEst(null)
    }
  }

  return (
    <div>
      <PageHeader
        icon={Boxes}
        title="Almacenes y Estantes"
        description="Gestiona las bodegas y sus divisiones físicas."
        actions={
          <Button leftIcon={<Plus size={15} />} onClick={() => setFormAlmacen({ nombre: '', ubicacion: '' })}>
            Nuevo almacén
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Lista de Almacenes */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-ink-900 dark:text-ink-100 px-1">Bodegas</h3>
          {loadingAlm ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : (
            almacenes.map(a => (
              <Card
                key={a.id}
                padded={false}
                className={`cursor-pointer transition-all ${selectedAlmacen?.id === a.id ? 'border-brand-500 ring-1 ring-brand-500' : 'hover:border-brand-300'}`}
                onClick={() => setSelectedAlmacen(a)}
              >
                <div className="p-4 flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-ink-900 dark:text-ink-100">{a.nombre}</h4>
                    <p className="text-sm text-ink-500">{a.ubicacion || 'Sin ubicación'}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setFormAlmacen(a) }}>
                      <Edit2 size={13} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setConfirmDelAlm(a) }}>
                      <Trash2 size={13} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Lista de Estantes del Almacén seleccionado */}
        <div className="lg:col-span-2">
          {selectedAlmacen ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">Estantes en {selectedAlmacen.nombre}</h3>
                  <p className="text-sm text-ink-500">Agrega divisiones físicas para organizar los productos.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle Tabla / Visual */}
                  <div className="inline-flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setVistaEstantes('tabla')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${vistaEstantes === 'tabla' ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
                    >
                      <List size={14} /> Tabla
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaEstantes('visual')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${vistaEstantes === 'visual' ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
                    >
                      <Eye size={14} /> Visual
                    </button>
                  </div>
                  <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setFormEstante({ nombre: '', descripcion: '', almacen_id: selectedAlmacen.id, filas: 1, columnas: 1 })}>
                    Añadir estante
                  </Button>
                </div>
              </div>

              {loadingEst ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : estantes.length === 0 ? (
                <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-ink-200 dark:border-ink-800 rounded-xl text-ink-400 text-sm">
                  Este almacén no tiene estantes registrados.
                </div>
              ) : vistaEstantes === 'visual' ? (
                (() => {
                  const selId = estantes.some(e => e.id === estanteVisualSelId) ? estanteVisualSelId : estantes[0]?.id
                  const sel = estantes.find(e => e.id === selId)
                  return (
                    <div className="space-y-3">
                      {/* Selector: elige qué estante ver */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {estantes.map(e => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setEstanteVisualSelId(e.id)}
                            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              e.id === selId
                                ? 'bg-brand-600 text-white border-brand-600'
                                : 'bg-white dark:bg-ink-900 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-brand-300'
                            }`}
                          >
                            <LayoutGrid size={13} />
                            {e.nombre}
                            <span className={`font-mono text-[10px] ${e.id === selId ? 'text-white/70' : 'text-ink-400'}`}>
                              {e.columnas || 1}×{e.filas || 1}
                            </span>
                          </button>
                        ))}
                      </div>

                      {sel && (
                        <EstanteVisualCard
                          key={sel.id}
                          estante={sel}
                          onAcomodar={() => setProductosModalEstante(sel)}
                          onEditar={() => setFormEstante(sel)}
                        />
                      )}
                    </div>
                  )
                })()
              ) : (
                <Table>
                  <THead>
                    <TH>Nombre</TH>
                    <TH>Nota</TH>
                    <TH align="center">Rejilla</TH>
                    <TH align="center">QR</TH>
                    <TH align="right">Acciones</TH>
                  </THead>
                  <TBody>
                    {estantes.map(e => (
                      <TR key={e.id}>
                        <TD className="font-medium">{e.nombre}</TD>
                        <TD>{e.descripcion || <span className="text-ink-400">—</span>}</TD>
                        <TD align="center">
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-ink-500">
                            <LayoutGrid size={12} /> {e.columnas || 1}×{e.filas || 1}
                          </span>
                        </TD>
                        <TD align="center">
                          <Link to={`/inventario/qr/${e.id}`}>
                            <Button variant="ghost" size="sm" leftIcon={<Printer size={15} />}>
                              Imprimir QR
                            </Button>
                          </Link>
                        </TD>
                        <TD align="right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" leftIcon={<LayoutGrid size={13} />} onClick={() => setProductosModalEstante(e)}>
                              Acomodar
                            </Button>
                            <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => setFormEstante(e)}>
                              <Edit2 size={13} />
                            </Button>
                            <Button variant="ghost" size="icon-sm" title="Eliminar" onClick={() => setConfirmDelEst(e)}>
                              <Trash2 size={13} className="text-red-500" />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-ink-200 dark:border-ink-800 rounded-xl text-ink-400">
              Selecciona un almacén para ver sus estantes.
            </div>
          )}
        </div>
      </div>

      {/* Modals Almacen */}
      <Modal open={!!formAlmacen} onClose={() => setFormAlmacen(null)} title={formAlmacen?.id ? "Editar almacén" : "Nuevo almacén"} footer={
        <>
          <Button variant="secondary" onClick={() => setFormAlmacen(null)}>Cancelar</Button>
          <Button type="submit" form="form-alm" loading={saving}>Guardar</Button>
        </>
      }>
        <form id="form-alm" onSubmit={handleSaveAlmacen} className="space-y-4">
          <Input label="Nombre" value={formAlmacen?.nombre || ''} onChange={e => setFormAlmacen({...formAlmacen, nombre: e.target.value})} required />
          <Input label="Ubicación" value={formAlmacen?.ubicacion || ''} onChange={e => setFormAlmacen({...formAlmacen, ubicacion: e.target.value})} />
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelAlm} onClose={() => setConfirmDelAlm(null)} onConfirm={handleDeleteAlmacen} title="Eliminar Almacén" description="Esta acción desactivará el almacén." confirmLabel="Eliminar" tone="danger" />

      {/* Modals Estante */}
      <Modal open={!!formEstante} onClose={() => setFormEstante(null)} title={formEstante?.id ? "Editar estante" : "Nuevo estante"} footer={
        <>
          <Button variant="secondary" onClick={() => setFormEstante(null)}>Cancelar</Button>
          {!formEstante?.id && (
            <Button
              variant="secondary"
              loading={saving}
              leftIcon={<QrCode size={14} />}
              onClick={(e) => handleSaveEstante(e, { openQR: true })}
            >
              Guardar y abrir QR
            </Button>
          )}
          <Button type="submit" form="form-est" loading={saving}>Guardar</Button>
        </>
      }>
        <form id="form-est" onSubmit={(e) => handleSaveEstante(e)} className="space-y-4">
          <Input label="Nombre (ej. Rack 1, Pasillo A)" value={formEstante?.nombre || ''} onChange={e => setFormEstante({...formEstante, nombre: e.target.value})} required />
          <Input
            label="Nota / descripción (opcional)"
            hint="Texto libre para identificar el rack (ej. “Pasillo A, herrajes”). Al escanear el QR se muestran los productos colocados en este rack, no una categoría."
            value={formEstante?.descripcion || ''}
            onChange={e => setFormEstante({ ...formEstante, descripcion: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Columnas"
              type="number" min={1} max={50}
              hint="Ancho de la rejilla"
              value={formEstante?.columnas ?? 1}
              onChange={e => setFormEstante({ ...formEstante, columnas: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            />
            <Input
              label="Filas"
              type="number" min={1} max={50}
              hint="Alto de la rejilla"
              value={formEstante?.filas ?? 1}
              onChange={e => setFormEstante({ ...formEstante, filas: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
            />
          </div>
          {formEstante?.id && (
            <Select label="Mover a otro almacén" value={formEstante?.almacen_id || ''} onChange={e => setFormEstante({...formEstante, almacen_id: Number(e.target.value)})}>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelEst} onClose={() => setConfirmDelEst(null)} onConfirm={handleDeleteEstante} title="Eliminar Estante" description="Se desactivará el estante." confirmLabel="Eliminar" tone="danger" />

      {/* Modal: acomodar productos en la rejilla del estante (Pausa 11) */}
      <LayoutEstanteModal
        estante={productosModalEstante}
        categorias={categorias}
        onClose={() => setProductosModalEstante(null)}
      />

    </div>
  )
}

/* ─── Tarjeta de solo lectura: ver el estante como rack (Pausa 11) ─────────── */
function EstanteVisualCard({ estante, onAcomodar, onEditar }) {
  const [layout, setLayout] = useState(null)
  const [loading, setLoading] = useState(true)
  const { on } = useSocket()

  const cargar = () => {
    setLoading(true)
    getEstanteLayout(estante.id)
      .then(setLayout)
      .catch(() => setLayout(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [estante.id])

  // Refresca este rack cuando cambia su layout (otro usuario acomodando).
  useEffect(() => {
    const off = on('estante:changed', (payload) => {
      if (payload?.id == null || Number(payload.id) === estante.id) cargar()
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, estante.id])

  const celdas = layout?.celdas || []
  const placements = celdas
  const sinUbicar = celdas.filter(c => c.fila == null || c.columna == null)
  const sobranteIds = Object.keys(layout?.sobrante_por_producto || {}).map(Number)
  const totalProductos = celdas.length
  const totalUnidades = celdas.reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0)

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="p-3 border-b border-ink-200 dark:border-ink-800 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-ink-900 dark:text-ink-100 truncate">{estante.nombre}</h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-400 flex-shrink-0">
              <LayoutGrid size={11} /> {estante.columnas || 1}×{estante.filas || 1}
            </span>
          </div>
          <p className="text-xs text-ink-500 truncate">{estante.descripcion || '—'}</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="sm" leftIcon={<LayoutGrid size={13} />} onClick={onAcomodar}>Acomodar</Button>
          <Link to={`/inventario/qr/${estante.id}`} title="Imprimir QR">
            <Button variant="ghost" size="icon-sm"><Printer size={14} /></Button>
          </Link>
          <Button variant="ghost" size="icon-sm" title="Editar" onClick={onEditar}><Edit2 size={13} /></Button>
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <>
            <EstanteGrid
              fit
              filas={layout?.estante?.filas || estante.filas || 1}
              columnas={layout?.estante?.columnas || estante.columnas || 1}
              placements={placements}
              sobranteProductoIds={sobranteIds}
            />
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-ink-500">
              <span>{totalProductos} producto(s)</span>
              {totalUnidades > 0 && <span>· {totalUnidades % 1 === 0 ? totalUnidades : totalUnidades.toFixed(2)} unidades colocadas</span>}
              {sinUbicar.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">· {sinUbicar.length} sin ubicar</span>
              )}
              {sobranteIds.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={12} /> {sobranteIds.length} necesita(n) reacomodo
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

/* ─── Modal: acomodar productos en la rejilla del estante (Pausa 11) ────────── */
function LayoutEstanteModal({ estante, categorias, onClose }) {
  const open = !!estante
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filas, setFilas] = useState(1)
  const [columnas, setColumnas] = useState(1)
  // placements: [{ producto_id, producto:{codigo,descripcion}, fila, columna, cantidad }]
  const [placements, setPlacements] = useState([])
  const [stockAlmacen, setStockAlmacen] = useState({})   // pid -> stock total en la bodega
  const [sobrante, setSobrante] = useState({})           // pid -> exceso colocado
  const [selectedCell, setSelectedCell] = useState(null) // { fila, columna }

  // catálogo
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [qDeb, setQDeb] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])
  // Catálogo paginado por páginas: el paginador navega el resto (nada inalcanzable).
  const { opciones: resultados, loading: buscando, page, setPage, total, totalPages, size } = useProductoSearch({
    q: qDeb, categoria: cat, enabled: open, pageSize: 50,
  })

  // Carga el layout al abrir.
  useEffect(() => {
    if (!estante) return
    setSelectedCell(null); setQ(''); setCat('')
    setLoading(true)
    getEstanteLayout(estante.id)
      .then((data) => {
        setFilas(data.estante?.filas || 1)
        setColumnas(data.estante?.columnas || 1)
        setPlacements((data.celdas || []).map((c) => ({
          producto_id: c.producto_id,
          producto: c.producto || { id: c.producto_id, codigo: `#${c.producto_id}`, descripcion: '' },
          fila: c.fila,
          columna: c.columna,
          cantidad: Number(c.cantidad) || 0,
        })))
        const sa = {}; Object.entries(data.stock_almacen || {}).forEach(([k, v]) => { sa[Number(k)] = Number(v) })
        setStockAlmacen(sa)
        const sb = {}; Object.entries(data.sobrante_por_producto || {}).forEach(([k, v]) => { sb[Number(k)] = Number(v) })
        setSobrante(sb)
      })
      .catch((err) => { toast.error(extractApiError(err, 'Error al cargar el estante')); onClose() })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estante])

  const placedIds = useMemo(() => new Set(placements.map((p) => p.producto_id)), [placements])
  const enCeldaSeleccionada = useMemo(() => {
    if (!selectedCell) return []
    return placements.filter((p) => p.fila === selectedCell.fila && p.columna === selectedCell.columna)
  }, [placements, selectedCell])
  const sinUbicar = useMemo(() => placements.filter((p) => p.fila == null || p.columna == null), [placements])
  const sobranteIds = useMemo(() => Object.keys(sobrante).map(Number), [sobrante])

  // Un producto ocupa a lo más una celda por estante: agregar lo "mueve".
  const upsertPlacement = (prod, fila, columna) => {
    setPlacements((prev) => {
      const existe = prev.find((p) => p.producto_id === prod.id)
      if (existe) {
        return prev.map((p) => p.producto_id === prod.id
          ? { ...p, fila, columna, cantidad: p.cantidad > 0 ? p.cantidad : 1 }
          : p)
      }
      return [...prev, {
        producto_id: prod.id,
        producto: { id: prod.id, codigo: prod.codigo, descripcion: prod.descripcion },
        fila, columna, cantidad: 1,
      }]
    })
  }
  // Click en el catálogo: a la celda seleccionada, o a "sin ubicar" si no hay.
  const agregarDesdeCatalogo = (prod) => {
    if (selectedCell) upsertPlacement(prod, selectedCell.fila, selectedCell.columna)
    else upsertPlacement(prod, null, null)
  }
  const setQty = (pid, value) => {
    const n = Math.max(0, Number(value) || 0)
    setPlacements((prev) => prev.map((p) => p.producto_id === pid ? { ...p, cantidad: n } : p))
  }
  const moveToTray = (pid) => setPlacements((prev) => prev.map((p) => p.producto_id === pid ? { ...p, fila: null, columna: null } : p))
  const removePlacement = (pid) => setPlacements((prev) => prev.filter((p) => p.producto_id !== pid))

  const guardar = async () => {
    if (!estante) return
    setSaving(true)
    try {
      const posiciones = placements.map((p) => ({
        producto_id: p.producto_id,
        fila: p.fila ?? null,
        columna: p.columna ?? null,
        cantidad: Number(p.cantidad) || 0,
      }))
      await saveEstanteLayout(estante.id, posiciones)
      toast.success(`Acomodo guardado (${posiciones.length} producto(s))`)
      onClose()
    } catch (err) {
      // El backend devuelve { detail, errores: [...] } al exceder el stock.
      const data = err?.response?.data
      if (data?.errores?.length) {
        toast.error(data.detail || 'Colocas más unidades de las que hay en bodega')
        data.errores.slice(0, 4).forEach((e) => toast.error(e, { duration: 6000 }))
      } else {
        toast.error(extractApiError(err, 'Error al guardar'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const renderPlacementRow = (p, { enTray = false } = {}) => {
    const cap = stockAlmacen[p.producto_id]
    const excede = sobrante[p.producto_id] > 0
    return (
      <div key={p.producto_id} className="flex items-center gap-2 px-2.5 py-2 hover:bg-ink-50 dark:hover:bg-ink-800/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate leading-tight">
            {p.producto?.descripcion || p.producto?.codigo}
          </p>
          <p className="text-[11px] font-mono text-ink-400">
            {p.producto?.codigo}
            {cap != null && <span className="ml-1 text-ink-400">· bodega: {cap}</span>}
          </p>
        </div>
        {excede && <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" title="Colocas más de lo que hay en bodega" />}
        <input
          type="number" min={0} step="0.01"
          value={p.cantidad}
          onChange={(e) => setQty(p.producto_id, e.target.value)}
          className="w-20 px-2 py-1 rounded border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-right text-sm"
          title="Cantidad en esta celda"
        />
        {!enTray && (
          <Button variant="ghost" size="icon-sm" onClick={() => moveToTray(p.producto_id)} title="Quitar de la celda (dejar sin ubicar)">
            <LayoutGrid size={14} className="text-ink-400" />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={() => removePlacement(p.producto_id)} title="Quitar del estante">
          <X size={14} className="text-red-500" />
        </Button>
      </div>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Acomodar: ${estante.nombre}`}
      description="Selecciona una celda y agrega ahí los productos con su cantidad. Lo que dejes en “Sin ubicar” queda asignado al estante pero sin posición en la rejilla."
      size="xl"
      footer={
        <>
          <span className="text-xs text-ink-500 mr-auto">{placements.length} producto(s) · {columnas}×{filas}</span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar acomodo</Button>
        </>
      }
    >
      {loading ? (
        <Skeleton className="h-[60vh] w-full rounded-lg" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Izquierda: rejilla visual + bandeja sin ubicar */}
          <div className="flex flex-col min-h-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">
              Vista del estante — click en una celda
            </div>
            <div className="border border-ink-200 dark:border-ink-800 rounded-lg p-3 bg-ink-50/40 dark:bg-ink-950/30 overflow-auto max-h-[52vh]">
              <EstanteGrid
                filas={filas}
                columnas={columnas}
                placements={placements}
                selectedCell={selectedCell}
                onCellClick={(fila, columna) => setSelectedCell({ fila, columna })}
                sobranteProductoIds={sobranteIds}
              />
            </div>
            {sinUbicar.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                  Sin ubicar ({sinUbicar.length})
                </div>
                <div className="border border-dashed border-amber-300 dark:border-amber-800 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 max-h-[20vh] overflow-y-auto">
                  {sinUbicar.map((p) => renderPlacementRow(p, { enTray: true }))}
                </div>
              </div>
            )}
          </div>

          {/* Derecha: celda seleccionada + catálogo */}
          <div className="flex flex-col min-h-0">
            {selectedCell ? (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    Celda C{selectedCell.columna} · F{selectedCell.fila}
                  </span>
                  <button className="text-[11px] text-ink-400 hover:text-ink-600" onClick={() => setSelectedCell(null)}>
                    deseleccionar
                  </button>
                </div>
                {enCeldaSeleccionada.length === 0 ? (
                  <div className="text-xs text-ink-400 border border-dashed border-ink-300 dark:border-ink-700 rounded-lg px-3 py-4 text-center">
                    Celda vacía. Agrega productos desde el catálogo de abajo.
                  </div>
                ) : (
                  <div className="border border-ink-200 dark:border-ink-800 rounded-lg divide-y divide-ink-100 dark:divide-ink-800">
                    {enCeldaSeleccionada.map((p) => renderPlacementRow(p))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 text-xs text-ink-500 border border-ink-200 dark:border-ink-800 rounded-lg px-3 py-2 bg-ink-50 dark:bg-ink-900">
                Selecciona una celda a la izquierda para colocar productos ahí. Sin celda seleccionada, lo que agregues entra en <strong>“Sin ubicar”</strong>.
              </div>
            )}

            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-2">Catálogo</div>
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
            <div className="border border-ink-200 dark:border-ink-800 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 h-[34vh] overflow-y-auto">
              {buscando ? (
                <div className="px-3 py-3 text-xs text-ink-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Buscando…</div>
              ) : resultados.length === 0 ? (
                <div className="px-3 py-6 text-xs text-ink-400 text-center">Sin resultados</div>
              ) : (
                resultados.map((p) => {
                  const ya = placedIds.has(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => agregarDesdeCatalogo(p)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-900 dark:text-ink-100 truncate leading-tight">{p.descripcion}</p>
                        <p className="text-[11px] font-mono text-ink-400">{p.codigo}</p>
                      </div>
                      <span className="text-[10px] text-ink-400 tabular-nums flex-shrink-0">{p.stock_actual} {p.unidad}</span>
                      {ya ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0"><Check size={13} /> Colocado</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex-shrink-0"><Plus size={13} /> {selectedCell ? 'A la celda' : 'Sin ubicar'}</span>
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
        </div>
      )}
    </Modal>
  )
}
