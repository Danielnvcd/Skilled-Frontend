/**
 * Pestaña «Actividad» del lector: quién entró, a quién rechazó y cuándo.
 *
 * Cada intento trae la foto que tomó el lector en ese momento. Es lo más útil
 * para diagnosticar un rechazo: se ve si la persona estaba a contraluz, de
 * lado o demasiado lejos, sin tener que ir a pararse frente al equipo.
 *
 * Los eventos de puerta (bloqueo/desbloqueo del relé) se ocultan por defecto:
 * duplican cada acceso y entierran lo que importa.
 *
 * Tiempo real SIN sondeo: la lista sale de la base del ERP y se refresca sola
 * cuando llega `hikvision:evento` por Socket.IO (lo emite el proceso de
 * escucha al guardar un evento). Si esa escucha no está conectada se dice
 * aquí, y «Traer eventos» hace la ingesta a mano.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, DoorOpen, ScanFace, Download, Radio,
} from 'lucide-react'
import { Button, Card, EmptyState, Skeleton, AuthImage, ImageViewer } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'
import { getEventos, traerEventos, rutaCaptura, EVENTOS_ACTIVIDAD } from '../../api/hikvision'
import { claveEventos } from './formato'
import Estado from './Estado'

const FILTROS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'permitidos', texto: 'Permitidos' },
  { id: 'denegados', texto: 'Rechazados' },
]

const RANGOS = [
  { horas: 24, texto: 'Últimas 24 h' },
  { horas: 24 * 7, texto: 'Últimos 7 días' },
  { horas: 24 * 30, texto: 'Últimos 30 días' },
]

const ESTILO_TIPO = {
  permitido: { tono: 'success', Icono: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
  denegado: { tono: 'danger', Icono: XCircle, color: 'text-red-600 dark:text-red-400' },
  puerta: { tono: 'neutral', Icono: DoorOpen, color: 'text-ink-400 dark:text-ink-500' },
  otro: { tono: 'neutral', Icono: Activity, color: 'text-ink-400 dark:text-ink-500' },
}

export default function PanelActividad({ dispositivoId }) {
  const [filtro, setFiltro] = useState('todos')
  const [horas, setHoras] = useState(24)
  const [conPuerta, setConPuerta] = useState(false)
  const [captura, setCaptura] = useState(null)
  const [trayendo, setTrayendo] = useState(false)

  // Lee de la base del ERP, no del lector: se puede pedir sin miedo. Se
  // invalida sola con cada evento nuevo que avisa la escucha.
  const eventos = useResource(
    claveEventos(dispositivoId, filtro, horas),
    () => getEventos(dispositivoId, { filtro, horas, limite: 100 }),
    { staleMs: 60_000, invalidateOn: EVENTOS_ACTIVIDAD },
  )
  const { refetch } = eventos
  const tiempoReal = eventos.data?.tiempo_real

  const traer = async () => {
    setTrayendo(true)
    try {
      const r = await traerEventos(dispositivoId)
      toast.success(r.nuevos ? `${r.nuevos} evento(s) nuevo(s)` : 'Ya estaba al día')
      refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron traer los eventos del lector'))
    } finally {
      setTrayendo(false)
    }
  }

  const items = useMemo(() => {
    const todos = eventos.data?.items || []
    return conPuerta ? todos : todos.filter((e) => e.tipo !== 'puerta')
  }, [eventos.data, conPuerta])

  const hoyEnLector = eventos.data?.fecha_hoy || ''
  const grupos = useMemo(() => agruparPorDia(items, hoyEnLector), [items, hoyEnLector])

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="inline-flex rounded-md bg-ink-100 p-0.5 dark:bg-ink-800" role="tablist" aria-label="Tipo de evento">
          {FILTROS.map((f) => (
            <button
              key={f.id} type="button" role="tab" aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
                filtro === f.id
                  ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-100'
                  : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>

        <select
          value={horas} onChange={(e) => setHoras(Number(e.target.value))}
          aria-label="Periodo"
          className="h-8 rounded-md border border-ink-200 bg-white px-2 text-xs text-ink-700 focus-ring dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
        >
          {RANGOS.map((r) => <option key={r.horas} value={r.horas}>{r.texto}</option>)}
        </select>

        {filtro === 'todos' && (
          <label className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-400">
            <input type="checkbox" checked={conPuerta} onChange={(e) => setConPuerta(e.target.checked)}
                   className="rounded border-ink-300 dark:border-ink-600" />
            Mostrar eventos de puerta
          </label>
        )}

        <div className="ml-auto flex items-center gap-2">
          {tiempoReal?.en_vivo ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                  title="El lector avisa cada acceso en cuanto ocurre">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              En vivo
            </span>
          ) : tiempoReal && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Radio size={14} /> Sin tiempo real
            </span>
          )}
          <Button
            size="sm" variant="secondary" leftIcon={<Download size={14} />}
            loading={trayendo} onClick={traer}
            title="Pide al lector los eventos que falten y los guarda"
          >
            Traer eventos
          </Button>
        </div>
      </Card>

      {tiempoReal && !tiempoReal.en_vivo && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p>
              La escucha en tiempo real de este lector no está conectada: la lista puede
              no incluir los accesos más recientes.
              {tiempoReal.error && <> Último error: <em>{tiempoReal.error}</em></>}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Revisa que el servicio <code>hikvision-escucha</code> esté corriendo. Mientras
              tanto, «Traer eventos» los pide al lector una vez.
            </p>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {eventos.loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : eventos.error ? (
          <EmptyState
            icon={AlertTriangle}
            title="No se pudo leer la actividad del lector"
            description={extractApiError(eventos.error, 'Revisa que el lector esté en línea.')}
            action={<Button variant="secondary" onClick={refetch}>Reintentar</Button>}
          />
        ) : !items.length ? (
          <EmptyState
            icon={Activity}
            title="Sin actividad"
            description="No hay eventos de este tipo en el periodo elegido."
          />
        ) : (
          grupos.map(([dia, lista]) => (
            <section key={dia}>
              <h4 className="sticky top-0 z-10 border-b border-ink-100 bg-ink-50/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 backdrop-blur dark:border-ink-800 dark:bg-ink-900/95 dark:text-ink-400">
                {dia}
              </h4>
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {lista.map((e) => (
                  <FilaEvento
                    key={`${e.serial}-${e.minor}`} evento={e} dispositivoId={dispositivoId}
                    onVerCaptura={() => setCaptura(e)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>

      {eventos.data?.items?.length >= 100 && (
        <p className="text-center text-xs text-ink-500 dark:text-ink-400">
          Se muestran los 100 eventos más recientes del periodo.
        </p>
      )}

      <ImageViewer
        open={captura !== null}
        authPath={captura ? rutaCaptura(dispositivoId, captura.captura) : null}
        alt={captura ? `Captura de ${captura.nombre_en_equipo || 'desconocido'}` : ''}
        filename={captura ? `captura-${captura.serial}.jpg` : undefined}
        onClose={() => setCaptura(null)}
      />
    </div>
  )
}

function FilaEvento({ evento: e, dispositivoId, onVerCaptura }) {
  const estilo = ESTILO_TIPO[e.tipo] || ESTILO_TIPO.otro
  const { Icono } = estilo
  const esPuerta = e.tipo === 'puerta'

  return (
    <li className={`flex items-center gap-3 px-4 ${esPuerta ? 'py-1.5' : 'py-2.5'}`}>
      <span className="w-16 flex-shrink-0 font-mono text-xs tabular-nums text-ink-500 dark:text-ink-400">
        {hora(e.fecha_hora)}
      </span>

      {esPuerta ? (
        <span className="flex w-11 flex-shrink-0 justify-center"><Icono size={14} className={estilo.color} /></span>
      ) : e.captura ? (
        <button
          type="button" onClick={onVerCaptura} title="Ver la foto que tomó el lector"
          className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md bg-ink-100 ring-1 ring-ink-200 hover:ring-2 hover:ring-brand-500 focus-ring dark:bg-ink-800 dark:ring-ink-700"
        >
          <AuthImage
            src={rutaCaptura(dispositivoId, e.captura)} alt=""
            className="h-full w-full object-cover"
            fallback={<ScanFace size={16} className="m-auto text-ink-400" />}
          />
        </button>
      ) : (
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-ink-100 dark:bg-ink-800">
          <Icono size={16} className={estilo.color} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {esPuerta ? (
          <p className="text-xs text-ink-500 dark:text-ink-400">{e.descripcion}</p>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
              {e.trabajador_id ? (
                <Link to={`/empleados/${e.trabajador_id}`} className="hover:underline">
                  {e.nombre_en_equipo || e.employee_no}
                </Link>
              ) : (
                e.nombre_en_equipo || (e.employee_no ? `Usuario ${e.employee_no}` : 'Persona no identificada')
              )}
              {e.employee_no && (
                <span className="ml-2 font-mono text-xs font-normal text-ink-500 dark:text-ink-400">
                  {e.employee_no}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">
              {e.descripcion}
              {e.cubrebocas && ' · con cubrebocas'}
              {e.employee_no && !e.trabajador_id && ' · no está dado de alta desde el ERP'}
            </p>
          </>
        )}
      </div>

      {!esPuerta && (
        <Estado tone={estilo.tono}>
          {e.tipo === 'permitido' ? 'Permitido' : e.tipo === 'denegado' ? 'Rechazado' : 'Evento'}
        </Estado>
      )}
    </li>
  )
}

// La hora viene del reloj del lector con su desfase (p. ej. -06:00). Se
// muestra tal cual, sin convertir a la zona del navegador: es la hora de la
// oficina, que es la que la gente reconoce.
function hora(iso) {
  return (iso || '').slice(11, 19)
}

function agruparPorDia(items, hoy) {
  const mapa = new Map()
  for (const e of items) {
    const dia = (e.fecha_hora || '').slice(0, 10)
    if (!mapa.has(dia)) mapa.set(dia, [])
    mapa.get(dia).push(e)
  }
  return [...mapa.entries()].map(([dia, lista]) => [etiquetaDia(dia, hoy), lista])
}

function etiquetaDia(dia, referencia) {
  if (!dia) return 'Sin fecha'
  const [a, m, d] = dia.split('-').map(Number)
  const fecha = new Date(a, m - 1, d)
  const texto = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return dia === referencia ? `Hoy · ${texto}` : texto
}
