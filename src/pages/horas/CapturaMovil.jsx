import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ChevronDown, ChevronUp, Save, Trash2, Coffee, AlertCircle,
  CheckCircle2, Users as UsersIcon, Clock,
} from 'lucide-react'
import { crearRegistro, editarRegistro, eliminarRegistro } from '../../api/horas'
import { ConfirmDialog } from '../../components/ui'
import AvatarFoto from '../../components/empleados/AvatarFoto'

// ── Helpers ─────────────────────────────────────────────────────────────────

function dayKey(trabajadorId, fecha) {
  return `${trabajadorId}|${fecha}`
}

function defaultDayState() {
  return {
    hora_entrada: '',
    hora_salida: '',
    tomo_comida: false,
    incidencia: '',
    aplica_viaticos: false,
    viaticos_modo: 'perfil',
    monto_viaticos_manual: null,
    aplica_dia_festivo: false,
  }
}

function fromRegistro(reg) {
  if (!reg) return defaultDayState()
  return {
    hora_entrada: reg.hora_entrada || '',
    hora_salida: reg.hora_salida || '',
    tomo_comida: Boolean(reg.tomo_comida),
    incidencia: reg.incidencia || '',
    aplica_viaticos: Boolean(reg.aplica_viaticos),
    viaticos_modo: reg.viaticos_modo || 'perfil',
    monto_viaticos_manual: reg.monto_viaticos_manual ?? null,
    aplica_dia_festivo: Boolean(reg.aplica_dia_festivo),
  }
}

function isDirty(local, registro) {
  const base = fromRegistro(registro)
  return (
    local.hora_entrada !== base.hora_entrada
    || local.hora_salida !== base.hora_salida
    || local.tomo_comida !== base.tomo_comida
    || local.incidencia !== base.incidencia
  )
}

function isEmpty(local) {
  return !local.hora_entrada && !local.hora_salida && !local.incidencia
}

// ── Día individual ──────────────────────────────────────────────────────────

function DayRow({
  trabajador,
  fechaObj,        // { fecha, dia, label, fin_semana }
  registro,        // registro existente o null
  incidencias,
  editable,
  reporteId,
  onSaved,
  onDeleted,
}) {
  const [local, setLocal] = useState(() => fromRegistro(registro))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // Si el padre actualiza el registro (por ej. tras refetch), sincronizar.
  useEffect(() => { setLocal(fromRegistro(registro)) }, [registro?.id, registro?.hora_entrada, registro?.hora_salida, registro?.tomo_comida, registro?.incidencia])

  const dirty = isDirty(local, registro)
  const cannotSave = !editable || saving || deleting || (!registro && isEmpty(local)) || (!dirty && registro)

  const set = (patch) => setLocal((prev) => ({ ...prev, ...patch }))

  const handleSave = async () => {
    if (!editable) return
    // Si captura horas y no hay incidencia, exigir ambas horas
    if (!local.incidencia && (!local.hora_entrada || !local.hora_salida)) {
      toast.error('Captura hora de entrada y salida o elige una incidencia')
      return
    }
    setSaving(true)
    try {
      const payload = {
        trabajador_id: trabajador.id,
        fecha: fechaObj.fecha,
        hora_entrada: local.hora_entrada || null,
        hora_salida: local.hora_salida || null,
        tomo_comida: local.tomo_comida,
        aplica_viaticos: local.aplica_viaticos,
        viaticos_modo: local.viaticos_modo,
        monto_viaticos_manual: local.monto_viaticos_manual,
        aplica_dia_festivo: local.aplica_dia_festivo,
        incidencia: local.incidencia || null,
      }
      const res = registro
        ? await editarRegistro(registro.id, payload)
        : await crearRegistro(reporteId, payload)
      toast.success(registro ? 'Actualizado' : 'Guardado')
      onSaved?.(res)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!registro || !editable) return
    setDeleting(true)
    try {
      await eliminarRegistro(registro.id)
      toast.success('Registro eliminado')
      setConfirmDel(false)
      onDeleted?.(registro.id)
      setLocal(defaultDayState())
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-800 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${fechaObj.fin_semana ? 'text-violet-600 dark:text-violet-400' : 'text-ink-800 dark:text-ink-100'}`}>
          {fechaObj.dia} <span className="text-ink-500 dark:text-ink-400 font-normal">· {fechaObj.label}</span>
        </span>
        {registro && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} />
            {Number(registro.horas_productivas || 0).toFixed(2)}h
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1">
            Entrada
          </label>
          <input
            type="time"
            value={local.hora_entrada}
            onChange={(e) => set({ hora_entrada: e.target.value })}
            disabled={!editable}
            className="w-full h-10 px-2 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-sm font-mono text-ink-900 dark:text-ink-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400 mb-1">
            Salida
          </label>
          <input
            type="time"
            value={local.hora_salida}
            onChange={(e) => set({ hora_salida: e.target.value })}
            disabled={!editable}
            className="w-full h-10 px-2 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-sm font-mono text-ink-900 dark:text-ink-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 dark:text-ink-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={local.tomo_comida}
            onChange={(e) => set({ tomo_comida: e.target.checked })}
            disabled={!editable}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <Coffee size={13} className="text-amber-500" />
          Comida
        </label>
        <select
          value={local.incidencia}
          onChange={(e) => set({ incidencia: e.target.value })}
          disabled={!editable}
          className="flex-1 h-9 px-2 rounded-md border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-xs text-ink-900 dark:text-ink-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none disabled:opacity-60"
        >
          <option value="">— Sin incidencia —</option>
          {incidencias.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {editable && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={cannotSave}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            <Save size={14} />
            {registro ? (dirty ? 'Guardar' : 'Guardado') : 'Guardar'}
          </button>
          {registro && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              disabled={saving || deleting}
              className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
              aria-label="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDel}
        onClose={() => !deleting && setConfirmDel(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar registro"
        description="¿Eliminar este registro de horas? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
      />
    </div>
  )
}

// ── Acordeón por trabajador ─────────────────────────────────────────────────

function WorkerCard({ trabajador, fechas, registrosByDay, incidencias, editable, reporteId, onSaved, onDeleted, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  const stats = useMemo(() => {
    let capturados = 0
    let horas = 0
    for (const f of fechas) {
      const r = registrosByDay[dayKey(trabajador.id, f.fecha)]
      if (r) {
        capturados += 1
        horas += Number(r.horas_productivas || 0)
      }
    }
    return { capturados, horas }
  }, [fechas, registrosByDay, trabajador.id])

  const completo = stats.capturados === fechas.length

  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-ink-50 dark:active:bg-ink-800/60 transition-colors"
        aria-expanded={open}
      >
        <AvatarFoto
          id={trabajador.id}
          hasFoto={Boolean(trabajador.foto_perfil)}
          name={trabajador.nombre}
          size="sm"
          lazy
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">
            {trabajador.nombre}
          </div>
          <div className="text-[11px] text-ink-500 dark:text-ink-400 font-mono">
            #{trabajador.no_empleado} · {trabajador.tipo_nomina}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-xs font-bold ${completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-500 dark:text-ink-400'}`}>
            {stats.capturados}/{fechas.length}
          </div>
          <div className="text-[10px] font-mono text-ink-500 dark:text-ink-400">
            {stats.horas.toFixed(1)}h
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-ink-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-ink-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-ink-100 dark:border-ink-800">
          {fechas.map((f) => (
            <DayRow
              key={f.fecha}
              trabajador={trabajador}
              fechaObj={f}
              registro={registrosByDay[dayKey(trabajador.id, f.fecha)] || null}
              incidencias={incidencias}
              editable={editable}
              reporteId={reporteId}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vista móvil completa ────────────────────────────────────────────────────

export default function CapturaMovil({ reporte, editable, onRegistroSaved, onRegistroDeleted }) {
  const registrosByDay = useMemo(() => {
    const m = {}
    for (const r of reporte.registros) {
      m[dayKey(r.trabajador_id, r.fecha)] = r
    }
    return m
  }, [reporte.registros])

  if (reporte.trabajadores.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <span>Este proyecto no tiene trabajadores asignados. Asigna participantes desde el módulo de Proyectos.</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 mb-1 text-[11px] text-ink-500 dark:text-ink-400">
        <UsersIcon size={12} />
        <span>{reporte.trabajadores.length} trabajadores</span>
        <span className="text-ink-300 dark:text-ink-600">·</span>
        <Clock size={12} />
        <span>Toca un trabajador para capturar sus horas</span>
      </div>
      {reporte.trabajadores.map((t, idx) => (
        <WorkerCard
          key={t.id}
          trabajador={t}
          fechas={reporte.semana_fechas}
          registrosByDay={registrosByDay}
          incidencias={reporte.incidencias}
          editable={editable}
          reporteId={reporte.id}
          onSaved={onRegistroSaved}
          onDeleted={onRegistroDeleted}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  )
}
