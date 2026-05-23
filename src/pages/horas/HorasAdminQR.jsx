import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  QrCode, Search, RefreshCcw, Printer, Eye, Download,
} from 'lucide-react'
import {
  PageHeader, Input, Table, THead, TH, TBody, TR, TD, Button, Badge,
  EmptyState, Skeleton, ConfirmDialog, Modal,
} from '../../components/ui'
import {
  listarTrabajadoresQR, generarQR, descargarImagenQR,
} from '../../api/horas'

function QrThumb({ qrCode }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!qrCode) return
    let revoked = false
    let url = null
    descargarImagenQR(qrCode)
      .then((u) => {
        if (revoked) { URL.revokeObjectURL(u); return }
        url = u
        setSrc(u)
      })
      .catch(() => {})
    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [qrCode])
  if (!qrCode) return <span className="text-xs text-ink-400 italic">Sin QR</span>
  if (!src) return <div className="h-12 w-12 bg-ink-100 dark:bg-ink-800 rounded animate-pulse" />
  return (
    <img
      src={src}
      alt="QR"
      className="h-12 w-12 rounded border border-ink-200 dark:border-ink-700 object-contain bg-white"
    />
  )
}

function QrModal({ open, trabajador, qrCode, onClose }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!open || !qrCode) return
    let revoked = false
    let url = null
    descargarImagenQR(qrCode)
      .then((u) => { if (revoked) { URL.revokeObjectURL(u); return } url = u; setSrc(u) })
      .catch(() => {})
    return () => {
      revoked = true
      setSrc(null)
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, qrCode])

  const onPrint = () => {
    const w = window.open('', '_blank', 'width=600,height=700')
    if (!w) { toast.error('Pop-up bloqueado.'); return }
    w.document.write(`<!doctype html><html><head><title>QR ${trabajador?.no_empleado || ''}</title>
      <style>
        body { font-family: Inter, sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 1.2rem; margin-bottom: 4px; }
        .num { color: #64748b; font-size: 0.9rem; margin-bottom: 24px; }
        img { width: 320px; height: 320px; }
      </style></head><body>
      <h1>${trabajador?.nombre_completo || ''}</h1>
      <div class="num">No. ${trabajador?.no_empleado || ''}</div>
      <img src="${src}" />
      <script>window.onload = () => setTimeout(() => window.print(), 200)</script>
      </body></html>`)
    w.document.close()
  }

  const onDownload = () => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = `qr_${trabajador?.no_empleado || qrCode}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Modal open={open} onClose={onClose} title="Código QR" size="sm">
      <div className="text-center">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          {trabajador?.nombre_completo}
        </p>
        <p className="text-xs text-ink-500 mt-0.5">No. {trabajador?.no_empleado}</p>
        <div className="mt-4 flex justify-center">
          {src ? (
            <img src={src} alt="QR" className="w-48 h-48 rounded-lg border border-ink-200" />
          ) : (
            <div className="w-48 h-48 bg-ink-100 dark:bg-ink-800 rounded-lg animate-pulse" />
          )}
        </div>
        <div className="mt-4 flex gap-2 justify-center">
          <Button variant="secondary" leftIcon={<Download size={14} />} onClick={onDownload}>
            Descargar
          </Button>
          <Button variant="primary" leftIcon={<Printer size={14} />} onClick={onPrint}>
            Imprimir
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function HorasAdminQR() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null) // trabajador a regenerar
  const [busy, setBusy] = useState(null) // id en proceso
  const [modalQr, setModalQr] = useState(null) // trabajador seleccionado para ver QR

  const load = () => {
    setLoading(true)
    listarTrabajadoresQR()
      .then((res) => setItems(res.items || []))
      .catch(() => toast.error('Error cargando trabajadores'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter((t) =>
      (t.nombre_completo || '').toLowerCase().includes(term) ||
      (t.no_empleado || '').toLowerCase().includes(term) ||
      (t.area || '').toLowerCase().includes(term)
    )
  }, [items, q])

  const onGenerar = async (trabajador) => {
    setBusy(trabajador.id)
    try {
      const res = await generarQR(trabajador.id)
      const updated = { ...trabajador, qr_code: res.qr_code }
      setItems((prev) => prev.map((t) => (t.id === trabajador.id ? updated : t)))
      setModalQr(updated)
      toast.success('QR generado')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al generar QR')
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  return (
    <>
      <PageHeader
        icon={QrCode}
        title="QR Trabajadores"
        description="Genera y administra códigos QR para registro de asistencia."
      />

      <div className="mb-4 max-w-md">
        <Input
          placeholder="Buscar por nombre, número o área..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          leftIcon={<Search size={15} />}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title={q ? 'Sin resultados' : 'Sin trabajadores'}
          description={q ? `Ningún trabajador coincide con "${q}".` : 'No hay trabajadores activos.'}
        />
      ) : (
        <Table>
          <THead>
            <TH>No. Emp.</TH>
            <TH>Nombre</TH>
            <TH>Área</TH>
            <TH>QR</TH>
            <TH align="right">Acciones</TH>
          </THead>
          <TBody>
            {filtrados.map((t) => (
              <TR key={t.id}>
                <TD>
                  <span className="font-mono text-xs">{t.no_empleado}</span>
                </TD>
                <TD>
                  <span className="font-medium">{t.nombre_completo}</span>
                </TD>
                <TD>
                  <span className="text-sm text-ink-500 dark:text-ink-400">{t.area || '—'}</span>
                </TD>
                <TD>
                  <QrThumb qrCode={t.qr_code} />
                </TD>
                <TD align="right">
                  <div className="flex gap-2 justify-end">
                    {t.qr_code ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<Eye size={13} />}
                          onClick={() => setModalQr(t)}
                        >
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100 dark:!bg-amber-900/30 dark:!text-amber-300 dark:!border-amber-800"
                          leftIcon={<RefreshCcw size={13} />}
                          onClick={() => setConfirm(t)}
                          disabled={busy === t.id}
                        >
                          Regenerar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<QrCode size={13} />}
                        onClick={() => onGenerar(t)}
                        disabled={busy === t.id}
                      >
                        Generar QR
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => onGenerar(confirm)}
        title="¿Regenerar QR?"
        description={`El QR actual de ${confirm?.nombre_completo} quedará inválido. ¿Deseas continuar?`}
        confirmLabel="Regenerar"
        cancelLabel="Cancelar"
        tone="warning"
      />

      <QrModal
        open={!!modalQr}
        trabajador={modalQr}
        qrCode={modalQr?.qr_code}
        onClose={() => setModalQr(null)}
      />
    </>
  )
}
