import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Input, Select } from '../../components/ui'
import { agregarDescuento } from '../../api/ajustes'

export default function AgregarDescuentoModal({ open, onClose, periodoId, periodoNombre, fechaMin, fechaMax, trabajadores, onAgregado }) {
  const [trabajadorId, setTrabajadorId] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTrabajadorId('')
    setMonto('')
    setFecha('')
    setNotas('')
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!trabajadorId) return toast.error('Selecciona un trabajador')
    const m = Number(monto)
    if (!m || m <= 0) return toast.error('Monto debe ser > 0')
    if (!fecha) return toast.error('Fecha requerida')

    setSaving(true)
    try {
      await agregarDescuento(periodoId, {
        trabajador_id: Number(trabajadorId),
        monto: m,
        fecha_descuento: fecha,
        notas: notas.trim() || null,
      })
      toast.success('Descuento agregado')
      onAgregado?.()
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al agregar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Agregar descuento"
      description={periodoNombre}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>Agregar</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label="Trabajador"
          required
          value={trabajadorId}
          onChange={(e) => setTrabajadorId(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {trabajadores.map((t) => (
            <option key={t.trabajador_id} value={t.trabajador_id}>{t.no_empleado} — {t.nombre_completo}</option>
          ))}
        </Select>
        <Input label="Monto" type="number" step="0.01" min="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} />
        <Input
          label="Fecha del descuento"
          type="date"
          required
          min={fechaMin}
          max={fechaMax}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          hint={`Debe estar entre ${fechaMin} y ${fechaMax}`}
        />
        <Input label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </form>
    </Modal>
  )
}
