/**
 * Lectores — alta y administración de los lectores biométricos Hikvision.
 *
 * Un lector por oficina; el diseño NO asume que solo habrá uno.
 *
 * Cada tarjeta muestra la foto del equipo instalado, dónde está, si la
 * conexión en tiempo real funciona y sus cifras del día (empleados, accesos,
 * último acceso). Todo eso sale de la base del ERP: abrir esta lista no le
 * pregunta nada a ningún lector.
 *
 * La contraseña se captura aquí pero nunca vuelve del servidor: al editar, el
 * campo aparece vacío y dejarlo así significa «no la cambies». Se dice en la
 * propia etiqueta porque un campo de contraseña vacío en un formulario de
 * edición se interpreta, si no, como que se va a borrar.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ScanFace, Plug, Plus, Pencil, Trash2, AlertTriangle, MapPin, Users, LogIn, Clock,
  ArrowRight, Radio,
} from 'lucide-react'
import {
  PageHeader, Button, Card, Badge, EmptyState, Skeleton, ConfirmDialog, AuthImage,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'
import {
  getDispositivos, eliminarDispositivo, probarDispositivo, rutaFotoLector,
} from '../../api/hikvision'
import FormularioLector from './FormularioLector'

export default function Dispositivos() {
  const lectores = useResource('hikvision:dispositivos', getDispositivos, {
    staleMs: 15_000,
    invalidateOn: ['hikvision:changed', 'hikvision:evento'],
  })

  // null = cerrado; {} = alta; {lector} = edición.
  const [editando, setEditando] = useState(null)
  const [probandoId, setProbandoId] = useState(null)
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const probar = async (d) => {
    setProbandoId(d.id)
    try {
      const r = await probarDispositivo(d.id)
      toast.success(`${r.info.modelo} — firmware ${r.info.firmware}`)
      // El reloj se avisa aparte: con la hora mal, las checadas quedan
      // corridas, y es el tipo de problema que no se nota hasta que ya hay
      // datos malos.
      const anio = Number((r.hora?.hora_local || '').slice(0, 4))
      if (anio && Math.abs(anio - new Date().getFullYear()) > 0) {
        toast('El reloj del lector está desajustado: ' + r.hora.hora_local, { icon: '🕓' })
      }
      lectores.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo conectar con el lector'))
      lectores.refetch()
    } finally {
      setProbandoId(null)
    }
  }

  const confirmarBorrado = async () => {
    setBorrando(true)
    try {
      await eliminarDispositivo(porBorrar.id)
      toast.success('Lector eliminado del sistema')
      setPorBorrar(null)
      lectores.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo eliminar el lector'))
    } finally {
      setBorrando(false)
    }
  }

  const items = lectores.data || []
  const enVivo = items.filter((d) => d.activo && d.escucha?.en_vivo).length
  const conProblema = items.filter((d) => d.activo && (!d.escucha?.en_vivo || d.ultimo_estado === 'ERROR')).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lectores biométricos"
        description="Los lectores de rostro de cada oficina: quién está dado de alta, quién entra y cómo está la conexión."
        icon={ScanFace}
        actions={<Button leftIcon={<Plus size={16} />} onClick={() => setEditando({})}>Agregar lector</Button>}
      />

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Resumen texto={`${items.length} lector(es)`} />
          <Resumen texto={`${enVivo} en tiempo real`} tono="emerald" />
          {conProblema > 0 && <Resumen texto={`${conProblema} requiere(n) atención`} tono="amber" />}
        </div>
      )}

      {lectores.loading && !items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
        </div>
      ) : lectores.error ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No se pudo cargar la lista"
            description={extractApiError(lectores.error, 'Intenta de nuevo en unos momentos.')}
            action={<Button variant="secondary" onClick={lectores.refetch}>Reintentar</Button>}
          />
        </Card>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={ScanFace}
            title="Todavía no hay lectores"
            description="Agrega el primer lector con su IP y credenciales. Puedes ponerle una foto y su ubicación para reconocerlo fácil."
            action={<Button leftIcon={<Plus size={16} />} onClick={() => setEditando({})}>Agregar lector</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => (
            <TarjetaLector
              key={d.id} lector={d}
              probando={probandoId === d.id}
              onProbar={() => probar(d)}
              onEditar={() => setEditando(d)}
              onEliminar={() => setPorBorrar(d)}
            />
          ))}
          <button
            type="button" onClick={() => setEditando({})}
            className="flex min-h-[18rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 focus-ring dark:border-ink-700 dark:text-ink-400 dark:hover:border-brand-500 dark:hover:bg-brand-900/20 dark:hover:text-brand-300"
          >
            <Plus size={28} />
            <span className="text-sm font-medium">Agregar otro lector</span>
          </button>
        </div>
      )}

      {editando !== null && (
        <FormularioLector
          lector={editando.id ? editando : null}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); lectores.refetch() }}
        />
      )}

      <ConfirmDialog
        open={porBorrar !== null}
        onClose={() => setPorBorrar(null)}
        onConfirm={confirmarBorrado}
        loading={borrando}
        title="Eliminar lector"
        // Se dice explícitamente: borrar la configuración NO vacía el equipo.
        // Quien ya esté dentro del lector seguirá pudiendo abrir la puerta.
        description={
          `Se eliminará "${porBorrar?.nombre}" del sistema. Los empleados que ya estén ` +
          'dados de alta EN EL LECTOR seguirán ahí y podrán seguir usándolo: quítalos ' +
          'antes desde su panel si esa no es tu intención.'
        }
        confirmLabel="Eliminar"
      />
    </div>
  )
}

function TarjetaLector({ lector: d, probando, onProbar, onEditar, onEliminar }) {
  const r = d.resumen || {}
  const enVivo = d.escucha?.en_vivo

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <Link to={`/lectores/${d.id}`} className="group relative block aspect-[16/9] overflow-hidden bg-ink-100 dark:bg-ink-800">
        {d.tiene_foto ? (
          <AuthImage
            src={rutaFotoLector(d.id, d.foto_version)} alt={`Foto de ${d.nombre}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={<SinFoto />}
          />
        ) : <SinFoto />}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          {!d.activo ? (
            <Badge tone="neutral">Desactivado</Badge>
          ) : enVivo ? (
            <Badge tone="success" dot className="shadow-sm">Tiempo real</Badge>
          ) : (
            <Badge tone="warning" dot className="shadow-sm">Sin tiempo real</Badge>
          )}
          {d.modelo && (
            <span className="rounded-md bg-black/50 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur">
              {d.modelo}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/lectores/${d.id}`} className="min-w-0 hover:underline">
          <h3 className="truncate text-base font-semibold text-ink-900 dark:text-ink-100">{d.nombre}</h3>
        </Link>
        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-500 dark:text-ink-400">
          <MapPin size={13} className="flex-shrink-0" />
          {d.ubicacion || <span className="italic">Sin ubicación</span>}
        </p>
        <p className="mt-1 truncate font-mono text-xs text-ink-400 dark:text-ink-500">
          {d.host}:{d.puerto}{d.firmware && ` · FW ${d.firmware}`}
        </p>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-ink-100 rounded-lg bg-ink-50 py-2 text-center dark:divide-ink-700 dark:bg-ink-800/50">
          <Cifra Icono={Users} etiqueta="Empleados" valor={r.empleados ?? 0} />
          <Cifra Icono={LogIn} etiqueta="Accesos hoy" valor={r.accesos_hoy ?? 0} />
          <Cifra Icono={Clock} etiqueta="Último"
                 valor={r.ultimo_acceso ? r.ultimo_acceso.hora.slice(11, 16) : '—'}
                 detalle={r.ultimo_acceso?.nombre} />
        </dl>

        {d.activo && !enVivo && d.escucha?.error && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <Radio size={13} className="mt-0.5 flex-shrink-0" /> {d.escucha.error}
          </p>
        )}
        {d.ultimo_estado === 'ERROR' && d.ultimo_error && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {d.ultimo_error}
          </p>
        )}
        {d.notas && (
          <p className="mt-3 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{d.notas}</p>
        )}

        <div className="mt-auto flex items-center gap-1 pt-4">
          <Link to={`/lectores/${d.id}`} className="flex-1">
            <Button size="sm" className="w-full" rightIcon={<ArrowRight size={14} />}>Abrir panel</Button>
          </Link>
          <Button size="icon-sm" variant="ghost" title="Probar conexión" aria-label="Probar conexión"
                  loading={probando} onClick={onProbar}>
            <Plug size={15} />
          </Button>
          <Button size="icon-sm" variant="ghost" title="Editar" aria-label="Editar" onClick={onEditar}>
            <Pencil size={15} />
          </Button>
          <Button size="icon-sm" variant="danger-ghost" title="Eliminar" aria-label="Eliminar"
                  onClick={onEliminar}>
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function SinFoto() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-ink-100 to-ink-200 text-ink-400 dark:from-ink-800 dark:to-ink-900 dark:text-ink-500">
      <ScanFace size={40} strokeWidth={1.25} />
      <span className="text-xs">Sin foto</span>
    </div>
  )
}

function Cifra({ Icono, etiqueta, valor, detalle }) {
  return (
    <div className="min-w-0 px-2">
      <dt className="flex items-center justify-center gap-1 text-[11px] text-ink-500 dark:text-ink-400">
        <Icono size={11} /> {etiqueta}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-100">{valor}</dd>
      {detalle && <dd className="truncate text-[10px] text-ink-500 dark:text-ink-400">{detalle}</dd>}
    </div>
  )
}

function Resumen({ texto, tono }) {
  const tonos = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tonos[tono] || 'bg-white text-ink-700 ring-ink-200 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700'}`}>
      {texto}
    </span>
  )
}
