/**
 * Lectores — alta y administración de los lectores biométricos Hikvision.
 *
 * Un lector por oficina; el diseño NO asume que solo habrá uno.
 *
 * Tabla compacta: miniatura del equipo, ubicación, dirección, estado de la
 * conexión en tiempo real y cifras del día (empleados, accesos, último
 * acceso). Todo sale de la base del ERP: abrir esta lista no le pregunta nada
 * a ningún lector.
 *
 * La contraseña se captura aquí pero nunca vuelve del servidor: al editar, el
 * campo aparece vacío y dejarlo así significa «no la cambies».
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScanFace, Plug, Plus, Pencil, Trash2, AlertTriangle, MapPin, ChevronRight } from 'lucide-react'
import {
  PageHeader, Button, Card, EmptyState, Skeleton, ConfirmDialog, AuthImage,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'
import {
  getDispositivos, eliminarDispositivo, probarDispositivo, rutaFotoLector,
} from '../../api/hikvision'
import FormularioLector from './FormularioLector'
import Estado from './Estado'

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
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo conectar con el lector'))
    } finally {
      setProbandoId(null)
      lectores.refetch()
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lectores biométricos"
        description={items.length
          ? `${items.length} lector(es) · ${enVivo} en tiempo real`
          : 'Lectores de rostro de cada oficina.'}
        icon={ScanFace}
        actions={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setEditando({})}>Agregar lector</Button>}
      />

      {lectores.loading && !items.length ? (
        <Card className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></Card>
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
            description="Agrega el primer lector con su IP y credenciales."
            action={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setEditando({})}>Agregar lector</Button>}
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <TH>Lector</TH>
            <TH>Dirección</TH>
            <TH>Estado</TH>
            <TH align="right">Empleados</TH>
            <TH align="right">Accesos hoy</TH>
            <TH>Último acceso</TH>
            <TH align="right"><span className="sr-only">Acciones</span></TH>
            <TH align="right"><span className="sr-only">Abrir</span></TH>
          </THead>
          <TBody>
            {items.map((d) => (
              <FilaLector
                key={d.id} lector={d}
                probando={probandoId === d.id}
                onProbar={() => probar(d)}
                onEditar={() => setEditando(d)}
                onEliminar={() => setPorBorrar(d)}
              />
            ))}
          </TBody>
        </Table>
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

// Un solo estado por fila, lo más grave primero. La franja izquierda y la
// etiqueta usan el mismo color para que la fila se distinga de un vistazo.
function estadoDe(d) {
  if (!d.activo) return { tono: 'neutral', texto: 'Desactivado', franja: 'border-l-ink-300 dark:border-l-ink-600' }
  if (d.ultimo_estado === 'ERROR') {
    return { tono: 'danger', texto: 'Error', detalle: d.ultimo_error, franja: 'border-l-red-500' }
  }
  if (!d.escucha?.en_vivo) {
    return { tono: 'warning', texto: 'Sin tiempo real', detalle: d.escucha?.error, franja: 'border-l-amber-500' }
  }
  return { tono: 'success', texto: 'Tiempo real', franja: 'border-l-emerald-500' }
}

function FilaLector({ lector: d, probando, onProbar, onEditar, onEliminar }) {
  const r = d.resumen || {}
  const estado = estadoDe(d)
  const navigate = useNavigate()
  const url = `/lectores/${d.id}`
  // Toda la fila lleva al panel del lector; los botones de acción detienen el
  // clic para no navegar al usarlos.
  const soloAccion = (fn) => (e) => { e.stopPropagation(); fn() }
  return (
    <TR className={`cursor-pointer ${d.activo ? '' : 'opacity-60'}`} onClick={() => navigate(url)}>
      <TD className={`border-l-[3px] py-2.5 ${estado.franja}`}>
        <div className="flex items-center gap-3">
          <Miniatura lector={d} />
          <div className="min-w-0">
            <Link to={url} onClick={(e) => e.stopPropagation()}
                  className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700 hover:underline dark:text-ink-50 dark:hover:text-brand-300">
              {d.nombre}
            </Link>
            <p className="flex items-center gap-1 truncate text-xs text-ink-500 dark:text-ink-400">
              {d.ubicacion
                ? <><MapPin size={11} className="flex-shrink-0" />{d.ubicacion}</>
                : (d.modelo || '—')}
            </p>
          </div>
        </div>
      </TD>
      <TD className="py-2.5">
        <span className="font-mono text-xs text-ink-800 dark:text-ink-200">{d.host}:{d.puerto}</span>
        {d.firmware && <p className="text-[11px] text-ink-400 dark:text-ink-500">{d.firmware}</p>}
      </TD>
      <TD className="py-2.5">
        <Estado tono={estado.tono} title={estado.detalle || undefined}>{estado.texto}</Estado>
      </TD>
      <TD className="py-2.5" align="right"><Numero valor={r.empleados} /></TD>
      <TD className="py-2.5" align="right"><Numero valor={r.accesos_hoy} /></TD>
      <TD className="py-2.5">
        {r.ultimo_acceso ? (
          <>
            <span className="font-medium tabular-nums text-ink-900 dark:text-ink-100">
              {r.ultimo_acceso.hora.slice(11, 16)}
            </span>
            <p className="max-w-[10rem] truncate text-[11px] text-ink-500 dark:text-ink-400">
              {r.ultimo_acceso.nombre}
            </p>
          </>
        ) : <span className="text-ink-300 dark:text-ink-600">—</span>}
      </TD>
      <TD className="py-2.5" align="right">
        <div className="flex justify-end gap-0.5">
          <Button size="icon-sm" variant="ghost" title="Probar conexión" aria-label="Probar conexión"
                  loading={probando} onClick={soloAccion(onProbar)}>
            <Plug size={14} />
          </Button>
          <Button size="icon-sm" variant="ghost" title="Editar" aria-label="Editar"
                  onClick={soloAccion(onEditar)}>
            <Pencil size={14} />
          </Button>
          <Button size="icon-sm" variant="danger-ghost" title="Eliminar" aria-label="Eliminar"
                  onClick={soloAccion(onEliminar)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </TD>
      <TD className="py-2.5 pl-0" align="right">
        <Link to={url} onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-ring dark:border-ink-700 dark:text-ink-200 dark:hover:border-brand-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-200">
          Abrir panel <ChevronRight size={14} />
        </Link>
      </TD>
    </TR>
  )
}

// Los ceros en gris: así resaltan las cifras que sí dicen algo.
function Numero({ valor }) {
  const n = valor ?? 0
  return (
    <span className={`tabular-nums ${n ? 'font-semibold text-ink-900 dark:text-ink-100' : 'text-ink-300 dark:text-ink-600'}`}>
      {n}
    </span>
  )
}

function Miniatura({ lector: d }) {
  const vacio = (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-400 ring-1 ring-ink-200 dark:bg-ink-800 dark:ring-ink-700">
      <ScanFace size={18} />
    </span>
  )
  if (!d.tiene_foto) return vacio
  return (
    <AuthImage
      src={rutaFotoLector(d.id, d.foto_version)} alt=""
      className="h-10 w-10 flex-shrink-0 rounded-md object-cover ring-1 ring-ink-200 dark:ring-ink-700"
      fallback={vacio}
    />
  )
}
