import { useEffect, useState } from 'react'
import { ShieldCheck, Phone, Heart } from 'lucide-react'
import { descargarImagenQR } from '../../api/horas'
import useAuthenticatedBlob from '../../hooks/useAuthenticatedBlob'

// ── Credencial corporativa tamaño CR80 ──────────────────────────────────────
// CR80 es el estándar ISO/IEC 7810 ID-1: 85.60mm × 53.98mm. Mismo formato que
// tarjeta de crédito o credencial NFC común. El componente respeta las
// dimensiones exactas tanto en pantalla como en print (vía CSS mm units).
//
// Diseño:
//   - Frente: logo + razón social, foto, nombre, puesto/área, no. empleado,
//     QR pequeño en esquina (para escaneo rápido en el kiosko)
//   - Reverso: QR grande centrado, tipo de sangre, contacto de emergencia,
//     leyenda legal + URL/teléfono corporativo
//
// Las dimensiones se controlan con clase `.credencial-cr80` que define width
// y aspect-ratio reales en mm. Para previa en pantalla normal, escalamos con
// transform si hace falta — el componente padre puede pasar `scale`.

const CR80_WIDTH_MM = 85.6
const CR80_HEIGHT_MM = 53.98

function PreviewQrThumb({ qrCode, size = 'small' }) {
  // Hook compartido para QR — descarga el PNG autenticado con JWT y devuelve
  // un blob URL listo para <img src>. El cleanup revoca el URL al desmontar.
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!qrCode) return
    let cancelled = false
    let url = null
    descargarImagenQR(qrCode)
      .then((u) => {
        if (cancelled) { URL.revokeObjectURL(u); return }
        url = u
        setSrc(u)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [qrCode])

  if (!qrCode) {
    return (
      <div className={`flex items-center justify-center bg-white/10 rounded text-[6px] text-white/60 ${
        size === 'large' ? 'h-full w-full' : 'h-full w-full'
      }`}>
        Sin QR
      </div>
    )
  }
  if (!src) {
    return <div className="h-full w-full bg-white/20 animate-pulse rounded" />
  }
  return <img src={src} alt="QR" className="h-full w-full object-contain bg-white p-0.5 rounded" />
}

function FotoAuth({ trabajadorId, hasFoto, name }) {
  // Usa el hook autenticado para traer la foto del trabajador. Si no hay
  // foto o falla, devolvemos las iniciales sobre un fondo neutro.
  const url = hasFoto && trabajadorId
    ? `/trabajadores/${trabajadorId}/foto`
    : null
  const src = useAuthenticatedBlob(url)

  if (src) {
    return <img src={src} alt={name} className="h-full w-full object-cover" />
  }
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800 font-bold text-2xl">
      {initials}
    </div>
  )
}

export default function CredencialAsistencia({
  trabajador,
  empresa = 'SKILLED',
  logoUrl = '/logo.png',
  side = 'frente',  // 'frente' | 'reverso'
  scale = 1,        // factor de escala visual (1 = tamaño real)
  className = '',
}) {
  const t = trabajador || {}
  const styleCard = {
    width: `${CR80_WIDTH_MM}mm`,
    height: `${CR80_HEIGHT_MM}mm`,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
  }
  const styleWrapper = scale !== 1
    ? {
        width: `${CR80_WIDTH_MM * scale}mm`,
        height: `${CR80_HEIGHT_MM * scale}mm`,
      }
    : undefined

  return (
    <div style={styleWrapper} className={`credencial-cr80-wrapper ${className}`}>
      <div
        className="credencial-cr80 relative overflow-hidden rounded-[3mm] shadow-md"
        style={styleCard}
      >
        {side === 'frente' ? (
          <FrenteCredencial trabajador={t} empresa={empresa} logoUrl={logoUrl} />
        ) : (
          <ReversoCredencial trabajador={t} empresa={empresa} logoUrl={logoUrl} />
        )}
      </div>
    </div>
  )
}

function FrenteCredencial({ trabajador: t, empresa, logoUrl }) {
  return (
    <div className="absolute inset-0 bg-white text-ink-900 flex flex-col">
      {/* Header corporativo con logo */}
      <div
        className="relative flex items-center gap-2 px-3 py-2"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        }}
      >
        <img
          src={logoUrl}
          alt={empresa}
          className="h-5 w-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <span className="ml-auto text-[6.5px] uppercase tracking-wider text-white/60 font-semibold">
          Credencial de Asistencia
        </span>
      </div>

      {/* Cuerpo: foto + datos + QR */}
      <div className="flex-1 flex p-2 gap-2 relative">
        {/* Patrón decorativo sutil de fondo (tipo holograma) */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #0f172a 0, #0f172a 1px, transparent 0, transparent 6px)',
          }}
        />

        {/* Foto y No. Empleado */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative w-[20mm] h-[26mm] rounded-sm overflow-hidden ring-1 ring-ink-300 bg-ink-100">
            <FotoAuth trabajadorId={t.id} hasFoto={Boolean(t.foto_perfil)} name={t.nombre_completo} />
          </div>
          <div className="text-center w-[20mm]">
            <p className="text-[5px] uppercase tracking-[0.1em] font-semibold text-ink-500 leading-none">
              No. Emp
            </p>
            <p className="font-mono text-[8px] font-bold tracking-wider text-brand-700 leading-none mt-0.5">
              {t.no_empleado || '—'}
            </p>
          </div>
        </div>

        {/* Datos */}
        <div className="relative flex-1 min-w-0 flex flex-col py-0.5">
          <p className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500 leading-none">
            Nombre
          </p>
          <p className="text-[8px] font-bold leading-tight text-ink-900 mt-0.5 line-clamp-2">
            {t.nombre_completo || '—'}
          </p>

          <p className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500 leading-none mt-1">
            Puesto
          </p>
          <p className="text-[7px] font-medium leading-tight text-ink-800 mt-0.5 line-clamp-1">
            {t.puesto || '—'}
          </p>

          <p className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500 leading-none mt-1">
            Área
          </p>
          <p className="text-[7px] leading-tight text-ink-700 mt-0.5 line-clamp-1">
            {t.area || '—'}
          </p>

        </div>

        {/* QR en esquina, lo bastante grande para escanear desde el kiosko */}
        <div className="relative w-[18mm] h-[18mm] flex-shrink-0 self-end">
          <PreviewQrThumb qrCode={t.qr_code} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-ink-200 flex items-center justify-between">
        <span className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500">
          Esta credencial es personal e intransferible
        </span>
        <ShieldCheck size={8} className="text-brand-600" />
      </div>
    </div>
  )
}

function ReversoCredencial({ trabajador: t, empresa, logoUrl }) {
  return (
    <div className="absolute inset-0 bg-white text-ink-900 flex flex-col">
      {/* Header simple */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        }}
      >
        <img
          src={logoUrl}
          alt={empresa}
          className="h-5 w-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      <div className="flex-1 flex p-2 gap-2">
        {/* QR de tamaño adecuado para que no se vea desproporcionado o con "mucho zoom" */}
        <div className="w-[26mm] h-[26mm] flex-shrink-0 self-center">
          <PreviewQrThumb qrCode={t.qr_code} size="large" />
        </div>

        {/* Info de emergencia */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 text-[6.5px]">
          <div>
            <p className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500 leading-none flex items-center gap-1">
              <Heart size={6} /> Tipo de Sangre
            </p>
            <p className="font-bold text-[8px] text-red-700 leading-none mt-0.5">
              {t.tipo_sangre || '—'}
            </p>
          </div>

          <div>
            <p className="text-[5.5px] uppercase tracking-[0.15em] font-semibold text-ink-500 leading-none flex items-center gap-1">
              <Phone size={6} /> Emergencia
            </p>
            <p className="font-semibold text-[7px] leading-tight text-ink-900 mt-0.5 line-clamp-1">
              {t.contacto_emergencia || '—'}
            </p>
            {t.numero_contacto_emerg && (
              <p className="font-mono text-[7px] leading-none mt-0.5 text-ink-800">
                {t.numero_contacto_emerg}
              </p>
            )}
          </div>

          <div className="mt-auto">
            <p className="text-[5.5px] text-ink-500 leading-tight italic">
              Si encuentras esta credencial, devuélvela a RRHH.
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 py-1 border-t border-ink-200 text-center">
        <span className="text-[5.5px] uppercase tracking-[0.2em] font-semibold text-ink-500">
          © {new Date().getFullYear()} {empresa}
        </span>
      </div>
    </div>
  )
}

export { CR80_WIDTH_MM, CR80_HEIGHT_MM }
