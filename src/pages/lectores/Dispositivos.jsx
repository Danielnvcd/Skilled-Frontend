/**
 * Lectores — alta y administración de los lectores biométricos Hikvision.
 *
 * Un lector por oficina; el diseño NO asume que solo habrá uno.
 *
 * La contraseña se captura aquí pero nunca vuelve del servidor: al editar, el
 * campo aparece vacío y dejarlo así significa «no la cambies». Se dice en la
 * propia etiqueta porque un campo de contraseña vacío en un formulario de
 * edición se interpreta, si no, como que se va a borrar.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ScanFace, Plug, Plus, Pencil, Trash2, Users, AlertTriangle } from 'lucide-react'
import {
  PageHeader, Button, Card, Modal, Input, Badge, EmptyState, Skeleton, ConfirmDialog,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { extractApiError } from '../../utils/apiError'
import {
  getDispositivos, crearDispositivo, actualizarDispositivo,
  eliminarDispositivo, probarDispositivo,
} from '../../api/hikvision'

const FORM_VACIO = { nombre: '', host: '', puerto: 80, usuario: '', password: '', activo: true }

export default function Dispositivos() {
  const lectores = useResource('hikvision:dispositivos', getDispositivos, {
    staleMs: 15_000,
    invalidateOn: ['hikvision:changed'],
  })

  const [form, setForm] = useState(null)      // null = modal cerrado
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [probandoId, setProbandoId] = useState(null)
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const abrirAlta = () => { setEditandoId(null); setForm({ ...FORM_VACIO }) }
  const abrirEdicion = (d) => {
    setEditandoId(d.id)
    // `password` va vacía a propósito: el servidor no la devuelve.
    setForm({
      nombre: d.nombre, host: d.host, puerto: d.puerto,
      usuario: d.usuario, password: '', activo: d.activo,
    })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      if (editandoId) {
        await actualizarDispositivo(editandoId, form)
        toast.success('Lector actualizado')
      } else {
        await crearDispositivo(form)
        toast.success('Lector agregado')
      }
      setForm(null)
      lectores.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo guardar el lector'))
    } finally {
      setGuardando(false)
    }
  }

  const probar = async (d) => {
    setProbandoId(d.id)
    try {
      const r = await probarDispositivo(d.id)
      toast.success(`${r.info.modelo} — firmware ${r.info.firmware}`)
      // El reloj del equipo se avisa aparte: con la hora mal, las checadas de
      // la futura fase de asistencia quedarían inservibles, y es el tipo de
      // problema que no se nota hasta que ya hay datos malos.
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lectores biométricos"
        description="Lectores Hikvision por oficina y los empleados que se sincronizan con cada uno."
        icon={ScanFace}
        actions={<Button leftIcon={<Plus size={16} />} onClick={abrirAlta}>Agregar lector</Button>}
      />

      {lectores.loading && !items.length ? (
        <div className="space-y-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
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
            description="Agrega el primer lector con su IP y credenciales para empezar a sincronizar empleados."
            action={<Button leftIcon={<Plus size={16} />} onClick={abrirAlta}>Agregar lector</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900 dark:text-ink-100 truncate">{d.nombre}</h3>
                    {!d.activo && <Badge tone="neutral">Desactivado</Badge>}
                    {d.ultimo_estado === 'OK' && <Badge tone="success" dot>En línea</Badge>}
                    {d.ultimo_estado === 'ERROR' && <Badge tone="danger" dot>Con error</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400 font-mono">
                    {d.host}:{d.puerto}
                  </p>
                  {d.modelo && (
                    <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                      {d.modelo} · firmware {d.firmware}
                    </p>
                  )}
                  {d.ultimo_estado === 'ERROR' && d.ultimo_error && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{d.ultimo_error}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm" variant="secondary" leftIcon={<Plug size={14} />}
                  loading={probandoId === d.id} onClick={() => probar(d)}
                >
                  Probar conexión
                </Button>
                <Link to={`/lectores/${d.id}`}>
                  <Button size="sm" variant="secondary" leftIcon={<Users size={14} />}>
                    Empleados
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" leftIcon={<Pencil size={14} />}
                        onClick={() => abrirEdicion(d)}>
                  Editar
                </Button>
                <Button size="sm" variant="danger-ghost" leftIcon={<Trash2 size={14} />}
                        onClick={() => setPorBorrar(d)}>
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={editandoId ? 'Editar lector' : 'Agregar lector'}
        description="El lector debe estar en la red local de la empresa."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
            <Button type="submit" form="form-lector" loading={guardando}>Guardar</Button>
          </div>
        }
      >
        {form && (
          <form id="form-lector" onSubmit={guardar} className="space-y-4">
            <Input
              label="Nombre" value={form.nombre} required maxLength={120}
              placeholder="Lector Oficina Puebla"
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Dirección IP" value={form.host} required maxLength={120}
                  placeholder="192.168.1.159"
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </div>
              <Input
                label="Puerto" type="number" value={form.puerto} required min={1} max={65535}
                onChange={(e) => setForm({ ...form, puerto: Number(e.target.value) })}
              />
            </div>
            <Input
              label="Usuario" value={form.usuario} required maxLength={64}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, usuario: e.target.value })}
            />
            <Input
              label={editandoId ? 'Contraseña (déjala vacía para no cambiarla)' : 'Contraseña'}
              type="password" value={form.password} required={!editandoId} maxLength={200}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
              <input
                type="checkbox" checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="rounded border-ink-300 dark:border-ink-600"
              />
              Lector activo
            </label>
          </form>
        )}
      </Modal>

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
          'antes desde "Empleados" si esa no es tu intención.'
        }
        confirmLabel="Eliminar"
      />
    </div>
  )
}
