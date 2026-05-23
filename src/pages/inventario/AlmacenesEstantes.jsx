import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Boxes, Plus, Edit2, Trash2, QrCode, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Button, Card, PageHeader, Modal, ConfirmDialog,
  Input, Skeleton, Table, THead, TH, TBody, TR, TD, Select
} from '../../components/ui'
import { 
  getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen,
  getEstantesPorAlmacen, createEstante, updateEstante, deleteEstante 
} from '../../api/inventario'
import { extractApiError } from '../../utils/apiError'

export default function AlmacenesEstantes() {
  const [almacenes, setAlmacenes] = useState([])
  const [estantes, setEstantes] = useState([])
  const [selectedAlmacen, setSelectedAlmacen] = useState(null)
  
  const [loadingAlm, setLoadingAlm] = useState(true)
  const [loadingEst, setLoadingEst] = useState(false)

  // Modals state
  const [formAlmacen, setFormAlmacen] = useState(null)
  const [formEstante, setFormEstante] = useState(null)
  
  const [confirmDelAlm, setConfirmDelAlm] = useState(null)
  const [confirmDelEst, setConfirmDelEst] = useState(null)
  
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

  useEffect(() => { loadAlmacenes() }, [])

  useEffect(() => {
    if (selectedAlmacen) {
      loadEstantes(selectedAlmacen.id)
    } else {
      setEstantes([])
    }
  }, [selectedAlmacen])

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
          <Input label="Descripción (opcional)" value={formEstante?.descripcion || ''} onChange={e => setFormEstante({...formEstante, descripcion: e.target.value})} />
          {formEstante?.id && (
            <Select label="Mover a otro almacén" value={formEstante?.almacen_id || ''} onChange={e => setFormEstante({...formEstante, almacen_id: e.target.value})}>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </Select>
          )}
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelEst} onClose={() => setConfirmDelEst(null)} onConfirm={handleDeleteEstante} title="Eliminar Estante" description="Se desactivará el estante." confirmLabel="Eliminar" tone="danger" />

    </div>
  )
}
