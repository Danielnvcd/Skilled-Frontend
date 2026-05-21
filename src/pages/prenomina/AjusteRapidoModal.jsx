import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Input, Select } from '../../components/ui'
import {
  agregarDescuento, agregarDeposito,
  actualizarViaticos, actualizarFestivos,
} from '../../api/prenomina'

const TIPOS_DESCUENTO = [
  { value: 'INCIDENCIA', label: 'Incidencia' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'PRESTAMO', label: 'Préstamo' },
]

export default function AjusteRapidoModal({ open, onClose, modo, prenomina, onAplicado }) {
  // modo: 'descuento' | 'deposito' | 'viaticos' | 'festivos'
  const [tipo, setTipo] = useState('MANUAL')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fechaInc, setFechaInc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTipo('MANUAL')
    setConcepto('')
    setFechaInc('')
    if (modo === 'viaticos') setMonto(String(prenomina?.pago_viaticos ?? ''))
    else if (modo === 'festivos') setMonto(String(prenomina?.pago_festivos ?? ''))
    else setMonto('')
  }, [open, modo, prenomina])

  const titulos = {
    descuento: 'Agregar descuento',
    deposito: 'Agregar depósito',
    viaticos: 'Actualizar viáticos',
    festivos: 'Actualizar pago festivos',
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!monto) return toast.error('Monto requerido')
    const mNum = Number(monto)
    if (Number.isNaN(mNum) || (modo === 'descuento' || modo === 'deposito' ? mNum <= 0 : mNum < 0)) {
      return toast.error(modo === 'descuento' || modo === 'deposito' ? 'Monto debe ser > 0' : 'Monto no puede ser negativo')
    }

    setSaving(true)
    try {
      let res
      if (modo === 'descuento') {
        if (!concepto.trim()) { toast.error('Concepto requerido'); setSaving(false); return }
        res = await agregarDescuento({
          prenomina_id: prenomina.id,
          tipo,
          concepto: concepto.trim(),
          monto: mNum,
          fecha_incidencia: fechaInc || null,
        })
      } else if (modo === 'deposito') {
        if (!concepto.trim()) { toast.error('Concepto requerido'); setSaving(false); return }
        res = await agregarDeposito({
          prenomina_id: prenomina.id,
          concepto: concepto.trim(),
          monto: mNum,
        })
      } else if (modo === 'viaticos') {
        res = await actualizarViaticos(prenomina.id, mNum)
      } else if (modo === 'festivos') {
        res = await actualizarFestivos(prenomina.id, mNum)
      }
      toast.success('Cambios aplicados')
      onAplicado?.(res)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aplicar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={titulos[modo] || 'Ajuste'}
      description={prenomina?.trabajador?.nombre_completo}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {modo === 'viaticos' || modo === 'festivos' ? 'Actualizar' : 'Agregar'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {modo === 'descuento' && (
          <>
            <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_DESCUENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input
              label="Concepto"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Falta del lunes"
            />
            <Input
              label="Fecha incidencia (opcional)"
              type="date"
              value={fechaInc}
              onChange={(e) => setFechaInc(e.target.value)}
            />
          </>
        )}
        {modo === 'deposito' && (
          <Input
            label="Concepto"
            required
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Reembolso herramienta"
          />
        )}
        <Input
          label="Monto"
          type="number"
          step="0.01"
          min={modo === 'descuento' || modo === 'deposito' ? '0.01' : '0'}
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </form>
    </Modal>
  )
}
