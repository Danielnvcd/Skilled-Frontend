import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar acción',
  description = '¿Estás seguro?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      hideHeader
      bodyClassName="!p-0"
    >
      <div className="px-6 pt-6 pb-2 flex gap-4">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          tone === 'danger'
            ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          <AlertTriangle size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">{title}</h3>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{description}</p>
        </div>
      </div>
      <div className="px-6 py-4 mt-4 bg-ink-50/50 dark:bg-ink-950/40 border-t border-ink-200 dark:border-ink-800 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
