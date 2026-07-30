import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ClipboardPaste, AlertCircle, CheckCircle2, Trash2, Info, X } from 'lucide-react'
import { Modal, Button, Textarea } from '../../components/ui'
import { bulkUpsertRegistros } from '../../api/horas'

// Acepta varios separadores entre entrada y salida: -, –, —, " a ".
// "08:00-17:00", "8-17", "08:00 a 17:00", "8:00 17:00", etc.
const RE_TIME_PAIR = /^(\d{1,2})(?::(\d{1,2}))?\s*(?:[-–—]|a)\s*(\d{1,2})(?::(\d{1,2}))?$/i
// Solo entrada (kiosko "dentro, esperando salida"): "08:00", "8".
const RE_TIME_SINGLE = /^(\d{1,2})(?::(\d{1,2}))?$/

function pad2(n) {
  return String(n).padStart(2, '0')
}

function hhmm(h, m) {
  const hi = Number(h)
  const mi = Number(m || 0)
  if (!Number.isInteger(hi) || hi < 0 || hi > 23) return null
  if (!Number.isInteger(mi) || mi < 0 || mi > 59) return null
  return `${pad2(hi)}:${pad2(mi)}`
}

// Devuelve {entrada, salida, incidencia, error} para una celda cruda.
function parseCelda(raw, incidenciasNorm) {
  const txt = (raw || '').trim()
  if (!txt) return { vacio: true }

  // Incidencia: match case-insensitive contra la lista del reporte.
  const norm = txt.toLowerCase()
  const matchInc = incidenciasNorm.find((i) => i.norm === norm)
  if (matchInc) return { incidencia: matchInc.original }

  // Par de horas (entrada-salida).
  const m = RE_TIME_PAIR.exec(txt)
  if (m) {
    const entrada = hhmm(m[1], m[2])
    const salida = hhmm(m[3], m[4])
    if (entrada && salida && entrada !== salida) {
      return { entrada, salida }
    }
    return { error: 'rango inválido' }
  }

  // Solo entrada.
  const ms = RE_TIME_SINGLE.exec(txt)
  if (ms) {
    const entrada = hhmm(ms[1], ms[2])
    if (entrada) return { entrada }
    return { error: 'hora inválida' }
  }

  return { error: `no reconocido: "${txt.slice(0, 16)}"` }
}

// Matcher de trabajador (col[0]) contra la lista del reporte.
function matchTrabajador(raw, trabajadores) {
  const txt = (raw || '').trim().replace(/^#/, '').replace(/^[#\s]+/, '')
  if (!txt) return null
  // Por no_empleado (numérico): match exacto.
  if (/^\d+$/.test(txt)) {
    const t = trabajadores.find((x) => String(x.no_empleado) === txt)
    if (t) return t
  }
  // Por nombre: exacto lowercased, luego substring.
  const low = txt.toLowerCase()
  const exact = trabajadores.find((x) => (x.nombre || '').toLowerCase().trim() === low)
  if (exact) return exact
  const subs = trabajadores.filter((x) => (x.nombre || '').toLowerCase().includes(low))
  if (subs.length === 1) return subs[0]
  return null  // sin match único
}

export default function PegarExcelModal({
  open,
  onClose,
  reporteId,
  trabajadores,    // [{id, nombre, no_empleado, ...}]
  semanaFechas,    // [{fecha, dia, label}]  fechaInicio→fechaFin
  incidencias,     // string[]
  onAplicado,      // callback tras éxito
}) {
  const [texto, setTexto] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTexto('')
      // Focus al abrir para que paste se pueda hacer de inmediato.
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  const incidenciasNorm = useMemo(
    () => (incidencias || []).map((i) => ({ original: i, norm: i.toLowerCase().trim() })),
    [incidencias],
  )

  // Parseo a estructura intermedia: filas con estado por celda.
  const preview = useMemo(() => {
    if (!texto.trim()) return null
    const lineas = texto.replace(/\r/g, '').split('\n').filter((l) => l.length > 0)
    const filas = []
    const nDias = semanaFechas.length
    let nuevos = 0
    let actualizar = 0
    let errores = 0

    for (const linea of lineas) {
      const cols = linea.split('\t')
      const idStr = cols[0]
      const trab = matchTrabajador(idStr, trabajadores)
      const cells = []
      for (let i = 0; i < nDias; i++) {
        const fecha = semanaFechas[i].fecha
        const raw = cols[i + 1]
        const parsed = parseCelda(raw, incidenciasNorm)
        cells.push({ fecha, raw: raw ?? '', ...parsed })
      }
      if (!trab) {
        filas.push({ idStr, trab: null, cells, error: `sin match: "${(idStr || '').slice(0, 24)}"` })
        errores += 1
        continue
      }
      // Contar acciones por celda válida (no vacía y sin error).
      for (const c of cells) {
        if (c.vacio || c.error) continue
        nuevos += 1  // El backend hará upsert, aquí no sabemos si es create/update sin más datos.
      }
      filas.push({ idStr, trab, cells, error: null })
    }
    return { filas, nuevos, actualizar, errores, total: lineas.length }
  }, [texto, trabajadores, semanaFechas, incidenciasNorm])

  const registrosPayload = useMemo(() => {
    if (!preview) return []
    const out = []
    for (const fila of preview.filas) {
      if (!fila.trab) continue
      for (const c of fila.cells) {
        if (c.vacio || c.error) continue
        const item = { trabajador_id: fila.trab.id, fecha: c.fecha }
        if (c.entrada) item.hora_entrada = c.entrada
        if (c.salida) item.hora_salida = c.salida
        if (c.incidencia) item.incidencia = c.incidencia
        out.push(item)
      }
    }
    return out
  }, [preview])

  const handleAplicar = async () => {
    if (registrosPayload.length === 0) return
    setAplicando(true)
    try {
      const res = await bulkUpsertRegistros(reporteId, registrosPayload)
      const total = (res.created || 0) + (res.updated || 0)
      const partes = []
      if (res.created) partes.push(`${res.created} nuevo${res.created === 1 ? '' : 's'}`)
      if (res.updated) partes.push(`${res.updated} actualizado${res.updated === 1 ? '' : 's'}`)
      toast.success(`${total} registro${total === 1 ? '' : 's'} (${partes.join(' · ')})`)
      if (res.skipped?.length) {
        toast(`${res.skipped.length} omitido${res.skipped.length === 1 ? '' : 's'} por validación`, { icon: <Info size={18} /> })
      }
      onAplicado?.()
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aplicar el pegado')
    } finally {
      setAplicando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={aplicando ? undefined : onClose}
      title="Pegar desde Excel"
      description="Pega un bloque copiado desde Excel/Sheets. Primera columna: # empleado o nombre. Columnas siguientes: una por día de la semana."
      size="xl"
      footer={
        <>
          <Button variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => setTexto('')} disabled={!texto || aplicando}>
            Limpiar
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={aplicando}>Cancelar</Button>
          <Button
            variant="primary"
            leftIcon={<ClipboardPaste size={14} />}
            loading={aplicando}
            disabled={registrosPayload.length === 0}
            onClick={handleAplicar}
          >
            Aplicar {registrosPayload.length > 0 ? `(${registrosPayload.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/40 p-2 text-[11px] text-ink-700 dark:text-ink-200">
          <div className="font-semibold mb-1">Columnas esperadas (en este orden):</div>
          <div className="flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 rounded bg-ink-200 dark:bg-ink-700 font-mono">#emp/nombre</span>
            {semanaFechas.map((d) => (
              <span key={d.fecha} className="px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200 font-mono">
                {d.dia} {d.label}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-ink-500 dark:text-ink-400">
            Formatos de celda: <code>08:00-17:00</code>, <code>8-17</code>, <code>08:00</code> (solo entrada), o nombre de incidencia ({(incidencias || []).join(', ') || '—'}). Celda vacía = sin cambio.
          </div>
        </div>

        <Textarea
          ref={textareaRef}
          rows={6}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pega aquí (Ctrl+V) las filas copiadas de Excel…"
          className="font-mono text-xs"
        />

        {preview && (
          <div>
            <div className="flex items-center gap-3 text-xs mb-2">
              <span className="font-semibold text-ink-800 dark:text-ink-100">Vista previa</span>
              {preview.filas.length > 0 && (
                <span className="text-ink-500 dark:text-ink-400">
                  {registrosPayload.length} cambio{registrosPayload.length === 1 ? '' : 's'} válido{registrosPayload.length === 1 ? '' : 's'}
                  {preview.errores > 0 && (
                    <span className="ml-2 text-red-600 dark:text-red-400">
                      · {preview.errores} fila{preview.errores === 1 ? '' : 's'} sin match
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800">
              <table className="min-w-full text-xs">
                <thead className="bg-ink-50 dark:bg-ink-800/60 text-ink-600 dark:text-ink-300">
                  <tr>
                    <th className="px-2 py-1 text-left">Trabajador</th>
                    {semanaFechas.map((d) => (
                      <th key={d.fecha} className="px-2 py-1 text-center whitespace-nowrap">{d.dia}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {preview.filas.length === 0 ? (
                    <tr><td colSpan={1 + semanaFechas.length} className="px-3 py-3 text-center text-ink-400">Sin filas reconocibles. Verifica que pegaste con tabs entre columnas.</td></tr>
                  ) : preview.filas.map((fila, idx) => (
                    <tr key={idx} className={fila.error ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                      <td className="px-2 py-1">
                        {fila.trab ? (
                          <div className="min-w-0">
                            <span className="font-medium text-ink-900 dark:text-ink-100">{fila.trab.nombre}</span>
                            <span className="ml-1 text-[10px] font-mono text-ink-500">#{fila.trab.no_empleado}</span>
                          </div>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                            <AlertCircle size={11} /> {fila.error}
                          </span>
                        )}
                      </td>
                      {fila.cells.map((c, j) => (
                        <td key={j} className="px-2 py-1 text-center">
                          {c.vacio ? (
                            <span className="text-ink-300">—</span>
                          ) : c.error ? (
                            <span className="text-red-600 dark:text-red-400 inline-flex" title={c.error}><X size={12} /></span>
                          ) : c.incidencia ? (
                            <span className="inline-block px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 font-mono text-[10px]">
                              {c.incidencia}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">
                              <CheckCircle2 size={9} /> {c.entrada}{c.salida ? `–${c.salida}` : ''}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
