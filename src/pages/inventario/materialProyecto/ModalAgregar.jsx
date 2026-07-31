import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { PackagePlus, Trash2, Truck, Warehouse } from 'lucide-react'
import {
  Modal, Button, Select, Input, InfoTip, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import ProductoPicker from '../../../components/ProductoPicker'
import { previsualizarAsignacion, aplicarAsignacion } from '../../../api/inventario'
import { extractApiError } from '../../../utils/apiError'
import { EstadoLinea, ResumenLote, num, lineasAplicables } from './shared'

let SEQ = 0

/**
 * Agregar material al proyecto — el sustituto del formulario de movimiento.
 *
 * El proyecto ya no se pregunta: es el contexto de la pantalla. Lo que sí se
 * pregunta primero es DE DÓNDE SALE el material, porque decide si esto es una
 * reasignación (mover lo que ya está en bodega) o una entrada (material que
 * acaba de llegar). Confundirlas descuadra el inventario, así que va en
 * lenguaje llano y arriba de todo, no escondido en un selector de «tipo».
 */
export default function ModalAgregar({ open, onClose, proyecto, almacenes, onAplicado }) {
  const [origen, setOrigen] = useState('general')
  const [almacenId, setAlmacenId] = useState('')
  const [lineas, setLineas] = useState([])
  const [preview, setPreview] = useState(null)
  const [calculando, setCalculando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const peticion = useRef(0)

  useEffect(() => {
    if (!open) return
    setOrigen('general')
    setLineas([])
    setPreview(null)
    setAlmacenId(String(almacenes?.[0]?.id ?? ''))
  }, [open, almacenes])

  const conCantidad = useMemo(
    () => lineas.filter((l) => Number(l.cantidad) > 0),
    [lineas],
  )

  // Previsualización en vivo: pedir 40 cuando hay 12 se marca mientras se
  // escribe, no al guardar. El debounce evita una petición por tecla.
  useEffect(() => {
    if (!open || !almacenId || conCantidad.length === 0) {
      setPreview(null)
      setCalculando(false)
      return
    }
    const id = ++peticion.current
    setCalculando(true)
    const t = setTimeout(async () => {
      try {
        const res = await previsualizarAsignacion(proyecto.id, {
          origen,
          lineas: conCantidad.map((l) => ({
            producto_id: l.producto.id,
            cantidad: l.cantidad,
            almacen_id: Number(almacenId),
          })),
        })
        // Respuesta de una petición vieja: llegó tarde y ya no describe lo que
        // está escrito en pantalla. Descartarla evita que el usuario vea
        // números que no corresponden a lo que tiene enfrente.
        if (id === peticion.current) setPreview(res)
      } catch (err) {
        if (id === peticion.current) {
          setPreview(null)
          toast.error(extractApiError(err, 'No se pudo calcular la vista previa'))
        }
      } finally {
        if (id === peticion.current) setCalculando(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [open, proyecto?.id, origen, almacenId, conCantidad])

  const porProducto = useMemo(() => {
    const m = new Map()
    for (const f of preview?.lineas ?? []) m.set(f.producto_id, f)
    return m
  }, [preview])

  const agregar = (p) => {
    setLineas((prev) =>
      prev.some((l) => l.producto.id === p.id)
        ? prev
        : [...prev, { key: ++SEQ, producto: p, cantidad: '' }],
    )
  }
  const quitar = (key) => setLineas((prev) => prev.filter((l) => l.key !== key))
  const cambiar = (key, cantidad) =>
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, cantidad } : l)))

  const aplicables = lineasAplicables(preview?.lineas)

  const aplicar = async () => {
    if (aplicables.length === 0) return
    setGuardando(true)
    try {
      const res = await aplicarAsignacion(proyecto.id, { lineas: aplicables, origen })
      toast.success(
        `${res.aplicadas} material${res.aplicadas === 1 ? '' : 'es'} asignado${res.aplicadas === 1 ? '' : 's'} a ${proyecto.numero_proyecto}`,
      )
      onAplicado?.()
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo asignar el material'))
    } finally {
      setGuardando(false)
    }
  }

  const OpcionOrigen = ({ valor, icon: Icon, titulo, detalle }) => (
    <button
      type="button"
      onClick={() => setOrigen(valor)}
      className={[
        'flex-1 min-w-[220px] text-left rounded-lg border p-3 transition-colors focus-ring',
        origen === valor
          ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-900/20 ring-1 ring-brand-500/30'
          : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className={[
          'grid place-items-center h-4 w-4 rounded-full border-2 shrink-0',
          origen === valor ? 'border-brand-500' : 'border-ink-300 dark:border-ink-600',
        ].join(' ')}>
          {origen === valor && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
        </span>
        <Icon size={14} className="text-ink-500 shrink-0" />
        <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{titulo}</span>
      </div>
      <p className="text-xs text-ink-500 mt-1 pl-6">{detalle}</p>
    </button>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`Agregar material a ${proyecto?.numero_proyecto ?? ''}`}
      description={proyecto?.nombre || 'Elige de dónde sale el material y captura las cantidades.'}
      footer={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {calculando ? (
              <span className="text-xs text-ink-400">Calculando…</span>
            ) : (
              <ResumenLote resumen={preview?.resumen} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button
              variant="primary"
              leftIcon={<PackagePlus size={15} />}
              onClick={aplicar}
              disabled={guardando || calculando || aplicables.length === 0}
            >
              {guardando
                ? 'Asignando…'
                : aplicables.length === 0
                  ? 'Asignar'
                  : `Asignar ${aplicables.length} material${aplicables.length === 1 ? '' : 'es'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-2 flex items-center gap-1.5">
            ¿De dónde sale?
            <InfoTip text="No es un detalle técnico: mover material que ya está en bodega y registrar material que acaba de llegar son cosas distintas, y confundirlas descuadra el inventario." />
          </div>
          <div className="flex flex-wrap gap-2">
            <OpcionOrigen
              valor="general"
              icon={Warehouse}
              titulo="Del stock General"
              detalle="Ya está en la bodega, solo cambia de dueño."
            />
            <OpcionOrigen
              valor="entrada"
              icon={Truck}
              titulo="Acaba de llegar"
              detalle="Material nuevo que entra directo para esta obra."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Bodega"
            wrapperClassName="w-full sm:w-56"
            value={almacenId}
            onChange={(e) => setAlmacenId(e.target.value)}
          >
            {(almacenes ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </Select>
          <div className="flex-1 min-w-[240px]">
            <ProductoPicker
              label="Buscar material"
              placeholder="Código o descripción del material…"
              onSelect={agregar}
              excludeIds={lineas.map((l) => l.producto.id)}
            />
          </div>
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-300 dark:border-ink-700 py-10 text-center">
            <p className="text-sm text-ink-500">Busca un material arriba para empezar.</p>
            <p className="text-xs text-ink-400 mt-1">
              Puedes agregar varios y asignarlos todos de una vez.
            </p>
          </div>
        ) : (
          <Table>
            <THead>
              <TH>Material</TH>
              <TH align="right">
                <span className="inline-flex items-center gap-1">
                  {origen === 'general' ? 'En General' : 'Entra'}
                  <InfoTip text={origen === 'general'
                    ? 'Lo que hay disponible sin apartar en esa bodega. Es el tope de lo que puedes asignar.'
                    : 'El material llega de fuera, así que no hay un tope contra el cual capturar.'} />
                </span>
              </TH>
              <TH align="right">Asignar</TH>
              <TH align="right">Queda en el proyecto</TH>
              <TH>Estado</TH>
              <TH align="right"><span className="sr-only">Quitar</span></TH>
            </THead>
            <TBody>
              {lineas.map((l) => {
                const f = porProducto.get(l.producto.id)
                const vacia = !(Number(l.cantidad) > 0)
                return (
                  <TR key={l.key}>
                    <TD>
                      <div className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                        {l.producto.codigo}
                      </div>
                      <div className="text-xs text-ink-500 truncate max-w-[260px]">
                        {l.producto.descripcion}
                      </div>
                    </TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">
                      {origen === 'entrada'
                        ? <span className="text-ink-300">—</span>
                        : f?.disponible != null
                          ? <span className={f.disponible <= 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                              {num(f.disponible)} {l.producto.unidad}
                            </span>
                          : <span className="text-ink-300">·</span>}
                    </TD>
                    <TD align="right">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={l.cantidad}
                        onChange={(e) => cambiar(l.key, e.target.value)}
                        placeholder="0"
                        wrapperClassName="w-28 ml-auto"
                        className="text-right tabular-nums"
                      />
                    </TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">
                      {vacia || !f
                        ? <span className="text-ink-300">—</span>
                        : <span className="font-bold">{num(f.resultado)} {l.producto.unidad}</span>}
                    </TD>
                    <TD>
                      {vacia ? (
                        <span className="text-xs text-ink-400 italic">Sin cantidad</span>
                      ) : !f ? (
                        <span className="text-xs text-ink-400">…</span>
                      ) : (
                        <div className="space-y-1">
                          <EstadoLinea estado={f.estado} />
                          {f.motivo && (
                            <p className={[
                              'text-[11px] max-w-[280px]',
                              f.estado === 'error'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-400',
                            ].join(' ')}>
                              {f.motivo}
                            </p>
                          )}
                        </div>
                      )}
                    </TD>
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Quitar del lote"
                        onClick={() => quitar(l.key)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}

        {preview?.resumen?.errores > 0 && (
          <p className="text-xs text-ink-500">
            <Badge tone="danger" className="mr-1.5">Nota</Badge>
            Las líneas con error se omiten; el resto sí se aplica. No se pierde el trabajo
            de las demás por un problema en una.
          </p>
        )}
      </div>
    </Modal>
  )
}
