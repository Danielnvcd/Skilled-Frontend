import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal, Button, Select, Input } from '../../components/ui'
import { obtenerProyectosDisponibles, crearReporte } from '../../api/horas'

function siguienteMartes(base = new Date()) {
  const d = new Date(base)
  const dow = d.getDay() // 0 dom, 1 lun, 2 mar
  const diff = (2 - dow + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}

function fmtIso(d) {
  return d.toISOString().slice(0, 10)
}

export default function AbrirReporteModal({ open, onClose, onCreated }) {
  const [proyectos, setProyectos] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proyectoId, setProyectoId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  const defaultsSemana = useMemo(() => {
    const hoy = new Date()
    const dow = hoy.getDay()
    const diffToMartes = (dow - 2 + 7) % 7
    const martes = new Date(hoy)
    martes.setDate(hoy.getDate() - diffToMartes)
    const lunes = new Date(martes)
    lunes.setDate(martes.getDate() + 6)
    return { inicio: fmtIso(martes), fin: fmtIso(lunes) }
  }, [])

  useEffect(() => {
    if (!open) return
    setProyectoId('')
    setFechaInicio(defaultsSemana.inicio)
    setFechaFin(defaultsSemana.fin)
    setLoadingMeta(true)
    obtenerProyectosDisponibles()
      .then(setProyectos)
      .catch((err) => toast.error(err.response?.data?.error || 'Error cargando proyectos'))
      .finally(() => setLoadingMeta(false))
  }, [open, defaultsSemana])

  const onProyectoChange = (id) => setProyectoId(id)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!proyectoId) return toast.error('Selecciona un proyecto')
    if (!fechaInicio || !fechaFin) return toast.error('Define el rango de fechas')
    if (fechaInicio >= fechaFin) return toast.error('La fecha de inicio debe ser anterior al fin')

    setSaving(true)
    try {
      const res = await crearReporte({ proyecto_id: Number(proyectoId), fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      toast.success('Reporte abierto')
      onCreated?.(res.id)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al abrir el reporte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Abrir nuevo reporte semanal"
      description="Selecciona el proyecto y el rango de fechas (martes a lunes)."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={onSubmit} loading={saving} disabled={loadingMeta}>
            Abrir reporte
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Select
          label="Proyecto"
          required
          value={proyectoId}
          onChange={(e) => onProyectoChange(e.target.value)}
          disabled={loadingMeta}
        >
          <option value="">— Selecciona un proyecto —</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.numero_proyecto} — {p.nombre}</option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Fecha de inicio"
            type="date"
            required
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
          <Input
            label="Fecha de fin"
            type="date"
            required
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        {!loadingMeta && proyectos.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/60 rounded-md p-2">
            No hay proyectos activos asignados a tu cuenta.
          </p>
        )}
      </form>
    </Modal>
  )
}
