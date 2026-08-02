/**
 * Mantenimiento: crecimiento de las tablas, purga de bitácora, imágenes del
 * catálogo a R2 y archivos privados a R2.
 *
 * La purga y el reintento de imágenes son las únicas acciones del panel que
 * modifican datos de forma irreversible, así que ambas piden confirmación
 * explicando qué va a pasar — no un "¿estás seguro?" genérico. Sincronizar
 * archivos NO la pide: solo copia a la nube, no borra nada y es idempotente.
 */
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  DatabaseZap, RefreshCw, Database, ImageOff, Trash2, RotateCw, CheckCircle2,
  CloudUpload, FileWarning,
} from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, ConfirmDialog, Select,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import {
  getAlmacenamiento, purgarBitacora, getImagenes, reintentarImagenes,
  getArchivos, sincronizarArchivos,
} from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import { useSocket } from '../../context/SocketContext'
import { EstadoCarga, useRefrescar, BotonActualizar } from './PanelLayout'

function fmtNumero(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-MX').format(n)
}

export default function Mantenimiento() {
  const almacen = useResource('sistemas:almacenamiento', getAlmacenamiento, { staleMs: 60_000 })
  const imagenes = useResource('sistemas:imagenes', getImagenes, { staleMs: 30_000 })
  const archivos = useResource('sistemas:archivos', getArchivos, { staleMs: 30_000 })

  const { refrescando, refrescar } = useRefrescar(
    almacen.refetch, imagenes.refetch, archivos.refetch,
  )

  const [mesesPurga, setMesesPurga] = useState(12)
  const [confirmPurga, setConfirmPurga] = useState(false)
  const [confirmReintento, setConfirmReintento] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const ejecutarPurga = async () => {
    setEnviando(true)
    try {
      const res = await purgarBitacora(mesesPurga)
      toast.success(
        res.borrados
          ? `${fmtNumero(res.borrados)} entradas eliminadas`
          : 'No había entradas anteriores a esa fecha',
      )
      setConfirmPurga(false)
      almacen.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudo purgar la bitácora'))
    } finally {
      setEnviando(false)
    }
  }

  const ejecutarReintento = async () => {
    setEnviando(true)
    try {
      const res = await reintentarImagenes()
      toast.success(
        res.reencoladas
          ? `${res.reencoladas} imágenes reencoladas`
          : 'No hay imágenes en error',
      )
      setConfirmReintento(false)
      imagenes.refetch()
    } catch (err) {
      toast.error(extractApiError(err, 'No se pudieron reencolar las imágenes'))
    } finally {
      setEnviando(false)
    }
  }

  // ── Sincronización de archivos privados a R2 ──────────────────────────────
  // Mismo patrón que el pipeline de imágenes del catálogo: la petición solo
  // encola, y el progreso real llega por socket al usuario que lo lanzó.
  const { on } = useSocket()
  const [progreso, setProgreso] = useState(null)   // { total, hechas, ok, error, estado, actual }
  const [sincronizando, setSincronizando] = useState(false)
  // Job lanzado por ESTA pantalla; en ref para que el listener lea el valor
  // actual sin volver a suscribirse. Ignoramos eventos de otros trabajos para
  // que la barra no salte entre ellos.
  const jobIdRef = useRef(null)

  useEffect(() => {
    const off = on('archivo:sync_progreso', (p) => {
      if (!jobIdRef.current || p?.job_id !== jobIdRef.current) return
      setProgreso(p)
      if (p?.estado === 'done') {
        jobIdRef.current = null
        archivos.refetch()
        if (p.error > 0) {
          toast(`${p.error} archivo(s) no se pudieron subir. Vuelve a sincronizar para reintentar.`, {
            icon: <FileWarning size={18} />, duration: 7000,
          })
        }
      }
    })
    return off
  }, [on])   // eslint-disable-line react-hooks/exhaustive-deps

  const ejecutarSyncArchivos = async () => {
    setSincronizando(true)
    try {
      const res = await sincronizarArchivos()
      if (res.encolados > 0) {
        jobIdRef.current = res.job_id || null
        setProgreso({ total: res.encolados, hechas: 0, ok: 0, error: 0, estado: 'running', actual: null })
        toast.success(`Subiendo ${res.encolados} archivo(s) a R2…`)
        if (res.restantes > 0) {
          toast(`Quedan ${res.restantes} para la próxima corrida.`, { duration: 6000 })
        }
      } else {
        toast.success('Todos los archivos ya están en R2')
      }
    } catch (err) {
      // 409: otro administrador ya la lanzó. No es un fallo — se informa y se
      // refresca para que se vean los conteos que esa corrida vaya dejando.
      if (err?.response?.status === 409) {
        toast(extractApiError(err, 'Ya hay una sincronización en curso'))
        archivos.refetch()
      } else {
        toast.error(extractApiError(err, 'No se pudo iniciar la sincronización'))
      }
    } finally {
      setSincronizando(false)
    }
  }

  const datosImg = imagenes.data
  const datosArch = archivos.data
  const pctArch = progreso?.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mantenimiento"
        description="Crecimiento de la base de datos, procesado de imágenes y archivos en la nube."
        icon={DatabaseZap}
        actions={
          <BotonActualizar onClick={refrescar} refrescando={refrescando} ruta="/sistemas/almacenamiento" />
        }
      />

      {/* ── Almacenamiento ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
            <Database size={16} className="text-ink-400" />
            Tablas que crecen sin límite
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            Estas tablas suman una fila por evento y nada las poda. El resto crece con
            el negocio y se autolimita.
          </p>
        </div>

        <EstadoCarga
          error={almacen.error}
          loading={almacen.loading}
          skeleton={<Skeleton className="h-40" />}
        >
          {almacen.data && (
            <>
              <Table>
                <THead>
                  <TH>Tabla</TH>
                  <TH align="right">Filas</TH>
                  <TH align="right">Tamaño</TH>
                </THead>
                <TBody>
                  {almacen.data.tablas.map((t) => (
                    <TR key={t.tabla}>
                      <TD>
                        <span className="font-medium">{t.etiqueta}</span>
                        <span className="ml-2 font-mono text-xs text-ink-500 dark:text-ink-400">
                          {t.tabla}
                        </span>
                      </TD>
                      <TD align="right" className="tabular-nums">{fmtNumero(t.filas)}</TD>
                      <TD align="right" className="whitespace-nowrap tabular-nums">
                        {t.tamano || '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {!almacen.data.tamano_disponible && (
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  El tamaño en disco solo está disponible en PostgreSQL
                  (motor actual: {almacen.data.motor}).
                </p>
              )}

              <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
                <h3 className="text-sm font-medium text-ink-900 dark:text-ink-100">
                  Purgar bitácora antigua
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                  Elimina entradas anteriores al periodo elegido.{' '}
                  {almacen.data.bitacora_desde && (
                    <>
                      El registro más antiguo es del{' '}
                      <strong className="font-medium">
                        {new Date(almacen.data.bitacora_desde).toLocaleDateString('es-MX')}
                      </strong>.{' '}
                    </>
                  )}
                  Es irreversible, y por eso no se permite tocar los últimos 3 meses:
                  son los que sirven para investigar un incidente.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Select
                    label="Conservar"
                    value={String(mesesPurga)}
                    onChange={(e) => setMesesPurga(Number(e.target.value))}
                    wrapperClassName="w-48"
                  >
                    <option value="6">Últimos 6 meses</option>
                    <option value="12">Últimos 12 meses</option>
                    <option value="24">Últimos 24 meses</option>
                  </Select>
                  <Button
                    variant="danger"
                    size="md"
                    leftIcon={<Trash2 size={15} />}
                    onClick={() => setConfirmPurga(true)}
                  >
                    Purgar
                  </Button>
                </div>
              </div>
            </>
          )}
        </EstadoCarga>
      </section>

      {/* ── Imágenes a R2 ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
            <ImageOff size={16} className="text-ink-400" />
            Procesado de imágenes
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            Las imágenes de productos y categorías se convierten a WebP y se suben a
            Cloudflare R2 en segundo plano. Las que fallan no se reintentan solas ni
            avisan: aquí es donde se ven.
          </p>
        </div>

        <EstadoCarga
          error={imagenes.error}
          loading={imagenes.loading}
          skeleton={<Skeleton className="h-32" />}
        >
          {datosImg && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tarjeta etiqueta="En error" valor={datosImg.total_error} alerta={datosImg.total_error > 0} />
                <Tarjeta etiqueta="Pendientes" valor={datosImg.total_pendiente} />
                <Tarjeta etiqueta="Productos OK" valor={datosImg.productos?.OK || 0} />
                <Tarjeta etiqueta="Categorías OK" valor={datosImg.categorias?.OK || 0} />
              </div>

              {datosImg.total_error > 0 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<RotateCw size={14} />}
                      onClick={() => setConfirmReintento(true)}
                    >
                      Reintentar {datosImg.total_error}
                    </Button>
                  </div>
                  <Table>
                    <THead>
                      <TH>Tipo</TH>
                      <TH>Elemento</TH>
                      <TH>Origen de la imagen</TH>
                    </THead>
                    <TBody>
                      {datosImg.fallidos.map((f) => (
                        <TR key={`${f.tipo}-${f.id}`}>
                          <TD>
                            <Badge tone="neutral">{f.tipo}</Badge>
                          </TD>
                          <TD>{f.nombre}</TD>
                          <TD>
                            <span className="block max-w-[24rem] truncate font-mono text-xs text-ink-500 dark:text-ink-400"
                                  title={f.imagen_url || ''}>
                              {f.imagen_url || '—'}
                            </span>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin imágenes en error"
                  description="Todas las imágenes se procesaron correctamente."
                />
              )}
            </>
          )}
        </EstadoCarga>
      </section>

      {/* ── Archivos privados a R2 ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
            <CloudUpload size={16} className="text-ink-400" />
            Archivos privados en la nube
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            Fotos de perfil, documentos de trabajadores y fotos de herramientas. Van a
            un bucket <strong className="font-medium">privado</strong> de Cloudflare R2,
            distinto al del catálogo: se siguen sirviendo con sesión iniciada, nadie los
            abre con solo tener el enlace.
          </p>
        </div>

        <EstadoCarga
          error={archivos.error}
          loading={archivos.loading}
          skeleton={<Skeleton className="h-32" />}
        >
          {datosArch && !datosArch.enabled && (
            <EmptyState
              icon={CloudUpload}
              title="Almacenamiento en la nube sin configurar"
              description="Los archivos se están guardando en el disco del servidor y la aplicación funciona con normalidad. Para activarlo, define R2_PRIVADO_BUCKET en el .env de este entorno."
            />
          )}

          {datosArch?.enabled && datosArch.error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
                <FileWarning size={15} className="text-red-600 dark:text-red-400" />
                No se puede contactar el bucket privado
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                {datosArch.error}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                Mientras tanto los archivos se guardan y se sirven desde el disco del
                servidor: la aplicación funciona con normalidad y no se pierde nada.
              </p>
            </div>
          )}

          {datosArch?.enabled && !datosArch.error && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tarjeta etiqueta="En la nube" valor={datosArch.en_r2} />
                <Tarjeta etiqueta="Por subir" valor={datosArch.pendientes} />
                <Tarjeta etiqueta="Sin archivo" valor={datosArch.faltantes} alerta={datosArch.faltantes > 0} />
                <Tarjeta etiqueta="Total" valor={datosArch.total} />
              </div>

              {progreso && (
                <div className="space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div
                      className={`h-full transition-all duration-300 ${progreso.estado === 'done' ? 'bg-emerald-500' : 'bg-brand-600'}`}
                      style={{ width: `${pctArch}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                    <span className="truncate">
                      {progreso.estado === 'done'
                        ? `Listo · ${progreso.ok} subido(s)${progreso.error ? `, ${progreso.error} con error` : ''}`
                        : `Subiendo ${progreso.hechas}/${progreso.total}${progreso.actual ? ` · ${progreso.actual}` : ''}`}
                    </span>
                    <span className="ml-2 flex-shrink-0 tabular-nums">{pctArch}%</span>
                  </div>
                </div>
              )}

              {datosArch.pendientes > 0 ? (
                <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
                  <h3 className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    Subir los que faltan
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                    {fmtNumero(datosArch.pendientes)} archivo(s) siguen solo en el disco del
                    servidor. Subirlos no borra la copia local ni interrumpe la aplicación:
                    mientras tanto se siguen sirviendo desde el disco. Repetir la operación
                    es seguro.
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />}
                      loading={sincronizando}
                      disabled={progreso?.estado === 'running'}
                      onClick={ejecutarSyncArchivos}
                    >
                      Sincronizar {fmtNumero(datosArch.pendientes)}
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Todo sincronizado"
                  description="Cada archivo referenciado por la base de datos ya está en la nube."
                />
              )}

              <Table>
                <THead>
                  <TH>Tipo de archivo</TH>
                  <TH align="right">En la nube</TH>
                  <TH align="right">Por subir</TH>
                  <TH align="right">Sin archivo</TH>
                </THead>
                <TBody>
                  {datosArch.familias.map((f) => (
                    <TR key={f.clave}>
                      <TD><span className="font-medium">{f.etiqueta}</span></TD>
                      <TD align="right" className="tabular-nums">{fmtNumero(f.en_r2)}</TD>
                      <TD align="right" className="tabular-nums">{fmtNumero(f.pendientes)}</TD>
                      <TD align="right" className="tabular-nums">{fmtNumero(f.faltantes)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {datosArch.faltantes > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
                    <FileWarning size={15} className="text-amber-600 dark:text-amber-400" />
                    {fmtNumero(datosArch.faltantes)} referencia(s) sin archivo
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                    La base de datos apunta a estos archivos pero no están ni en la nube ni
                    en el disco. Es dato roto de antes de la migración, no lo causa
                    sincronizar. Se corrigen volviendo a subir el archivo desde su pantalla.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {datosArch.detalle_faltantes.map((f) => (
                      <li key={f.key} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone="neutral">{f.familia}</Badge>
                        <span className="truncate font-mono text-ink-500 dark:text-ink-400" title={f.key}>
                          {f.key}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </EstadoCarga>
      </section>

      <ConfirmDialog
        open={confirmPurga}
        onClose={() => setConfirmPurga(false)}
        onConfirm={ejecutarPurga}
        loading={enviando}
        title="¿Purgar la bitácora?"
        description={`Se eliminarán de forma irreversible las entradas con más de ${mesesPurga} meses. La purga queda registrada en la propia bitácora con tu nombre.`}
        confirmLabel="Purgar"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmReintento}
        onClose={() => setConfirmReintento(false)}
        onConfirm={ejecutarReintento}
        loading={enviando}
        title="¿Reintentar las imágenes en error?"
        description="Se vuelven a encolar para procesarse en segundo plano. No bloquea la aplicación; el resultado tarda unos minutos en reflejarse."
        confirmLabel="Reintentar"
        tone="default"
      />
    </div>
  )
}

function Tarjeta({ etiqueta, valor, alerta }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        alerta
          ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
          : 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900'
      }`}
    >
      <p className="text-xs text-ink-500 dark:text-ink-400">{etiqueta}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-100">
        {valor ?? 0}
      </p>
    </div>
  )
}
