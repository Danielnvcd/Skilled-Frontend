/**
 * Serie diaria de tráfico. Cifras EXACTAS: vienen de contadores que se
 * incrementan en toda petición, no de la muestra con detalle.
 */
import { Modal, Table, THead, TH, TBody, TR, TD, EmptyState } from '../../../components/ui'
import { CalendarDays } from 'lucide-react'
import { fmtNumero } from '../PanelLayout'

export default function ModalPorDia({ open, onClose, serie = [] }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actividad por día"
      description="Cifras exactas de los últimos días: se cuentan todas las peticiones, no una muestra."
      size="xl"
    >
      {serie.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin historial todavía"
          description="Los contadores diarios se acumulan conforme llega tráfico."
        />
      ) : (
        <Table>
          <THead>
            <TH>Día</TH>
            <TH align="right">Peticiones</TH>
            <TH align="right">Errores</TH>
            <TH align="right">Lentas</TH>
            <TH align="right">Tiempo medio</TH>
          </THead>
          <TBody>
            {[...serie].reverse().map((d) => (
              <TR key={d.fecha}>
                <TD className="whitespace-nowrap">
                  {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-MX', {
                    weekday: 'short', day: '2-digit', month: 'short',
                  })}
                </TD>
                <TD align="right" className="tabular-nums">{fmtNumero(d.total)}</TD>
                <TD align="right" className="tabular-nums">{d.errores || '—'}</TD>
                <TD align="right" className="tabular-nums">{d.lentas || '—'}</TD>
                <TD align="right" className="whitespace-nowrap tabular-nums">
                  {d.total ? `${d.ms_promedio} ms` : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Modal>
  )
}
