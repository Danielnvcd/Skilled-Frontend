import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RotateCcw, Send } from 'lucide-react'
import {
  Modal, Button, Select, Input, Textarea, InfoTip, Badge,
  Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { aplicarAsignacion } from '../../../api/inventario'
import { extractApiError } from '../../../utils/apiError'
import { num } from './shared'

/**
 * Mandar material libre a una obra — el sentido natural del flujo.
 *
 * Es la operación inversa a «Devolver a General», y la que más se hace: llega
 * material, se guarda libre, y luego se reparte entre obras. Antes de esto el
 * único camino era entrar primero al proyecto y buscar de vuelta el material,
 * que es al revés de como la gente lo piensa.
 *
 * No lleva vista previa como el modal de agregar: aquí las cantidades salen de
 * la tabla de existencias y están topadas al disponible en el propio campo, así
 * que no hay nada que simular.
 */
export default function ModalAsignarAProyecto({
  open, onClose, seleccion, almacenes, proyectos, onAplicado,
}) {
  const [destinoId, setDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [guardando, setGuardando] = useState(false)

  const nombreAlmacen = useMemo(() => {
    const m = new Map()
    for (const a of almacenes ?? []) m.set(a.id, a.nombre)
    return m
  }, [almacenes])

  // Una fila por (material, bodega): el material se aparta desde una bodega
  // concreta, y uno repartido en varias no se puede resolver adivinando.
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
    // A diferencia de devolver —donde se propone todo porque el caso típico es
    // cerrar la obra— aquí se arranca en blanco: mandar TODO el material libre
    // de un golpe casi nunca es lo que se quiere, y proponerlo invita a
    // confirmar sin leer.
    setCantidades({})
  }, [open, filas])

  const otros = (proyectos ?? []).filter((p) => !p.es_general)

  const lineas = filas
    .map((f) => ({ ...f, cantidad: Number(cantidades[f.clave]) }))
    .filter((f) => f.cantidad > 0 && f.cantidad <= f.disponible)

  const excedidas = filas.filter((f) => Number(cantidades[f.clave]) > f.disponible).length
  const puedeAplicar = lineas.length > 0 && excedidas === 0 && !!destinoId

  const proyectoElegido = otros.find((p) => String(p.proyecto_id) === String(destinoId))

  const todo = () =>
    setCantidades(Object.fromEntries(filas.map((f) => [f.clave, String(f.disponible)])))

  const aplicar = async () => {
    if (!puedeAplicar) return
    setGuardando(true)
    try {
      const res = await aplicarAsignacion(Number(destinoId), {
        origen: 'general',
        motivo: motivo.trim() || undefined,
        lineas: lineas.map((f) => ({
          producto_id: f.producto_id,
          almacen_id: f.almacen_id,
          cantidad: f.cantidad,
        })),
      })
      toast.success(
        `${res.aplicadas} material${res.aplicadas === 1 ? '' : 'es'} apartado${res.aplicadas === 1 ? '' : 's'} para ${proyectoElegido?.numero_proyecto ?? 'el proyecto'}`,
      )
      if (res.resumen?.errores > 0) {
        toast.error(`${res.resumen.errores} línea(s) se omitieron; revisa las existencias.`)
      }
      onAplicado?.()
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo asignar el material'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Asignar a un proyecto"
      description="El material se aparta para la obra. Sigue en la misma bodega — solo deja de estar libre."
      footer={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-500 tabular-nums">
            {lineas.length} de {filas.length} línea{filas.length === 1 ? '' : 's'} con cantidad
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
              leftIcon={<Send size={15} />}
              onClick={aplicar}
              disabled={!puedeAplicar || guardando}
            >
              {guardando
                ? 'Asignando…'
                : proyectoElegido
                  ? `Asignar a ${proyectoElegido.numero_proyecto}`
                  : 'Asignar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="¿A qué proyecto?"
          wrapperClassName="max-w-md"
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
        >
          <option value="">Elige la obra que recibe el material…</option>
          {otros.map((p) => (
            <option key={p.proyecto_id} value={p.proyecto_id}>
              {`${p.numero_proyecto} — ${p.nombre || ''}`.trim()}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink-600 dark:text-ink-300">
            {seleccion?.length ?? 0} material{seleccion?.length === 1 ? '' : 'es'} seleccionado
            {seleccion?.length === 1 ? '' : 's'} del stock libre
          </span>
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={13} />} onClick={todo}>
            Poner todo lo disponible
          </Button>
        </div>

        {filas.length === 0 ? (
          <p className="text-sm text-ink-500 py-6 text-center">
            Los materiales seleccionados no tienen existencia libre en ninguna bodega activa.
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
              <TH align="right">Libre</TH>
              <TH align="right">Asignar</TH>
            </THead>
            <TBody>
              {filas.map((f) => {
                const excede = Number(cantidades[f.clave]) > f.disponible
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
                          placeholder="0"
                          value={cantidades[f.clave] ?? ''}
                          onChange={(e) =>
                            setCantidades((prev) => ({ ...prev, [f.clave]: e.target.value }))
                          }
                          wrapperClassName="w-28"
                          className="text-right tabular-nums"
                        />
                        {excede && <Badge tone="danger">Máximo {num(f.disponible)}</Badge>}
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
          placeholder="Ej. surtido inicial de obra, material para la etapa 2…"
        />
      </div>
    </Modal>
  )
}
