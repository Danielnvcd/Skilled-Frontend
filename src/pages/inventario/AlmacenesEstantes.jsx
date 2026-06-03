import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, Plus, Edit2, Trash2, QrCode, Printer, Package, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Table, THead, TH, TBody, TR, TD, Select
} from '../../components/ui'
import {
  getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen,
  getEstantesPorAlmacen, createEstante, updateEstante, deleteEstante,
  getCategorias, getProductos, getProductosDeEstante, setProductosDeEstante,
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
  const [productosModalEstante, setProductosModalEstante] = useState(null)
  const [productosAll, setProductosAll] = useState([])
  const [productosAsignados, setProductosAsignados] = useState(new Set())
  const [productosLoading, setProductosLoading] = useState(false)
  const [productosSearch, setProductosSearch] = useState('')

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
        await updateAlmacen(formAlmacen.id, formAlmacen)
        toast.success('Almacén actualizado')
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

  // --- Handlers Productos del Estante (Pausa 4) ---
  const openProductosModal = async (estante) => {
    setProductosModalEstante(estante)
    setProductosSearch('')
    setProductosLoading(true)
    try {
      const [all, asignados] = await Promise.all([
        productosAll.length ? Promise.resolve(productosAll) : getProductos({ limit: 1000 }),
        getProductosDeEstante(estante.id),
      ])
      setProductosAll(all)
      setProductosAsignados(new Set(asignados.map(p => p.id)))
    } catch (err) {
      toast.error(extractApiError(err, 'Error al cargar productos'))
      setProductosModalEstante(null)
    } finally {
      setProductosLoading(false)
    }
  }

  const toggleProductoAsignado = (id) => {
    setProductosAsignados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const guardarProductosEstante = async () => {
    if (!productosModalEstante) return
    setSaving(true)
    try {
      await setProductosDeEstante(productosModalEstante.id, Array.from(productosAsignados))
      toast.success(`${productosAsignados.size} producto(s) asignado(s) a ${productosModalEstante.nombre}`)
      setProductosModalEstante(null)
    } catch (err) {
      toast.error(extractApiError(err, 'Error al guardar'))
    } finally {
      setSaving(false)
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
            <Card>
              <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-ink-100">Estantes en {selectedAlmacen.nombre}</h3>
                  <p className="text-sm text-ink-500">Agrega divisiones físicas para organizar los productos.</p>
                </div>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setFormEstante({ nombre: '', descripcion: '', almacen_id: selectedAlmacen.id })}>
                  Añadir estante
                </Button>
              </div>
              
              {loadingEst ? (
                <div className="p-6"><Skeleton className="h-10 w-full" /></div>
              ) : estantes.length === 0 ? (
                <div className="p-10 text-center text-ink-500">Este almacén no tiene estantes registrados.</div>
              ) : (
                <Table>
                  <THead>
                    <TH>Nombre</TH>
                    <TH>Descripción</TH>
                    <TH align="center">QR</TH>
                    <TH align="right">Acciones</TH>
                  </THead>
                  <TBody>
                    {estantes.map(e => (
                      <TR key={e.id}>
                        <TD className="font-medium">{e.nombre}</TD>
                        <TD>{e.descripcion}</TD>
                        <TD align="center">
                          <Link to={`/inventario/qr/${e.id}`}>
                            <Button variant="ghost" size="sm">
                              <Printer size={15} /> Imprimir QR
                            </Button>
                          </Link>
                        </TD>
                        <TD align="right">
                          <Button variant="ghost" size="sm" leftIcon={<Package size={13} />} onClick={() => openProductosModal(e)}>
                            Productos
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setFormEstante(e)}>
                            <Edit2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelEst(e)}>
                            <Trash2 size={13} className="text-red-500" />
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
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
            label="Categoría local"
            placeholder="Ej. Tornillería (déjalo vacío para mostrar todo el catálogo)"
            list="categorias-estante-list"
            value={formEstante?.descripcion || ''}
            onChange={e => setFormEstante({ ...formEstante, descripcion: e.target.value })}
          />
          <datalist id="categorias-estante-list">
            {categorias.map(c => <option key={c} value={c} />)}
          </datalist>
          {formEstante?.id && (
            <Select label="Mover a otro almacén" value={formEstante?.almacen_id || ''} onChange={e => setFormEstante({...formEstante, almacen_id: e.target.value})}>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelEst} onClose={() => setConfirmDelEst(null)} onConfirm={handleDeleteEstante} title="Eliminar Estante" description="Se desactivará el estante." confirmLabel="Eliminar" tone="danger" />

      {/* Modal: asignar productos al estante (Pausa 4) */}
      <Modal
        open={!!productosModalEstante}
        onClose={() => setProductosModalEstante(null)}
        title={productosModalEstante ? `Productos en ${productosModalEstante.nombre}` : ''}
        size="lg"
        footer={
          <>
            <span className="text-xs text-ink-500 mr-auto">
              {productosAsignados.size} seleccionado(s)
            </span>
            <Button variant="secondary" onClick={() => setProductosModalEstante(null)}>Cancelar</Button>
            <Button onClick={guardarProductosEstante} loading={saving}>Guardar</Button>
          </>
        }
      >
        <p className="text-xs text-ink-500 mb-3">
          Marca los productos que se guardan en este estante. Al escanear el QR
          desde el móvil verás aquí su lista.
        </p>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            type="text"
            value={productosSearch}
            onChange={e => setProductosSearch(e.target.value)}
            placeholder="Buscar por código o descripción…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {productosLoading ? (
          <Skeleton className="h-60 w-full rounded-md" />
        ) : (
          <div className="max-h-[55vh] overflow-y-auto border border-ink-200 dark:border-ink-800 rounded-md divide-y divide-ink-100 dark:divide-ink-800">
            {(() => {
              const q = productosSearch.trim().toLowerCase()
              const visible = productosAll.filter(p => {
                if (!q) return true
                return (p.codigo || '').toLowerCase().includes(q)
                    || (p.descripcion || '').toLowerCase().includes(q)
              })
              if (visible.length === 0) {
                return <p className="p-4 text-sm italic text-ink-500 text-center">Sin resultados.</p>
              }
              return visible.map(p => {
                const checked = productosAsignados.has(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProductoAsignado(p.id)}
                      className="rounded border-ink-300 dark:border-ink-700 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-ink-500">{p.codigo}</p>
                      <p className="text-sm text-ink-900 dark:text-ink-100 truncate">{p.descripcion}</p>
                    </div>
                    <span className="text-xs text-ink-400">{p.categoria}</span>
                  </label>
                )
              })
            })()}
          </div>
        )}
      </Modal>

    </div>
  )
}
