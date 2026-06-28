import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Users as UsersIcon, AlertCircle } from 'lucide-react'
import { Modal, Button, Input, Select, ConfirmDialog } from '../../components/ui'
import { obtenerMeta, obtenerProyecto, crearProyecto, actualizarProyecto } from '../../api/proyectos'
import { useResource } from '../../hooks/useResource'

const EMPTY_FORM = {
  numero_proyecto: '',
  nombre: '',
  activo: true,
  coordinador_id: '',
  participantes_ids: [],
}

const snapshot = (form) => JSON.stringify({
  ...form,
  participantes_ids: [...form.participantes_ids].sort((a, b) => a - b),
})

export default function ProyectoFormModal({ open, onClose, proyectoId, onSaved }) {
  const isEdit = Boolean(proyectoId)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterParticipantes, setFilterParticipantes] = useState('')
  const [errors, setErrors] = useState({})
  // Confirmación de "cerrar con cambios sin guardar" con UI propia (sin window.confirm).
  const [confirmClose, setConfirmClose] = useState(false)
  // Estado inicial del form para detectar cambios sin guardar al cerrar.
  const initialRef = useRef(snapshot(EMPTY_FORM))

  // Catálogo del modal (coordinadores + trabajadores) cacheado: antes se
  // re-pedía completo en cada apertura. Se invalida por socket cuando cambia
  // la plantilla de empleados.
  const { data: metaData, loading: loadingMeta, error: metaError } = useResource(
    ['proyectos-meta'],
    obtenerMeta,
    { enabled: open, staleMs: 60_000, invalidateOn: ['empleado:changed', 'usuario:changed'] },
  )
  const meta = metaData ?? { coordinadores: [], trabajadores: [] }

  useEffect(() => {
    if (open && metaError) toast.error(metaError.response?.data?.error || 'Error al cargar datos')
  }, [open, metaError])

  useEffect(() => {
    if (!open) return
    setErrors({})
    setFilterParticipantes('')
    if (!isEdit) {
      setForm(EMPTY_FORM)
      initialRef.current = snapshot(EMPTY_FORM)
      return
    }
    setLoadingDetail(true)
    obtenerProyecto(proyectoId)
      .then((p) => {
        const loaded = {
          numero_proyecto: p.numero_proyecto || '',
          nombre: p.nombre || '',
          activo: Boolean(p.activo),
          coordinador_id: p.coordinador_id ? String(p.coordinador_id) : '',
          participantes_ids: (p.participantes_ids || []).map(Number),
        }
        setForm(loaded)
        initialRef.current = snapshot(loaded)
      })
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Error al cargar el proyecto')
        onClose?.()
      })
      .finally(() => setLoadingDetail(false))
  }, [open, isEdit, proyectoId])

  const isDirty = () => snapshot(form) !== initialRef.current

  const requestClose = () => {
    if (saving) return
    if (isDirty()) { setConfirmClose(true); return }
    onClose?.()
  }

  const doClose = () => {
    setConfirmClose(false)
    onClose?.()
  }

  const seleccionados = useMemo(() => new Set(form.participantes_ids.map(Number)), [form.participantes_ids])

  const trabajadoresFiltrados = useMemo(() => {
    const q = filterParticipantes.trim().toLowerCase()
    if (!q) return meta.trabajadores
    return meta.trabajadores.filter((t) =>
      (t.nombre || '').toLowerCase().includes(q) ||
      String(t.no_empleado || '').toLowerCase().includes(q)
    )
  }, [meta.trabajadores, filterParticipantes])

  const toggleParticipante = (id) => {
    const numId = Number(id)
    setForm((prev) => {
      const next = new Set(prev.participantes_ids.map(Number))
      if (next.has(numId)) next.delete(numId)
      else next.add(numId)
      return { ...prev, participantes_ids: Array.from(next) }
    })
  }

  const validate = () => {
    const e = {}
    if (!form.numero_proyecto.trim()) e.numero_proyecto = 'Requerido'
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      numero_proyecto: form.numero_proyecto.trim(),
      nombre: form.nombre.trim(),
      activo: form.activo,
      coordinador_id: form.coordinador_id || null,
      participantes_ids: form.participantes_ids,
    }
    try {
      const res = isEdit
        ? await actualizarProyecto(proyectoId, payload)
        : await crearProyecto(payload)
      toast.success(isEdit ? 'Proyecto actualizado' : 'Proyecto creado')
      res?.warnings?.forEach((w) => toast(w, { icon: '⚠️' }))
      onSaved?.()
      onClose?.()
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al guardar'
      toast.error(msg)
      if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, numero_proyecto: msg }))
      }
    } finally {
      setSaving(false)
    }
  }

  const loading = loadingMeta || loadingDetail
  const seleccionadosCount = form.participantes_ids.length

  return (
    <>
    <Modal
      open={open}
      onClose={saving ? undefined : requestClose}
      title={isEdit ? 'Editar Proyecto' : 'Registrar Proyecto'}
      description={isEdit ? 'Modifica los datos y participantes asignados.' : 'Da de alta un nuevo proyecto y asigna participantes.'}
      size="xl"
      bodyClassName="!p-0"
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={loading}>
            {isEdit ? 'Guardar cambios' : 'Guardar Proyecto'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 sm:px-6 py-5">
        {/* Columna izquierda: datos generales */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-200 border-b border-ink-200 dark:border-ink-700 pb-2">
            Datos Generales
          </h3>

          <Input
            label="No. de Proyecto"
            name="numero_proyecto"
            required
            value={form.numero_proyecto}
            onChange={(e) => setForm({ ...form, numero_proyecto: e.target.value })}
            error={errors.numero_proyecto}
            disabled={loading}
          />

          <Input
            label="Nombre del Proyecto"
            name="nombre"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            error={errors.nombre}
            disabled={loading}
          />

          <Select
            label="Coordinador"
            name="coordinador_id"
            value={form.coordinador_id}
            onChange={(e) => setForm({ ...form, coordinador_id: e.target.value })}
            disabled={loading}
          >
            <option value="">— Sin coordinador —</option>
            {meta.coordinadores.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
            ))}
          </Select>

          <label className="flex items-start gap-2 cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              disabled={loading}
            />
            <span>
              <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">Proyecto activo</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">
                Los inactivos no aceptan registro de horas y dejan de figurar en el expediente de sus trabajadores.
              </span>
            </span>
          </label>
        </div>

        {/* Columna derecha: participantes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-ink-200 dark:border-ink-700 pb-2">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Participantes</h3>
            <span className="text-xs text-ink-500 dark:text-ink-400">
              {seleccionadosCount} seleccionado{seleccionadosCount === 1 ? '' : 's'}
            </span>
          </div>

          <Input
            placeholder="Filtrar por nombre o No. empleado…"
            value={filterParticipantes}
            onChange={(e) => setFilterParticipantes(e.target.value)}
            leftIcon={<Search size={14} />}
            disabled={loading}
          />

          <div className="border border-ink-200 dark:border-ink-700 rounded-lg max-h-80 overflow-y-auto bg-ink-50/40 dark:bg-ink-900/40 scrollbar-thin">
            {loading ? (
              <div className="p-6 text-center text-sm text-ink-400">Cargando trabajadores…</div>
            ) : trabajadoresFiltrados.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-400 italic flex flex-col items-center gap-2">
                <UsersIcon size={20} />
                {meta.trabajadores.length === 0 ? 'No hay trabajadores activos.' : 'Sin coincidencias.'}
              </div>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-700">
                {trabajadoresFiltrados.map((t) => {
                  const isChecked = seleccionados.has(Number(t.id))
                  return (
                    <li key={t.id} className="px-3 py-2">
                      <label
                        className={`flex items-start gap-3 cursor-pointer ${!t.disponible ? 'opacity-60' : ''}`}
                        title={!t.disponible ? t.motivos_no_disponible.join(' · ') : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleParticipante(t.id)}
                          disabled={!t.disponible}
                          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium text-ink-900 dark:text-ink-100 ${!t.disponible ? 'underline decoration-red-400/60 underline-offset-2' : ''}`}>
                            {t.nombre}
                          </div>
                          <div className="text-xs text-ink-500 dark:text-ink-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span className="font-mono">#{t.no_empleado}</span>
                            <span>· {t.puesto || 'S/P'}</span>
                            {!t.disponible && (
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                <AlertCircle size={11} /> {t.motivos_no_disponible.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      open={confirmClose}
      onClose={() => setConfirmClose(false)}
      onConfirm={doClose}
      title="Cambios sin guardar"
      description="Hay cambios sin guardar. ¿Cerrar de todas formas? Se perderán los cambios."
      confirmLabel="Cerrar sin guardar"
      cancelLabel="Seguir editando"
      tone="warning"
    />
    </>
  )
}
