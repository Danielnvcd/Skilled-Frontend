import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Select, Input } from '../../components/ui'
import { crearRegistro, editarRegistro, eliminarRegistro } from '../../api/horas'

// El kiosko RFID guarda horas EXACTAS (ej. 14:37). Usamos <input type="time">
// en vez de un dropdown HH:00/HH:30 para que esos registros se muestren tal
// como llegaron y se puedan editar al minuto desde aquí también.

const EMPTY = {
  hora_entrada: '',
  hora_salida: '',
  tomo_comida: false,
  incidencia: '',
}

export default function RegistroModal({
  open,
  onClose,
  reporteId,
  trabajador,    // { id, nombre, tipo_nomina, viaticos, pago_dia_festivo }
  fecha,         // 'YYYY-MM-DD'
  fechaLabel,    // string visible
  existing,      // registro existente o null
  incidencias,
  editable,
  onSaved,
  onDeleted,
}) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setForm({
        hora_entrada: existing.hora_entrada || '',
        hora_salida: existing.hora_salida || '',
        tomo_comida: Boolean(existing.tomo_comida),
        incidencia: existing.incidencia || '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, existing])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editable) return
    // Viáticos y día festivo se ocultaron del UI. Preservamos lo que ya tenía
    // el registro existente para no perder data histórica; los registros
    // nuevos quedan en false.
    const payload = {
      trabajador_id: trabajador.id,
      fecha,
      hora_entrada: form.hora_entrada,
      hora_salida: form.hora_salida,
      tomo_comida: form.tomo_comida,
      aplica_viaticos: Boolean(existing?.aplica_viaticos),
      viaticos_modo: existing?.viaticos_modo || 'perfil',
      monto_viaticos_manual: existing?.monto_viaticos_manual ?? null,
      aplica_dia_festivo: Boolean(existing?.aplica_dia_festivo),
      incidencia: form.incidencia || null,
    }
    setSaving(true)
    try {
      const res = existing
        ? await editarRegistro(existing.id, payload)
        : await crearRegistro(reporteId, payload)
      toast.success(existing ? 'Registro actualizado' : 'Registro guardado')
      onSaved?.(res)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing || !editable) return
    if (!window.confirm('¿Eliminar este registro?')) return
    setDeleting(true)
    try {
      await eliminarRegistro(existing.id)
      toast.success('Registro eliminado')
      onDeleted?.(existing.id)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving || deleting ? undefined : onClose}
      title={existing ? 'Editar registro' : 'Nuevo registro'}
      description={`${trabajador?.nombre || ''} — ${fechaLabel}`}
      size="lg"
      footer={
        editable ? (
          <>
            {existing && (
              <Button variant="danger-ghost" onClick={handleDelete} loading={deleting} disabled={saving} leftIcon={<Trash2 size={14} />}>
                Eliminar
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose} disabled={saving || deleting}>Cancelar</Button>
            <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={deleting}>
              {existing ? 'Guardar cambios' : 'Guardar registro'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editable && (
          <p className="text-xs text-ink-500 dark:text-ink-400 bg-ink-50 dark:bg-ink-800/60 border border-ink-200 dark:border-ink-700 rounded-md p-2">
            Este reporte está cerrado. Vista de solo lectura.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Hora entrada"
            type="time"
            step={60}
            value={form.hora_entrada}
            onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
            disabled={!editable}
          />
          <Input
            label="Hora salida"
            type="time"
            step={60}
            value={form.hora_salida}
            onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
            disabled={!editable}
          />
        </div>

        <Select
          label="Incidencia"
          hint="Si registras una incidencia puedes dejar las horas vacías."
          value={form.incidencia}
          onChange={(e) => setForm({ ...form, incidencia: e.target.value })}
          disabled={!editable}
        >
          <option value="">— Ninguna —</option>
          {incidencias.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>

        <div className="pt-2 border-t border-ink-200 dark:border-ink-700">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tomo_comida}
              onChange={(e) => setForm({ ...form, tomo_comida: e.target.checked })}
              disabled={!editable}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-ink-800 dark:text-ink-100">Tomó comida</span>
          </label>
        </div>

      </form>
    </Modal>
  )
}
