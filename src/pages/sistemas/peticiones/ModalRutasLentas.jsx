/**
 * Rutas agregadas por tiempo de respuesta.
 *
 * Las rutas van NORMALIZADAS (`/api/users/<int:user_id>`), nunca la URL
 * concreta: este panel lo ve el rol `sistemas`, que a propósito no tiene acceso
 * a los datos de RRHH. Ver un id real aquí sería una fuga por la puerta de atrás.
 */
import { Gauge } from 'lucide-react'
import { Modal, Table, THead, TH, TBody, TR, TD, EmptyState } from '../../../components/ui'

export default function ModalRutasLentas({ open, onClose, porRuta = [], umbralMs }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rutas más lentas"
      description={`Agregado de la muestra reciente. Se registra siempre lo que falla y lo que tarda más de ${umbralMs ?? '—'} ms.`}
      size="xl"
    >
      {porRuta.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Sin datos de rutas"
          description="Todavía no hay suficiente tráfico registrado en la muestra."
        />
      ) : (
        <Table>
          <THead>
            <TH>Ruta</TH>
            <TH align="right">Veces</TH>
            <TH align="right">Errores</TH>
            <TH align="right">Media</TH>
            <TH align="right">Máx</TH>
          </THead>
          <TBody>
            {porRuta.map((f) => (
              <TR key={`${f.metodo}-${f.ruta}`}>
                <TD>
                  <span className="font-mono text-xs text-ink-500 dark:text-ink-400">{f.metodo}</span>{' '}
                  <span className="font-mono text-xs">{f.ruta}</span>
                </TD>
                <TD align="right" className="tabular-nums">{f.conteo}</TD>
                <TD align="right" className="tabular-nums">{f.errores || '—'}</TD>
                <TD align="right" className="whitespace-nowrap tabular-nums">{f.ms_promedio} ms</TD>
                <TD align="right" className="whitespace-nowrap tabular-nums">{f.ms_max} ms</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Modal>
  )
}
