import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Input, Select } from '../../components/ui'
import {
  obtenerTrabajadoresDisponibles, crearPrestamo, editarPrestamo,
} from '../../api/prestamos'

const EMPTY = {
  trabajador_id: '',
  monto_total: '',
  plazo_semanas: '',
  descuento_semanal: '',
  motivo: '',
  frecuencia: 'semanal',
  fecha_inicio: '',
}

export default function PrestamoFormModal({ open, onClose, prestamo, onSaved }) {
  const isEdit = Boolean(prestamo)
  const [form, setForm] = useState(EMPTY)
  const [trabajadores, setTrabajadores] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit) {
      setForm({
        trabajador_id: String(prestamo.trabajador_id),
        monto_total: String(prestamo.monto_total),
        plazo_semanas: String(prestamo.plazo_semanas),
        descuento_semanal: String(prestamo.descuento_semanal),
        motivo: prestamo.motivo || '',
        frecuencia: prestamo.frecuencia || 'semanal',
        fecha_inicio: prestamo.fecha_inicio || '',
      })
    } else {
      setForm(EMPTY)
    }

    if (!isEdit) {
      setLoadingMeta(true)
      obtenerTrabajadoresDisponibles()
        .then(setTrabajadores)
        .catch((err) => toast.error(err.response?.data?.error || 'Error cargando trabajadores'))
        .finally(() => setLoadingMeta(false))
    }
  }, [open, isEdit, prestamo])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isEdit && !form.trabajador_id) return toast.error('Selecciona un trabajador')

    const payload = {
      monto_total: Number(form.monto_total),
      plazo_semanas: Number(form.plazo_semanas),
      descuento_semanal: Number(form.descuento_semanal),
      motivo: form.motivo.trim(),
      frecuencia: form.frecuencia,
      fecha_inicio: form.fecha_inicio || null,
    }
    if (!isEdit) payload.trabajador_id = Number(form.trabajador_id)

    setSaving(true)
    try {
      if (isEdit) {
        await editarPrestamo(prestamo.id, payload)
        toast.success('Préstamo actualizado')
      } else {
        await crearPrestamo(payload)
        toast.success('Préstamo creado')
      }
      onSaved?.()
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isEdit ? 'Editar préstamo' : 'Nuevo préstamo'}
      description={isEdit ? prestamo?.trabajador?.nombre_completo : 'Define monto, plazo y descuento semanal.'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Guardar cambios' : 'Crear préstamo'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {!isEdit && (
          <Select
            label="Trabajador"
            required
            value={form.trabajador_id}
            onChange={(e) => setForm({ ...form, trabajador_id: e.target.value })}
            disabled={loadingMeta}
          >
            <option value="">— Selecciona —</option>
            {trabajadores.map((t) => (
              <option key={t.id} value={t.id}>{t.no_empleado} — {t.nombre_completo}</option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Monto total"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.monto_total}
            onChange={(e) => setForm({ ...form, monto_total: e.target.value })}
          />
          <Input
            label="Plazo (semanas)"
            type="number"
            min="1"
            required
            value={form.plazo_semanas}
            onChange={(e) => setForm({ ...form, plazo_semanas: e.target.value })}
          />
        </div>

        <Input
          label="Descuento semanal"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={form.descuento_semanal}
          onChange={(e) => setForm({ ...form, descuento_semanal: e.target.value })}
        />

        <Select
          label="Frecuencia"
          value={form.frecuencia}
          onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}
        >
          <option value="semanal">Semanal</option>
          <option value="quincenal">Quincenal</option>
          <option value="mensual">Mensual</option>
        </Select>

        <Input
          label="Fecha de inicio (opcional)"
          type="date"
          value={form.fecha_inicio}
          onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
        />

        <Input
          label="Motivo (opcional)"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          placeholder="Ej. Préstamo para útiles"
        />
      </form>
    </Modal>
  )
}
