import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2, AlertCircle } from 'lucide-react'
import { Modal, Button, Select, Input } from '../../components/ui'
import { crearRegistro, editarRegistro, eliminarRegistro } from '../../api/horas'

function buildHorasDropdown() {
  const out = []
  for (let h = 0; h < 24; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
    out.push(`${String(h).padStart(2, '0')}:30`)
  }
  return out
}

const EMPTY = {
  hora_entrada: '',
  hora_salida: '',
  tomo_comida: false,
  aplica_viaticos: false,
  viaticos_modo: 'perfil',
  monto_viaticos_manual: '',
  aplica_dia_festivo: false,
  incidencia: '',
  horas_productivas_override: '',
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
  const horas = useMemo(buildHorasDropdown, [])
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
        aplica_viaticos: Boolean(existing.aplica_viaticos),
        viaticos_modo: existing.viaticos_modo || 'perfil',
        monto_viaticos_manual: existing.monto_viaticos_manual != null ? String(existing.monto_viaticos_manual) : '',
        aplica_dia_festivo: Boolean(existing.aplica_dia_festivo),
        incidencia: existing.incidencia || '',
        horas_productivas_override: '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, existing])

  const noTieneViaticosPerfil = !trabajador?.viaticos || trabajador.viaticos <= 0
  const noTieneFestivoPerfil = !trabajador?.pago_dia_festivo || trabajador.pago_dia_festivo <= 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editable) return
    const payload = {
      trabajador_id: trabajador.id,
      fecha,
      hora_entrada: form.hora_entrada,
      hora_salida: form.hora_salida,
      tomo_comida: form.tomo_comida,
      aplica_viaticos: form.aplica_viaticos,
      viaticos_modo: form.viaticos_modo,
      monto_viaticos_manual: form.aplica_viaticos && form.viaticos_modo === 'manual' ? form.monto_viaticos_manual : null,
      aplica_dia_festivo: form.aplica_dia_festivo,
      incidencia: form.incidencia || null,
      horas_productivas_override: form.horas_productivas_override || null,
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
          <Select
            label="Hora entrada"
            value={form.hora_entrada}
            onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
            disabled={!editable}
          >
            <option value="">—</option>
            {horas.map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
          <Select
            label="Hora salida"
            value={form.hora_salida}
            onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
            disabled={!editable}
          >
            <option value="">—</option>
            {horas.map((h) => <option key={h} value={h}>{h}</option>)}
          </Select>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-ink-200 dark:border-ink-700">
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

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.aplica_dia_festivo}
              onChange={(e) => setForm({ ...form, aplica_dia_festivo: e.target.checked })}
              disabled={!editable || noTieneFestivoPerfil}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-ink-800 dark:text-ink-100">
              Aplicar día festivo
              {noTieneFestivoPerfil && (
                <span className="block text-[11px] text-red-600 dark:text-red-400 inline-flex items-center gap-0.5 mt-0.5">
                  <AlertCircle size={11} /> Perfil sin monto de día festivo
                </span>
              )}
            </span>
          </label>
        </div>

        <div className="pt-2 border-t border-ink-200 dark:border-ink-700">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.aplica_viaticos}
              onChange={(e) => setForm({ ...form, aplica_viaticos: e.target.checked })}
              disabled={!editable}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-ink-800 dark:text-ink-100 font-medium">Aplicar viáticos</span>
          </label>

          {form.aplica_viaticos && (
            <div className="ml-6 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Modo"
                value={form.viaticos_modo}
                onChange={(e) => setForm({ ...form, viaticos_modo: e.target.value })}
                disabled={!editable}
              >
                <option value="perfil" disabled={noTieneViaticosPerfil}>
                  Usar perfil ({trabajador?.viaticos?.toFixed(2) || '0.00'})
                </option>
                <option value="manual">Monto manual</option>
              </Select>
              {form.viaticos_modo === 'manual' && (
                <Input
                  label="Monto manual"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monto_viaticos_manual}
                  onChange={(e) => setForm({ ...form, monto_viaticos_manual: e.target.value })}
                  disabled={!editable}
                />
              )}
              {noTieneViaticosPerfil && form.viaticos_modo === 'perfil' && (
                <p className="col-span-full text-[11px] text-red-600 dark:text-red-400 inline-flex items-center gap-0.5">
                  <AlertCircle size={11} /> Perfil con $0.00 de viáticos. Usa modo manual.
                </p>
              )}
            </div>
          )}
        </div>

        {existing && (
          <div className="pt-2 border-t border-ink-200 dark:border-ink-700">
            <Input
              label="Override horas productivas (opcional)"
              hint={`Calculadas actualmente: ${existing.horas_productivas || 0}. Solo edición.`}
              type="number"
              step="0.01"
              min="0"
              max="24"
              value={form.horas_productivas_override}
              onChange={(e) => setForm({ ...form, horas_productivas_override: e.target.value })}
              disabled={!editable}
              placeholder="Dejar vacío para cálculo automático"
            />
          </div>
        )}
      </form>
    </Modal>
  )
}
