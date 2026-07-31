import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CornerUpLeft, RotateCcw, Send } from 'lucide-react'
import {
  Modal, Button, Select, Input, Textarea, InfoTip, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { devolverMaterialProyecto } from '../../../api/inventario'
import { extractApiError } from '../../../utils/apiError'
import { num } from './shared'

/**
 * Sacar material del proyecto: a General o a otra obra.
 *
 * Es un solo modal con dos destinos porque la operación es la misma —el
 * material no sale del almacén, solo cambia de etiqueta— y separarlos en dos
 * pantallas casi idénticas obligaría a mantener dos veces la misma lógica.
 *
 * Se propone devolver TODO lo seleccionado, que es el caso típico al cerrar una
 * obra, pero cada cantidad es editable para la devolución parcial.
 */
export default function ModalMover({
  open, onClose, proyecto, seleccion, almacenes, proyectos, destino = 'general', onAplicado,
}) {
  const [destinoId, setDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [guardando, setGuardando] = useState(false)

  const aGeneral = destino === 'general'
  const nombreAlmacen = useMemo(() => {
    const m = new Map()
    for (const a of almacenes ?? []) m.set(a.id, a.nombre)
    return m
  }, [almacenes])

  // Una fila por (material, bodega): devolver exige decir de qué bodega sale, y
  // un material puede estar repartido en varias. Agruparlo en una sola fila
  // obligaría a inventar un reparto que el usuario no pidió.
  const filas = useMemo(() => {
    const out = []
    for (const m of seleccion ?? []) {
      for (const [aid, cant] of Object.entries(m.por_almacen ?? {})) {
        if (Number(cant) <= 0) continue
        out.push({
          clave: `${m.producto_id}-${aid}`,
          producto_id: m.producto_id,
          almacen_id: Number(aid),
          almacen_nombre: nombreAlmacen.get(Number(aid)) ?? `Bodega ${aid}`,
          codigo: m.codigo,
          descripcion: m.descripcion,
          unidad: m.unidad,
          disponible: Number(cant),
        })
      }
    }
    return out
  }, [seleccion, nombreAlmacen])

  useEffect(() => {
    if (!open) return
    setDestinoId('')
    setMotivo('')
    setCantidades(Object.fromEntries(filas.map((f) => [f.clave, String(f.disponible)])))
  }, [open, filas])

  const otrosProyectos = (proyectos ?? []).filter(
    (p) => !p.es_general && p.proyecto_id !== proyecto?.id,
  )

  const lineas = filas
    .map((f) => ({ ...f, cantidad: Number(cantidades[f.clave]) }))
    .filter((f) => f.cantidad > 0 && f.cantidad <= f.disponible)

  const excedidas = filas.filter(
    (f) => Number(cantidades[f.clave]) > f.disponible,
  ).length

  const puedeAplicar =
    lineas.length > 0 && excedidas === 0 && (aGeneral || !!destinoId)

  const aplicar = async () => {
    if (!puedeAplicar) return
    setGuardando(true)
    try {
      const res = await devolverMaterialProyecto(proyecto.id, {
        lineas: lineas.map((f) => ({
          producto_id: f.producto_id,
          almacen_id: f.almacen_id,
          cantidad: f.cantidad,
        })),
        destinoProyectoId: aGeneral ? null : Number(destinoId),
        motivo: motivo.trim() || undefined,
      })
      toast.success(
        `${res.aplicadas} material${res.aplicadas === 1 ? '' : 'es'} movido${res.aplicadas === 1 ? '' : 's'} a ${res.destino}`,
      )
      if (res.problemas?.length) {
        toast.error(
          `${res.problemas.length} línea${res.problemas.length === 1 ? '' : 's'} no se pudo mover: ${res.problemas[0].motivo}`,
        )
      }
      onAplicado?.()
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo mover el material'))
    } finally {
      setGuardando(false)
    }
  }

  const todo = () =>
    setCantidades(Object.fromEntries(filas.map((f) => [f.clave, String(f.disponible)])))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={aGeneral ? 'Devolver a General' : 'Mover a otro proyecto'}
      description={
        aGeneral
          ? `El material vuelve al stock libre. Sigue en la misma bodega — solo deja de estar apartado para ${proyecto?.numero_proyecto ?? 'la obra'}.`
          : 'El material cambia de obra sin salir del almacén.'
      }
      footer={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-500 tabular-nums">
            {lineas.length} de {filas.length} línea{filas.length === 1 ? '' : 's'}
            {excedidas > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {' '}· {excedidas} sobre el disponible
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button
              variant="primary"
              leftIcon={aGeneral ? <CornerUpLeft size={15} /> : <Send size={15} />}
              onClick={aplicar}
              disabled={!puedeAplicar || guardando}
            >
              {guardando ? 'Moviendo…' : aGeneral ? 'Devolver a General' : 'Mover al proyecto'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!aGeneral && (
          <Select
            label="Proyecto destino"
            wrapperClassName="max-w-md"
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
          >
            <option value="">Elige el proyecto que lo recibe…</option>
            {otrosProyectos.map((p) => (
              <option key={p.proyecto_id} value={p.proyecto_id}>
                {`${p.numero_proyecto} — ${p.nombre || ''}`.trim()}
              </option>
            ))}
          </Select>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink-600 dark:text-ink-300">
            {seleccion?.length ?? 0} material{seleccion?.length === 1 ? '' : 'es'} seleccionado
            {seleccion?.length === 1 ? '' : 's'} de {proyecto?.numero_proyecto}
          </span>
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={13} />} onClick={todo}>
            Poner todo
          </Button>
        </div>

        {filas.length === 0 ? (
          <p className="text-sm text-ink-500 py-6 text-center">
            Los materiales seleccionados no tienen existencia en ninguna bodega activa.
          </p>
        ) : (
          <Table>
            <THead>
              <TH>Material</TH>
              <TH>
                <span className="inline-flex items-center gap-1">
                  Bodega
                  <InfoTip text="Un material repartido en varias bodegas aparece una vez por cada una: hay que decir de dónde sale." />
                </span>
              </TH>
              <TH align="right">En el proyecto</TH>
              <TH align="right">{aGeneral ? 'Devolver' : 'Mover'}</TH>
            </THead>
            <TBody>
              {filas.map((f) => {
                const v = Number(cantidades[f.clave])
                const excede = v > f.disponible
                return (
                  <TR key={f.clave}>
                    <TD>
                      <div className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                        {f.codigo}
                      </div>
                      <div className="text-xs text-ink-500 truncate max-w-[240px]">{f.descripcion}</div>
                    </TD>
                    <TD className="text-xs text-ink-500">{f.almacen_nombre}</TD>
                    <TD align="right" className="font-mono tabular-nums text-xs">
                      {num(f.disponible)} {f.unidad}
                    </TD>
                    <TD align="right">
                      <div className="flex flex-col items-end gap-1">
                        <Input
                          type="number"
                          min="0"
                          max={f.disponible}
                          step="any"
                          inputMode="decimal"
                          value={cantidades[f.clave] ?? ''}
                          onChange={(e) =>
                            setCantidades((prev) => ({ ...prev, [f.clave]: e.target.value }))
                          }
                          wrapperClassName="w-28"
                          className="text-right tabular-nums"
                        />
                        {excede && (
                          <Badge tone="danger">Máximo {num(f.disponible)}</Badge>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}

        <Textarea
          label="Motivo (opcional)"
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={aGeneral ? 'Ej. cierre de obra, sobrante no utilizado…' : 'Ej. reasignación por prioridad…'}
        />
        <p className="text-xs text-ink-500">
          Queda registrado en el kardex de cada material como una reasignación, con quién
          la hizo y cuándo.
        </p>
      </div>
    </Modal>
  )
}
