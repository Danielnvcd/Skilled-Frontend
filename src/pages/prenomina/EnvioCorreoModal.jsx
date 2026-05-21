import { CheckCircle2, AlertCircle, MailX } from 'lucide-react'
import { Modal, Button } from '../../components/ui'

export default function EnvioCorreoModal({ open, onClose, resultado }) {
  if (!resultado) {
    return (
      <Modal open={open} onClose={onClose} title="Resultados del envío" size="lg" footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
        <p className="text-sm text-ink-500">Sin datos.</p>
      </Modal>
    )
  }
  const { enviados, sin_correo, errores, resultados } = resultado

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resultados del envío de recibos"
      description="Resumen del envío masivo por correo."
      size="lg"
      footer={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-md border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{enviados}</div>
          <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">Enviados</div>
        </div>
        <div className="rounded-md border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{sin_correo}</div>
          <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">Sin correo</div>
        </div>
        <div className="rounded-md border border-red-200 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20 p-3 text-center">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">{errores}</div>
          <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">Errores</div>
        </div>
      </div>

      <ul className="divide-y divide-ink-200 dark:divide-ink-800 border border-ink-200 dark:border-ink-800 rounded-md max-h-80 overflow-y-auto">
        {(resultados || []).map((r, i) => {
          let Icon = CheckCircle2, color = 'text-emerald-600 dark:text-emerald-400'
          if (r.estado === 'sin_correo') { Icon = MailX; color = 'text-amber-600 dark:text-amber-400' }
          if (r.estado === 'error') { Icon = AlertCircle; color = 'text-red-600 dark:text-red-400' }
          return (
            <li key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
              <Icon size={14} className={`mt-0.5 flex-shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 dark:text-ink-100 truncate">{r.nombre}</div>
                <div className="text-xs text-ink-500 truncate">{r.correo}</div>
                {r.detalle && <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">{r.detalle}</div>}
              </div>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
