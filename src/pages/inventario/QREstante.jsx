import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, QrCode } from 'lucide-react'
import { getEstantes } from '../../api/inventario'
import api from '../../api/axios'

export default function QREstante() {
  const { id } = useParams()
  const [estante, setEstante] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qrUrl, setQrUrl] = useState(null)
  const [qrError, setQrError] = useState(false)

  useEffect(() => {
    let revoke = null
    let cancelled = false

    Promise.all([
      getEstantes(),
      // Descargamos el PNG con axios (envía el JWT en Authorization).
      // Un <img src="/api/..."> no podría autenticar al backend.
      api.get(`/v1/estantes/${id}/qr-image`, { responseType: 'blob' }),
    ])
      .then(([estantes, qrRes]) => {
        if (cancelled) return
        const found = estantes.find((e) => String(e.id) === String(id))
        if (found) setEstante(found)
        const objUrl = URL.createObjectURL(qrRes.data)
        revoke = objUrl
        setQrUrl(objUrl)
      })
      .catch(() => { if (!cancelled) setQrError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [id])

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!estante) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <QrCode size={48} className="text-ink-300" />
        <p className="text-ink-500">Estante no encontrado</p>
        <Link to="/inventario/almacenes" className="text-brand-500 hover:underline">← Volver a Almacenes</Link>
      </div>
    )
  }

  return (
    <>
      {/* Barra de acciones — se oculta al imprimir */}
      <div className="print:hidden flex items-center gap-3 p-4 border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
        <Link to="/inventario/almacenes">
          <button className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 transition-colors">
            <ArrowLeft size={16} /> Volver
          </button>
        </Link>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Printer size={16} /> Imprimir QR
        </button>
      </div>

      {/* Tarjeta imprimible */}
      <div className="min-h-screen bg-slate-100 dark:bg-ink-950 print:bg-white flex items-center justify-center p-8">
        <div
          id="qr-card"
          className="bg-white rounded-2xl shadow-2xl print:shadow-none print:border print:border-slate-200 p-10 text-center w-full max-w-sm"
        >
          {/* Almacén label */}
          <p className="text-xs font-bold tracking-widest text-blue-500 uppercase mb-1">
            Almacén #{estante.almacen_id}
          </p>

          {/* Nombre del estante */}
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-1">
            {estante.nombre}
          </h1>

          {/* Descripción */}
          <p className="text-sm text-gray-400 mb-6">
            {estante.descripcion || 'Sin descripción'}
          </p>

          {/* QR Code */}
          <div className="flex justify-center mb-4">
            {qrError || !qrUrl ? (
              <div className="w-52 h-52 border-4 border-red-300 rounded-xl flex items-center justify-center bg-red-50 text-red-500 text-xs px-4 text-center">
                No se pudo generar el QR
              </div>
            ) : (
              <img
                src={qrUrl}
                alt={`QR ${estante.nombre}`}
                className="w-52 h-52 border-4 border-blue-500 rounded-xl p-2"
              />
            )}
          </div>

          {/* Código UUID pequeño */}
          <p className="text-[9px] text-gray-300 font-mono break-all">
            {estante.qr_code}
          </p>
        </div>
      </div>

      {/* CSS específico de impresión */}
      <style>{`
        @media print {
          @page { size: auto; margin: 1cm; }
          body > *:not(#qr-card-wrapper) { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  )
}
