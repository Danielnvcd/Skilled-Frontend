/**
 * Detalle de un lector — el tablero del equipo.
 *
 * Arriba, el estado de un vistazo (conexión, empleados, capacidad, accesos y
 * rechazos de hoy, reloj). Debajo, tres pestañas:
 *
 *   Empleados   qué personal de oficina se sincroniza, sus fotos y su estado
 *   Actividad   quién entró y a quién rechazó, con la foto de cada intento
 *   Equipo      hardware, reloj, capacidad, puerta y auditoría de usuarios
 *
 * La pestaña vive en la URL (`?tab=`) para que un enlace o un «atrás» del
 * navegador regrese a la misma vista.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ScanFace, Users, Activity, Cpu, CheckCircle2, XCircle, Clock,
  HardDrive, RefreshCw, MapPin,
} from 'lucide-react'
import { PageHeader, Button, Card, Skeleton, AuthImage } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import {
  getEmpleadosDeLector, getPuerta, getEstadoEquipo, getEventos, EVENTOS_ACTIVIDAD, EVENTO_PUERTA,
  rutaFotoLector,
} from '../../api/hikvision'
import PanelEmpleados from './PanelEmpleados'
import PanelActividad from './PanelActividad'
import PanelEquipo from './PanelEquipo'
import { claveEventos, describirDesfase, formatoFecha } from './formato'
import Estado from './Estado'

const PESTANAS = [
  { id: 'empleados', texto: 'Empleados', Icono: Users },
  { id: 'actividad', texto: 'Actividad', Icono: Activity },
  { id: 'equipo', texto: 'Equipo', Icono: Cpu },
]

export default function DispositivoDetalle() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.id === params.get('tab')) ? params.get('tab') : 'empleados'
  const irA = (t) => setParams(t === 'empleados' ? {} : { tab: t }, { replace: true })

  const datos = useResource(
    ['hikvision:empleados', { id }],
    () => getEmpleadosDeLector(id),
    { staleMs: 10_000, invalidateOn: ['hikvision:changed', 'empleado:changed'] },
  )
  const estado = useResource(
    ['hikvision:estado', { id }],
    () => getEstadoEquipo(id),
    { staleMs: 30_000, invalidateOn: ['hikvision:changed'] },
  )
  // El estado de la puerta se consulta al lector, y se vuelve a consultar cada
  // vez que el lector avisa que la cerradura cambió (`hikvision:puerta`): al
  // abrir, el relé cierra solo a los pocos segundos y sin esto la pantalla se
  // quedaba en «Abierta» hasta recargar.
  const puerta = useResource(['hikvision:puerta', { id }], () => getPuerta(id), {
    staleMs: 5_000, invalidateOn: [EVENTO_PUERTA],
  })
  // Misma clave y misma consulta que la vista por defecto de «Actividad»: los
  // KPIs de hoy y esa pestaña comparten una sola petición. Sale de la base del
  // ERP y se refresca sola con cada evento que avisa la escucha.
  const actividad = useResource(
    claveEventos(id),
    () => getEventos(id, { filtro: 'todos', horas: 24, limite: 100 }),
    { staleMs: 60_000, invalidateOn: EVENTOS_ACTIVIDAD },
  )
  const tiempoReal = actividad.data?.tiempo_real

  const dispositivo = datos.data?.dispositivo || estado.data?.dispositivo
  const resumen = datos.data?.resumen
  const enLinea = estado.data?.ok === true
  const sinConexion = !!estado.error

  const refrescarTodo = () => {
    datos.refetch(); estado.refetch(); puerta.refetch(); actividad.refetch()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={dispositivo?.nombre || 'Lector'}
        description="Tablero del lector biométrico: personal sincronizado, actividad y estado del equipo."
        icon={ScanFace}
        breadcrumb={
          <Link to="/lectores" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft size={12} /> Lectores
          </Link>
        }
        actions={
          <Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={refrescarTodo}>
            Actualizar
          </Button>
        }
      />

      {/* ── Identidad y conexión ─────────────────────────────────────── */}
      <Card className="flex flex-wrap items-center gap-4 p-4">
        {dispositivo?.tiene_foto ? (
          <AuthImage
            src={rutaFotoLector(dispositivo.id, dispositivo.foto_version)} alt=""
            className="h-11 w-11 rounded-md object-cover ring-1 ring-ink-200 dark:ring-ink-700"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ink-100 text-ink-500 dark:bg-ink-800">
            <ScanFace size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              {dispositivo?.modelo || 'Lector Hikvision'}
            </h2>
            {estado.loading ? (
              <Estado tone="neutral">Conectando…</Estado>
            ) : enLinea ? (
              <Estado tone="success">En línea</Estado>
            ) : (
              <Estado tone="danger">Sin conexión</Estado>
            )}
            {dispositivo && !dispositivo.activo && <Estado tone="warning">Desactivado</Estado>}
            {tiempoReal && (tiempoReal.en_vivo
              ? <Estado tone="success">Tiempo real</Estado>
              : <Estado tone="warning">Sin tiempo real</Estado>)}
          </div>
          {dispositivo?.ubicacion && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-600 dark:text-ink-300">
              <MapPin size={13} className="flex-shrink-0" /> {dispositivo.ubicacion}
            </p>
          )}
          <p className="mt-0.5 truncate font-mono text-xs text-ink-500 dark:text-ink-400">
            {dispositivo ? `${dispositivo.host}:${dispositivo.puerto}` : '—'}
            {dispositivo?.firmware && ` · FW ${dispositivo.firmware}`}
            {dispositivo?.numero_serie && ` · S/N ${dispositivo.numero_serie}`}
          </p>
        </div>
        <div className="text-right text-xs text-ink-500 dark:text-ink-400">
          {sinConexion ? (
            <span className="text-red-600 dark:text-red-400">
              {dispositivo?.ultimo_error || 'El lector no respondió.'}
            </span>
          ) : (
            <>Última conexión<br />
              <span className="text-ink-700 dark:text-ink-300">
                {dispositivo?.ultima_conexion ? formatoFecha(dispositivo.ultima_conexion) : '—'}
              </span>
            </>
          )}
        </div>
      </Card>

      {/* ── Indicadores ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          Icono={Users} etiqueta="En el lector"
          cargando={!resumen}
          valor={resumen?.sincronizados}
          detalle={resumen && `de ${resumen.total} de oficina${resumen.desactualizados ? ` · ${resumen.desactualizados} desactualizado(s)` : ''}`}
          alerta={resumen?.desactualizados > 0 || resumen?.con_error > 0}
          onClick={() => irA('empleados')}
        />
        <Kpi
          Icono={HardDrive} etiqueta="Rostros registrados"
          cargando={estado.loading} sinDatos={sinConexion}
          valor={estado.data?.capacidad.con_rostro}
          detalle={estado.data && `de ${estado.data.capacidad.max_rostros.toLocaleString('es-MX')} posibles`}
          onClick={() => irA('equipo')}
        />
        <Kpi
          Icono={CheckCircle2} etiqueta="Accesos hoy" tono="text-emerald-600 dark:text-emerald-400"
          cargando={actividad.loading} sinDatos={!!actividad.error}
          valor={actividad.data?.hoy.permitidos}
          detalle="reconocidos y con puerta abierta"
          onClick={() => irA('actividad')}
        />
        <Kpi
          Icono={XCircle} etiqueta="Rechazos hoy" tono="text-red-600 dark:text-red-400"
          cargando={actividad.loading} sinDatos={!!actividad.error}
          valor={actividad.data?.hoy.denegados}
          detalle="intentos que no abrieron"
          alerta={actividad.data?.hoy.denegados > 0}
          onClick={() => irA('actividad')}
        />
        <Kpi
          Icono={Clock} etiqueta="Reloj del lector"
          cargando={estado.loading} sinDatos={sinConexion}
          valor={estado.data && (estado.data.hora.en_hora ? 'En hora' : 'Desajustado')}
          tono={estado.data?.hora.en_hora ? 'text-ink-900 dark:text-ink-100' : 'text-amber-600 dark:text-amber-400'}
          detalle={estado.data && describirDesfase(estado.data.hora.desfase_segundos)}
          alerta={estado.data && !estado.data.hora.en_hora}
          onClick={() => irA('equipo')}
        />
      </div>

      {/* ── Pestañas ─────────────────────────────────────────────────── */}
      <div className="border-b border-ink-200 dark:border-ink-800">
        <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Secciones del lector">
          {PESTANAS.map(({ id: pid, texto, Icono }) => (
            <button
              key={pid} type="button" role="tab" aria-selected={tab === pid}
              onClick={() => irA(pid)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-ring ${
                tab === pid
                  ? 'border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-300'
                  : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
              }`}
            >
              <Icono size={16} />
              {texto}
              {pid === 'empleados' && resumen?.desactualizados > 0 && (
                <span className="rounded-full bg-sky-100 px-1.5 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  {resumen.desactualizados}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'empleados' && (
        <PanelEmpleados dispositivoId={id} datos={datos} activo={dispositivo?.activo !== false} />
      )}
      {tab === 'actividad' && <PanelActividad dispositivoId={id} />}
      {tab === 'equipo' && (
        <PanelEquipo
          dispositivoId={id} dispositivo={dispositivo}
          estado={estado} puerta={puerta}
          onCambioEmpleados={() => irA('empleados')}
        />
      )}
    </div>
  )
}

function Kpi({ Icono, etiqueta, valor, detalle, tono = 'text-ink-900 dark:text-ink-100',
               cargando, sinDatos, alerta, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      className="group rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-ink-200 transition hover:shadow-md hover:ring-ink-300 focus-ring dark:bg-ink-900 dark:ring-ink-800 dark:hover:ring-ink-700"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{etiqueta}</span>
        <span className="relative">
          <Icono size={16} className="text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-300" />
          {alerta && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-ink-900" />}
        </span>
      </div>
      {cargando ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${sinDatos ? 'text-ink-400' : tono}`}>
          {sinDatos ? '—' : (valor ?? '—')}
        </p>
      )}
      <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">
        {sinDatos ? 'Sin conexión con el lector' : (detalle || ' ')}
      </p>
    </button>
  )
}
