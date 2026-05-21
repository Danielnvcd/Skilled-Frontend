import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Trash2 } from 'lucide-react'
import { Modal, Button, Input } from '../../components/ui'
import { obtenerTrabajadoresDisponibles, crearPeriodo } from '../../api/ajustes'

export default function PeriodoCrearModal({ open, onClose, onCreated }) {
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [trabajadores, setTrabajadores] = useState([])
  const [filter, setFilter] = useState('')
  const [seleccion, setSeleccion] = useState({}) // { trabajador_id: monto_meta }
  const [saving, setSaving] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre('')
    setFechaInicio('')
    setFechaFin('')
    setSeleccion({})
    setFilter('')
    setLoadingMeta(true)
    obtenerTrabajadoresDisponibles()
      .then(setTrabajadores)
      .catch((err) => toast.error(err.response?.data?.error || 'Error al cargar trabajadores'))
      .finally(() => setLoadingMeta(false))
  }, [open])

  const filtrados = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return trabajadores
    return trabajadores.filter((t) =>
      (t.nombre_completo || '').toLowerCase().includes(q) ||
      String(t.no_empleado || '').toLowerCase().includes(q)
    )
  }, [trabajadores, filter])

  const toggleSelect = (id) => {
    setSeleccion((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = ''
      return next
    })
  }

  const setMonto = (id, v) => {
    setSeleccion((prev) => ({ ...prev, [id]: v }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return toast.error('Nombre requerido')
    if (!fechaInicio || !fechaFin) return toast.error('Define fechas')
    if (fechaInicio >= fechaFin) return toast.error('Inicio debe ser antes de fin')

    const entries = Object.entries(seleccion)
      .map(([id, monto]) => ({ trabajador_id: Number(id), monto_meta: Number(monto) }))
      .filter((e) => e.monto_meta > 0)

    if (entries.length === 0) return toast.error('Selecciona al menos un trabajador con meta > 0')

    setSaving(true)
    try {
      const res = await crearPeriodo({
        nombre: nombre.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        trabajadores: entries,
      })
      toast.success(`Periodo creado con ${res.creados} trabajadores`)
      onCreated?.(res.id)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear periodo')
    } finally {
      setSaving(false)
    }
  }

  const totalMeta = Object.values(seleccion).reduce((acc, v) => acc + (Number(v) || 0), 0)
  const seleccionados = Object.keys(seleccion).length

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Nuevo periodo de ajuste"
      description="Inbursa: agrupa los descuentos de un mes y asigna meta por trabajador."
      size="xl"
      bodyClassName="!p-0"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>Crear periodo</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 sm:px-6 py-5">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-200 border-b border-ink-200 dark:border-ink-700 pb-2">
            Datos del periodo
          </h3>
          <Input label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Febrero 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha inicio" type="date" required value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            <Input label="Fecha fin" type="date" required value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>

          <div className="rounded-md border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/40 p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-ink-500">Trabajadores seleccionados</span>
              <span className="font-semibold">{seleccionados}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Meta total</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                ${totalMeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-ink-200 dark:border-ink-700 pb-2">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-200">Trabajadores y metas</h3>
            <span className="text-xs text-ink-500">{seleccionados} sel.</span>
          </div>

          <Input
            placeholder="Filtrar por nombre o No. empleado…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            leftIcon={<Search size={14} />}
            disabled={loadingMeta}
          />

          <div className="border border-ink-200 dark:border-ink-700 rounded-lg max-h-80 overflow-y-auto bg-ink-50/40 dark:bg-ink-900/40 scrollbar-thin">
            {loadingMeta ? (
              <p className="p-6 text-center text-sm text-ink-400">Cargando…</p>
            ) : filtrados.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-400 italic">Sin coincidencias</p>
            ) : (
              <ul className="divide-y divide-ink-200 dark:divide-ink-700">
                {filtrados.map((t) => {
                  const isSel = t.id in seleccion
                  return (
                    <li key={t.id} className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(t.id)}
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{t.nombre_completo}</div>
                          <div className="text-[11px] text-ink-500 font-mono">#{t.no_empleado}</div>
                        </div>
                        {isSel && (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Meta $"
                            value={seleccion[t.id]}
                            onChange={(e) => setMonto(t.id, e.target.value)}
                            className="w-28 h-8 px-2 text-sm rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </form>
    </Modal>
  )
}
