/**
 * Purga de una tabla, con previa obligatoria.
 *
 * La regla de esta pantalla: **nadie confirma a ciegas**. Al elegir tabla y
 * periodo se consulta al servidor cuántas filas caerían y cuántas quedarían, y
 * el botón no se habilita hasta tener ese número. Un "borrar registros
 * antiguos" sin cifra delante es la manera clásica de vaciar una tabla sin
 * querer.
 *
 * Las reglas de qué se puede borrar (piso de antigüedad, filtros como "solo
 * notificaciones leídas" o "solo tokens vencidos") viven en el BACKEND, no
 * aquí: esta vista solo las muestra. Si estuvieran en el navegador serían una
 * sugerencia, no una salvaguarda.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2, AlertTriangle, Info } from 'lucide-react'
import { Button, Select, Badge } from '../../../components/ui'
import { previaPurga } from '../../../api/sistemas'
import { extractApiError } from '../../../utils/apiError'
import { fmtNumero } from '../PanelLayout'

const PERIODOS = [3, 6, 12, 24, 36]

export default function PurgaTabla({ tablas = [], onPurgar }) {
  const [tabla, setTabla] = useState('')
  const [meses, setMeses] = useState(12)
  const [previa, setPrevia] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [errorPrevia, setErrorPrevia] = useState('')

  const politica = tablas.find((t) => t.tabla === tabla)

  // Al cambiar de tabla, subir el periodo al mínimo que esa tabla permite: si
  // no, se queda en un valor inválido y el usuario solo ve un error sin saber
  // por qué (movimientos exige 24 meses, la bitácora 3).
  useEffect(() => {
    if (politica && meses < politica.min_meses) setMeses(politica.min_meses)
  }, [tabla])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tabla) { setPrevia(null); setErrorPrevia(''); return }
    let vigente = true
    setCargando(true)
    setErrorPrevia('')
    previaPurga(tabla, meses)
      .then((d) => { if (vigente) setPrevia(d) })
      .catch((err) => {
        if (!vigente) return
        setPrevia(null)
        setErrorPrevia(extractApiError(err, 'No se pudo calcular la previa'))
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [tabla, meses])

  const periodosValidos = PERIODOS.filter((p) => !politica || p >= politica.min_meses)
  const puedePurgar = Boolean(previa && previa.borrables > 0 && !cargando)

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-900/10">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
        <Trash2 size={15} className="text-red-600 dark:text-red-400" />
        Purgar registros antiguos
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
        Elige la tabla y desde cuándo conservar. Se te muestra cuántas filas se
        borrarían <strong className="font-medium">antes</strong> de confirmar. Es
        irreversible.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Select
          label="Tabla"
          value={tabla}
          onChange={(e) => { setTabla(e.target.value); setPrevia(null) }}
          wrapperClassName="w-64"
        >
          <option value="">Selecciona una tabla…</option>
          {tablas.map((t) => (
            <option key={t.tabla} value={t.tabla}>{t.etiqueta}</option>
          ))}
        </Select>

        <Select
          label="Conservar"
          value={String(meses)}
          onChange={(e) => setMeses(Number(e.target.value))}
          wrapperClassName="w-48"
          disabled={!tabla}
        >
          {periodosValidos.map((p) => (
            <option key={p} value={p}>Últimos {p} meses</option>
          ))}
        </Select>

        <Button
          variant="danger"
          size="md"
          leftIcon={<Trash2 size={15} />}
          disabled={!puedePurgar}
          onClick={() => onPurgar({ tabla, meses, previa, politica })}
        >
          Purgar
        </Button>
      </div>

      {politica && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
          {politica.riesgo === 'alto'
            ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            : <Info size={14} className="mt-0.5 flex-shrink-0" />}
          <span>
            {politica.riesgo === 'alto' && (
              <Badge tone="warning" className="mr-1.5">Alto impacto</Badge>
            )}
            {politica.nota}
          </span>
        </p>
      )}

      {errorPrevia && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{errorPrevia}</p>
      )}

      {cargando && (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Calculando…</p>
      )}

      {previa && !cargando && (
        <div className="mt-3 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs dark:border-ink-800 dark:bg-ink-900">
          {previa.borrables > 0 ? (
            <>
              Se borrarían{' '}
              <strong className="font-semibold text-red-700 dark:text-red-300">
                {fmtNumero(previa.borrables)}
              </strong>{' '}
              fila(s) anteriores al{' '}
              <strong className="font-medium">
                {new Date(`${previa.corte}T12:00:00`).toLocaleDateString('es-MX')}
              </strong>
              . Quedarían {fmtNumero(previa.conservadas)} de {fmtNumero(previa.total)}.
            </>
          ) : (
            <>No hay filas que cumplan esos criterios: no se borraría nada.</>
          )}
        </div>
      )}
    </div>
  )
}
