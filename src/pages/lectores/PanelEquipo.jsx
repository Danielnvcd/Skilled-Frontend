/**
 * Pestaña «Equipo» del lector: el hardware, su reloj, su capacidad, la puerta
 * y una auditoría de quién está dado de alta en él.
 *
 * La auditoría es la parte de seguridad: el lector también se administra desde
 * su propia pantalla y su web, así que alguien puede dar de alta a una persona
 * ahí, fuera del ERP, y esa persona abriría la puerta sin que nadie lo vea.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  Cpu, Clock, HardDrive, DoorOpen, ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, Trash2,
  Lock, Unlock,
} from 'lucide-react'
import { Button, Card, CardHeader, Skeleton, ConfirmDialog, Modal, Input } from '../../components/ui'
import { extractApiError } from '../../utils/apiError'
import {
  ajustarHoraLector, getAuditoria, borrarUsuarioAjeno, abrirPuerta, configurarNtp,
} from '../../api/hikvision'
import { describirDesfase } from './formato'
import TarjetaSalud from './TarjetaSalud'
import Estado from './Estado'

export default function PanelEquipo({ dispositivoId, dispositivo, estado, puerta, onCambioEmpleados }) {
  const [ajustando, setAjustando] = useState(false)
  const [ntpForm, setNtpForm] = useState(null)   // null = modal cerrado
  const [guardandoNtp, setGuardandoNtp] = useState(false)
  const [confirmarHora, setConfirmarHora] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [confirmarApertura, setConfirmarApertura] = useState(false)

  const [auditoria, setAuditoria] = useState(null)
  const [auditando, setAuditando] = useState(false)
  const [porBorrar, setPorBorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  const e = estado.data
  const activo = dispositivo?.activo !== false

  const ajustarHora = async () => {
    setAjustando(true)
    try {
      const r = await ajustarHoraLector(dispositivoId)
      toast.success(`Reloj del lector ajustado: ${formatoHora(r.hora.hora_local)}`)
      setConfirmarHora(false)
      estado.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo ajustar la hora'))
    } finally {
      setAjustando(false)
    }
  }

  const guardarNtp = async (ev) => {
    ev.preventDefault()
    setGuardandoNtp(true)
    try {
      await configurarNtp(dispositivoId, ntpForm.servidor.trim(), Number(ntpForm.intervalo) || 60)
      toast.success('NTP configurado: el reloj del lector se mantendrá en hora solo')
      setNtpForm(null)
      estado.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo configurar el NTP'))
    } finally {
      setGuardandoNtp(false)
    }
  }

  const abrir = async () => {
    setAbriendo(true)
    try {
      const r = await abrirPuerta(dispositivoId)
      toast.success(`Puerta abierta — el relé cierra durante ${r.segundos_apertura} s`)
      setConfirmarApertura(false)
      puerta.refetch()
      // Con la escucha activa el cierre llega solo por Socket.IO. Esto cubre
      // el caso en que no esté corriendo: se vuelve a mirar cuando el relé ya
      // debió cerrar.
      setTimeout(() => puerta.refetch(), ((r.segundos_apertura || 5) + 1) * 1000)
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo abrir la puerta'))
    } finally {
      setAbriendo(false)
    }
  }

  const auditar = async () => {
    setAuditando(true)
    try {
      setAuditoria(await getAuditoria(dispositivoId))
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo leer la lista de usuarios del lector'))
    } finally {
      setAuditando(false)
    }
  }

  const borrar = async () => {
    setBorrando(true)
    try {
      await borrarUsuarioAjeno(dispositivoId, porBorrar.employee_no)
      toast.success(`Se borró a ${porBorrar.nombre || porBorrar.employee_no} del lector`)
      setPorBorrar(null)
      await auditar()
      estado.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo borrar el usuario'))
    } finally {
      setBorrando(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Dispositivo ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><Cpu size={16} /> Dispositivo</span>}
          description="Lo que reporta el propio equipo."
          actions={
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={estado.refetch}>
              Actualizar
            </Button>
          }
        />
        {estado.loading ? <SkeletonFilas /> : estado.error ? (
          <ErrorCard error={estado.error} />
        ) : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2.5 text-sm">
            <Dato etiqueta="Modelo" valor={e.info.modelo} />
            <Dato etiqueta="Número de serie" valor={e.info.numero_serie} mono />
            <Dato etiqueta="Firmware" valor={e.info.firmware} mono />
            <Dato etiqueta="MAC" valor={e.info.mac} mono />
            <Dato etiqueta="Dirección" valor={`${dispositivo?.host}:${dispositivo?.puerto}`} mono />
            {e.red && (
              <>
                <dt className="text-ink-500 dark:text-ink-400">Tipo de IP</dt>
                <dd>
                  {e.red.direccionamiento === 'static'
                    ? <Estado tone="success">Fija</Estado>
                    : <Estado tone="warning">Dinámica ({e.red.direccionamiento}): puede cambiar</Estado>}
                </dd>
              </>
            )}
            <Dato etiqueta="Nombre en el equipo" valor={e.info.nombre_dispositivo} />
          </dl>
        )}
      </Card>

      {/* ── Reloj ───────────────────────────────────────────────────── */}
      <Card className="p-5">
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><Clock size={16} /> Reloj</span>}
          description="El lector sella cada acceso con su propia hora."
          actions={
            <Button
              size="sm" variant="secondary" disabled={!e || !activo}
              onClick={() => setConfirmarHora(true)}
            >
              Ajustar hora
            </Button>
          }
        />
        {estado.loading ? <SkeletonFilas /> : estado.error ? <ErrorCard error={estado.error} /> : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-3xl font-semibold tabular-nums text-ink-900 dark:text-ink-100">
                  {(e.hora.hora_local || '').slice(11, 19) || '—'}
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  {formatoFechaLarga(e.hora.hora_local)} · zona {e.hora.zona || '—'}
                </p>
              </div>
              {e.hora.en_hora ? (
                <Estado tone="success">En hora</Estado>
              ) : (
                <Estado tone="warning">Desajustado</Estado>
              )}
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300">
              {e.hora.desfase_segundos === null
                ? 'No se pudo comparar con la hora del servidor.'
                : `Diferencia con el servidor: ${describirDesfase(e.hora.desfase_segundos)}.`}
              {' '}Modo: {e.hora.modo === 'NTP' ? 'automático (NTP)' : 'manual'}.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-ink-50 px-3 py-2 text-xs dark:bg-ink-800/60">
              <span className="text-ink-600 dark:text-ink-300">
                {e.ntp?.servidor
                  ? <>NTP: <span className="font-mono">{e.ntp.servidor}</span> cada {e.ntp.intervalo_min} min</>
                  : 'Sin servidor NTP: el reloj solo se corrige a mano.'}
              </span>
              <Button size="xs" variant="secondary" disabled={!activo}
                      onClick={() => setNtpForm({ servidor: e.ntp?.servidor || '', intervalo: e.ntp?.intervalo_min || 60 })}>
                {e.ntp?.servidor ? 'Cambiar NTP' : 'Configurar NTP'}
              </Button>
            </div>
            {!e.hora.en_hora && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Con el reloj desajustado, las entradas y salidas quedan registradas a otra hora.
                Usa «Ajustar hora» para ponerlo en la hora del servidor.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Capacidad ───────────────────────────────────────────────── */}
      <Card className="p-5">
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><HardDrive size={16} /> Capacidad</span>}
          description="Registros usados contra el máximo que admite este modelo."
        />
        {estado.loading ? <SkeletonFilas /> : estado.error ? <ErrorCard error={estado.error} /> : (
          <div className="space-y-4">
            <Barra etiqueta="Usuarios" usado={e.capacidad.usuarios} maximo={e.capacidad.max_usuarios} />
            <Barra etiqueta="Rostros" usado={e.capacidad.con_rostro} maximo={e.capacidad.max_rostros} />
          </div>
        )}
      </Card>

      {/* ── Puerta ──────────────────────────────────────────────────── */}
      <Card className="p-5">
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><DoorOpen size={16} /> Puerta y relé</span>}
          description="Los empleados sincronizados abren solos al ser reconocidos."
          actions={
            <Button
              size="sm" variant="secondary" leftIcon={<DoorOpen size={14} />}
              disabled={!activo} onClick={() => setConfirmarApertura(true)}
            >
              Abrir puerta
            </Button>
          }
        />
        {puerta.loading ? <SkeletonFilas /> : !puerta.data?.ok ? (
          <ErrorCard error={puerta.error} texto="No se pudo leer el estado de la puerta." />
        ) : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2.5 text-sm">
            <dt className="text-ink-500 dark:text-ink-400">Cerradura</dt>
            <dd className="inline-flex items-center gap-1.5 font-medium text-ink-900 dark:text-ink-100">
              {puerta.data.estado.cerradura === 'Abierta'
                ? <Unlock size={14} className="text-amber-500" />
                : <Lock size={14} className="text-emerald-500" />}
              {puerta.data.estado.cerradura}
            </dd>
            <Dato etiqueta="Estado de la puerta" valor={puerta.data.estado.puerta} />
            <Dato etiqueta="Sensor magnético" valor={puerta.data.estado.magnetico} />
            <Dato etiqueta="Apertura por reconocimiento"
                  valor={`${puerta.data.parametros.segundos_apertura} s`} />
          </dl>
        )}
      </Card>

      {/* ── Salud de la conexión ────────────────────────────────────── */}
      <TarjetaSalud dispositivoId={dispositivoId} />

      {/* ── Auditoría ───────────────────────────────────────────────── */}
      <Card className="p-5 lg:col-span-2">
        <CardHeader
          title={<span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Auditoría de usuarios</span>}
          description="Compara quién está dado de alta en el lector contra lo que registró el ERP."
          actions={
            <Button size="sm" leftIcon={<ShieldCheck size={14} />} loading={auditando} onClick={auditar}>
              {auditoria ? 'Volver a revisar' : 'Revisar ahora'}
            </Button>
          }
        />
        {!auditoria ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Detecta personas dadas de alta directamente en el lector (desde su pantalla o su web),
            que pueden abrir la puerta sin que el ERP lo sepa, y empleados que el ERP cree
            sincronizados pero que el lector ya no tiene.
          </p>
        ) : !auditoria.solo_en_equipo.length && !auditoria.solo_en_erp.length ? (
          <div className="flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            <ShieldCheck size={18} />
            Todo coincide: los {auditoria.total_en_equipo} usuario(s) del lector fueron dados de alta desde el ERP.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ListaAuditoria
              titulo="En el lector, fuera del ERP"
              vacio="Ninguno."
              tono="danger"
              items={auditoria.solo_en_equipo}
              render={(u) => (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                      {u.nombre || 'Sin nombre'}
                      <span className="ml-2 font-mono text-xs text-ink-500">{u.employee_no}</span>
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {[u.rostros && 'rostro', u.tarjetas && 'tarjeta', u.huellas && 'huella']
                        .filter(Boolean).join(', ') || 'sin credenciales'}
                    </p>
                  </div>
                  <Button size="icon-sm" variant="danger-ghost" title="Borrar del lector"
                          aria-label="Borrar del lector" onClick={() => setPorBorrar(u)}>
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            />
            <ListaAuditoria
              titulo="En el ERP, ya no en el lector"
              vacio="Ninguno."
              tono="warning"
              pie={auditoria.solo_en_erp.length > 0 && (
                <Button size="xs" variant="secondary" onClick={onCambioEmpleados}>
                  Ir a Empleados para volver a sincronizarlos
                </Button>
              )}
              items={auditoria.solo_en_erp}
              render={(u) => (
                <p className="truncate text-sm text-ink-900 dark:text-ink-100">
                  {u.nombre}
                  <span className="ml-2 font-mono text-xs text-ink-500">{u.employee_no}</span>
                </p>
              )}
            />
          </div>
        )}
      </Card>

      <Modal
        open={ntpForm !== null}
        onClose={guardandoNtp ? () => {} : () => setNtpForm(null)}
        title="Sincronizar el reloj por NTP"
        description="El lector ajustará su hora solo, contra un servidor de hora de internet o de tu red."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNtpForm(null)} disabled={guardandoNtp}>Cancelar</Button>
            <Button onClick={guardarNtp} loading={guardandoNtp} disabled={!ntpForm?.servidor?.trim()}>Guardar</Button>
          </div>
        }
      >
        {ntpForm && (
          <form onSubmit={guardarNtp} className="space-y-4">
            <Input
              label="Servidor NTP"
              placeholder="216.239.35.0  o  time.google.com"
              value={ntpForm.servidor}
              onChange={(ev) => setNtpForm({ ...ntpForm, servidor: ev.target.value })}
              hint="Si el lector no tiene DNS configurado, usa una IP (la de tu router, o 216.239.35.0 de Google)."
              required
            />
            <Input
              label="Sincronizar cada (minutos)"
              type="number" min={1} max={10080}
              value={ntpForm.intervalo}
              onChange={(ev) => setNtpForm({ ...ntpForm, intervalo: ev.target.value })}
            />
            <p className="text-xs text-ink-500 dark:text-ink-400">
              El lector no permite probar el servidor antes de guardarlo. Si no logra
              sincronizar, el ERP lo detecta en la siguiente revisión del reloj (cada 30 min)
              y avisa a los administradores.
            </p>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmarHora}
        onClose={() => setConfirmarHora(false)}
        onConfirm={ajustarHora}
        loading={ajustando}
        title="Ajustar la hora del lector"
        description="El reloj del lector se pondrá en la hora del servidor, conservando su zona horaria. La acción queda en la bitácora."
        confirmLabel="Ajustar"
      />

      <ConfirmDialog
        open={confirmarApertura}
        onClose={() => setConfirmarApertura(false)}
        onConfirm={abrir}
        loading={abriendo}
        tone="warning"
        title="Abrir la puerta"
        // Se pide confirmación porque esto tiene efecto en el mundo físico:
        // la puerta se abre de verdad, sin que nadie se identifique.
        description={
          'La puerta se abrirá sin que nadie se identifique en el lector. ' +
          'La acción queda registrada en la bitácora con tu usuario.'
        }
        confirmLabel="Abrir"
      />

      <ConfirmDialog
        open={porBorrar !== null}
        onClose={() => setPorBorrar(null)}
        onConfirm={borrar}
        loading={borrando}
        title="Borrar del lector"
        description={
          `${porBorrar?.nombre || porBorrar?.employee_no} se eliminará del lector con sus ` +
          'credenciales (rostro, tarjeta, huella) y ya no podrá abrir la puerta.'
        }
        confirmLabel="Borrar"
      />
    </div>
  )
}

function Dato({ etiqueta, valor, mono = false }) {
  return (
    <>
      <dt className="text-ink-500 dark:text-ink-400">{etiqueta}</dt>
      <dd className={`truncate text-ink-900 dark:text-ink-100 ${mono ? 'font-mono text-xs leading-5' : 'font-medium'}`}>
        {valor || '—'}
      </dd>
    </>
  )
}

function Barra({ etiqueta, usado, maximo }) {
  const pct = maximo ? Math.min(100, (usado / maximo) * 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-brand-600 dark:bg-brand-500'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-ink-600 dark:text-ink-300">{etiqueta}</span>
        <span className="tabular-nums text-ink-900 dark:text-ink-100">
          <strong>{usado.toLocaleString('es-MX')}</strong>
          <span className="text-ink-500 dark:text-ink-400"> / {maximo ? maximo.toLocaleString('es-MX') : '—'}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
           role="progressbar" aria-valuenow={usado} aria-valuemin={0} aria-valuemax={maximo}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, usado ? 1 : 0)}%` }} />
      </div>
    </div>
  )
}

function ListaAuditoria({ titulo, items, render, vacio, tono, pie }) {
  return (
    <div className="rounded-lg ring-1 ring-ink-200 dark:ring-ink-700">
      <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2 dark:border-ink-800">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink-800 dark:text-ink-200">
          {items.length > 0 && <ShieldAlert size={14} className={tono === 'danger' ? 'text-red-500' : 'text-amber-500'} />}
          {titulo}
        </p>
        <span className={`text-sm font-semibold tabular-nums ${items.length ? (tono === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-ink-400'}`}>{items.length}</span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {items.map((u) => (
            <li key={u.employee_no} className="flex items-center gap-2 px-3 py-2">{render(u)}</li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-sm text-ink-500 dark:text-ink-400">{vacio}</p>
      )}
      {pie && <div className="border-t border-ink-100 px-3 py-2 dark:border-ink-800">{pie}</div>}
    </div>
  )
}

function SkeletonFilas() {
  return <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5 w-2/3" /></div>
}

function ErrorCard({ error, texto }) {
  return (
    <p className="inline-flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      {error ? extractApiError(error, texto || 'El lector no respondió.') : texto}
    </p>
  )
}

function formatoHora(iso) {
  return (iso || '').replace('T', ' ').slice(0, 19)
}

function formatoFechaLarga(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!a) return '—'
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
