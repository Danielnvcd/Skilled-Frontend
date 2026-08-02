/**
 * Detalle del pipeline de imágenes del catálogo hacia R2.
 *
 * Las que fallan no se reintentan solas ni avisan a nadie: esta vista existe
 * para sacarlas a la luz, por eso lista CUÁLES fallaron y con qué URL de origen
 * — sin eso solo sabrías que hay siete errores, no cuáles corregir.
 */
import { RotateCw, CheckCircle2 } from 'lucide-react'
import {
  Modal, Button, Badge, EmptyState, Table, THead, TH, TBody, TR, TD,
} from '../../../components/ui'
import { TarjetaDato as Tarjeta } from '../PanelLayout'

export default function ModalImagenes({ open, onClose, datos, onReintentar }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imágenes del catálogo"
      description="Se convierten a WebP y se suben a Cloudflare R2 en segundo plano. Las que fallan no se reintentan solas ni avisan: aquí es donde se ven."
      size="xl"
    >
      {datos && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta etiqueta="En error" valor={datos.total_error} tono={datos.total_error > 0 ? 'alerta' : undefined} />
            <Tarjeta etiqueta="Pendientes" valor={datos.total_pendiente} />
            <Tarjeta etiqueta="Productos OK" valor={datos.productos?.OK || 0} />
            <Tarjeta etiqueta="Categorías OK" valor={datos.categorias?.OK || 0} />
          </div>

          {datos.total_error > 0 ? (
            <>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCw size={14} />}
                  onClick={onReintentar}
                >
                  Reintentar {datos.total_error}
                </Button>
              </div>
              <Table>
                <THead>
                  <TH>Tipo</TH>
                  <TH>Elemento</TH>
                  <TH>Origen de la imagen</TH>
                </THead>
                <TBody>
                  {datos.fallidos.map((f) => (
                    <TR key={`${f.tipo}-${f.id}`}>
                      <TD><Badge tone="neutral">{f.tipo}</Badge></TD>
                      <TD>{f.nombre}</TD>
                      <TD>
                        <span
                          className="block max-w-[24rem] truncate font-mono text-xs text-ink-500 dark:text-ink-400"
                          title={f.imagen_url || ''}
                        >
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
        </div>
      )}
    </Modal>
  )
}
