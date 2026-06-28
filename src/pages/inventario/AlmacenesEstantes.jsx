import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, Plus, Edit2, Trash2, QrCode, Printer, Package, Search, Check, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Table, THead, TH, TBody, TR, TD, Select
} from '../../components/ui'
import {
  getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen,
  getEstantesPorAlmacen, createEstante, updateEstante, deleteEstante,
  getCategorias, getProductosDeEstante, setProductosDeEstante, getProductos,
} from '../../api/inventario'
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

  // Modal de asignar productos a un estante (Pausa 4 — scanner móvil).
  // Toda la lógica vive en <ProductosEstanteModal/> (abajo).
  const [productosModalEstante, setProductosModalEstante] = useState(null)

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
              <div className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">Estantes en {selectedAlmacen.nombre}</h3>
                  <p className="text-sm text-ink-500">Agrega divisiones físicas para organizar los productos.</p>
                </div>
                <Button size="sm" leftIcon={<Plus size={14} />} className="flex-shrink-0" onClick={() => setFormEstante({ nombre: '', descripcion: '', almacen_id: selectedAlmacen.id })}>
                  Añadir estante
                </Button>
              </div>

              {loadingEst ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : estantes.length === 0 ? (
                <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-ink-200 dark:border-ink-800 rounded-xl text-ink-400 text-sm">
                  Este almacén no tiene estantes registrados.
                </div>
              ) : (
                <Table>
                  <THead>
                    <TH>Nombre</TH>
                    <TH>Categoría local</TH>
                    <TH align="center">QR</TH>
                    <TH align="right">Acciones</TH>
                  </THead>
                  <TBody>
                    {estantes.map(e => (
                      <TR key={e.id}>
                        <TD className="font-medium">{e.nombre}</TD>
                        <TD>{e.descripcion || <span className="text-ink-400">Todo el catálogo</span>}</TD>
                        <TD align="center">
                          <Link to={`/inventario/qr/${e.id}`}>
                            <Button variant="ghost" size="sm" leftIcon={<Printer size={15} />}>
                              Imprimir QR
                            </Button>
                          </Link>
                        </TD>
                        <TD align="right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" leftIcon={<Package size={13} />} onClick={() => setProductosModalEstante(e)}>
                              Productos
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
          <Select
            label="Categoría local"
            hint="Filtra qué productos se muestran al escanear el QR. Deja “Todo el catálogo” para no filtrar."
            value={formEstante?.descripcion || ''}
            onChange={e => setFormEstante({ ...formEstante, descripcion: e.target.value })}
          >
            <option value="">Todo el catálogo</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            {/* Conserva un valor previo que ya no esté en el catálogo, para no perderlo al editar */}
            {formEstante?.descripcion && !categorias.includes(formEstante.descripcion) && (
              <option value={formEstante.descripcion}>{formEstante.descripcion}</option>
            )}
          </Select>
          {formEstante?.id && (
            <Select label="Mover a otro almacén" value={formEstante?.almacen_id || ''} onChange={e => setFormEstante({...formEstante, almacen_id: Number(e.target.value)})}>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelEst} onClose={() => setConfirmDelEst(null)} onConfirm={handleDeleteEstante} title="Eliminar Estante" description="Se desactivará el estante." confirmLabel="Eliminar" tone="danger" />

      {/* Modal: asignar productos al estante (Pausa 4) */}
      <ProductosEstanteModal
        estante={productosModalEstante}
        categorias={categorias}
        onClose={() => setProductosModalEstante(null)}
      />

    </div>
  )
}

/* ─── Modal de productos del estante: catálogo (izq) + asignados (der) ──────── */
function ProductosEstanteModal({ estante, categorias, onClose }) {
  const open = !!estante
  const [asignados, setAsignados] = useState([])   // objetos producto completos
  const [loadingAsig, setLoadingAsig] = useState(false)
  const [saving, setSaving] = useState(false)

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  // Carga inicial de asignados al abrir.
  useEffect(() => {
    if (!estante) return
    setQ(''); setCat(''); setResultados([])
    setLoadingAsig(true)
    getProductosDeEstante(estante.id)
      .then(setAsignados)
      .catch((err) => { toast.error(extractApiError(err, 'Error al cargar productos')); onClose() })
      .finally(() => setLoadingAsig(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estante])

  // Búsqueda server-side (debounce) del catálogo, filtrable por categoría.
  useEffect(() => {
    if (!open) return
    let cancel = false
    setBuscando(true)
    const t = setTimeout(() => {
      getProductos({ q: q.trim(), categoria: cat || undefined, limit: 50 })
        .then((res) => { if (!cancel) setResultados(res || []) })
        .catch(() => { if (!cancel) setResultados([]) })
        .finally(() => { if (!cancel) setBuscando(false) })
    }, 250)
    return () => { cancel = true; clearTimeout(t) }
  }, [q, cat, open])

  const asignadosIds = useMemo(() => new Set(asignados.map(p => p.id)), [asignados])

  const agregar = (p) => setAsignados(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])
  const quitar = (id) => setAsignados(prev => prev.filter(p => p.id !== id))

  const guardar = async () => {
    if (!estante) return
    setSaving(true)
    try {
      await setProductosDeEstante(estante.id, asignados.map(p => p.id))
      toast.success(`${asignados.length} producto(s) asignado(s) a ${estante.nombre}`)
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Productos en ${estante.nombre}`}
      description="Agrega desde el catálogo (izquierda) los productos que se guardan aquí. Al escanear el QR verás esta lista."
      size="xl"
      footer={
        <>
          <span className="text-xs text-ink-500 mr-auto">{asignados.length} asignado(s)</span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar</Button>
        </>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        {/* Izquierda: catálogo */}
        <div className="flex flex-col min-h-0">
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
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
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
          </div>
        </div>

        {/* Derecha: asignados */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Asignados a este estante</span>
            <span className="text-[11px] font-semibold text-ink-500">{asignados.length}</span>
          </div>
          {loadingAsig ? (
            <Skeleton className="h-[48vh] w-full rounded-lg" />
          ) : asignados.length === 0 ? (
            <div className="h-[48vh] flex items-center justify-center text-center text-sm text-ink-400 border border-dashed border-ink-300 dark:border-ink-700 rounded-lg px-4">
              Ningún producto asignado todavía.<br />Agrégalos desde el catálogo de la izquierda.
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
                  <Button variant="ghost" size="icon-sm" onClick={() => quitar(p.id)} title="Quitar del estante">
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
