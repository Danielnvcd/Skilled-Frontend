/**
 * Mantenimiento: crecimiento de las tablas, purga de bitácora e imágenes a R2.
 *
 * Las dos acciones de esta pantalla son las únicas del panel que modifican
 * datos de forma irreversible, así que ambas piden confirmación explicando qué
 * va a pasar — no un "¿estás seguro?" genérico.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  Wrench, RefreshCw, Database, ImageOff, Trash2, RotateCw, CheckCircle2,
} from 'lucide-react'
import {
  PageHeader, Button, Skeleton, Badge, EmptyState, ConfirmDialog, Select,
  Table, THead, TH, TBody, TR, TD,
} from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import {
  getAlmacenamiento, purgarBitacora, getImagenes, reintentarImagenes,
} from '../../api/sistemas'
import { extractApiError } from '../../utils/apiError'
import { EstadoCarga, useRefrescar, BotonActualizar } from './PanelLayout'

function fmtNumero(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-MX').format(n)
}

export default function Mantenimiento() {
  const almacen = useResource('sistemas:almacenamiento', getAlmacenamiento, { staleMs: 60_000 })
  const imagenes = useResource('sistemas:imagenes', getImagenes, { staleMs: 30_000 })

  const { refrescando, refrescar } = useRefrescar(almacen.refetch, imagenes.refetch)

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

  const datosImg = imagenes.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mantenimiento"
        description="Crecimiento de la base de datos y estado del procesado de imágenes."
        icon={Wrench}
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
