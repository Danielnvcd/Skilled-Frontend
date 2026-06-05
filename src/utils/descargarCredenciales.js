// Genera PNGs de las credenciales corporativas (frente + reverso) al tamaño
// real CR80 (85.6 × 53.98 mm) y los descarga.
//
//   - 1 trabajador  → 2 PNG sueltos: <nombre>_<noEmp>_frente.png / _reverso.png
//   - N trabajadores → un ZIP con los 2N archivos.
//
// Replica el render del componente <CredencialAsistencia> en HTML/CSS plano
// para poder capturar con html-to-image sin tener que montar React fuera del
// árbol. Pre-fetchea foto y QR como data URLs (los endpoints requieren JWT
// que vive en axios, no en el contenedor offscreen).

import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import api from '../api/axios'

const CR80_WIDTH_MM = 85.6
const CR80_HEIGHT_MM = 53.98
// pixelRatio=3 sobre dimensiones en mm da ~300 DPI, suficiente para impresión.
const PIXEL_RATIO = 3

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0] || '')
    .join('')
    .toUpperCase() || '?'
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function fetchQrDataUrl(qrCode) {
  try {
    const res = await api.get(`/horas/qr/imagen/${encodeURIComponent(qrCode)}`, { responseType: 'blob' })
    return await blobToDataUrl(res.data)
  } catch {
    return null
  }
}

async function fetchFotoDataUrl(trabajadorId) {
  try {
    const res = await api.get(`/trabajadores/${trabajadorId}/foto`, { responseType: 'blob' })
    return await blobToDataUrl(res.data)
  } catch {
    return null
  }
}

// El logo es público (/logo.png) pero al ir en un nodo capturado por
// html-to-image conviene tenerlo como data URL para evitar problemas de CORS.
async function fetchLogoDataUrl(logoUrl) {
  try {
    const res = await fetch(logoUrl)
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

// Sanitiza un fragmento de nombre para uso en nombre de archivo.
function safeFileName(s) {
  return String(s || 'sin_nombre')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'sin_nombre'
}

// CSS calco de <CredencialAsistencia>. Inyectado una sola vez.
const CSS = `
.cr80 {
  width: ${CR80_WIDTH_MM}mm;
  height: ${CR80_HEIGHT_MM}mm;
  background: #ffffff;
  color: #0f172a;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  border-radius: 3mm;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.cr80 * { box-sizing: border-box; }
.cr80 .hdr {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
  padding: 1.8mm 3mm;
  display: flex;
  align-items: center;
  gap: 2mm;
  color: white;
}
.cr80 .hdr img { height: 5mm; width: auto; filter: brightness(0) invert(1); }
.cr80 .hdr .lbl {
  margin-left: auto; font-size: 5pt; letter-spacing: 1.2px;
  text-transform: uppercase; color: rgba(255,255,255,0.65); font-weight: 600;
}
.cr80 .body {
  flex: 1; display: flex; padding: 2mm; gap: 2mm; position: relative; min-height: 0;
}
.cr80 .pattern {
  position: absolute; inset: 0; opacity: 0.04; pointer-events: none;
  background-image: repeating-linear-gradient(45deg,#0f172a 0,#0f172a 0.3mm,transparent 0,transparent 1.6mm);
}
.cr80 .foto-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 1mm;
  flex-shrink: 0; position: relative;
}
.cr80 .foto {
  width: 20mm; height: 26mm; border-radius: 0.6mm; overflow: hidden;
  background: #e2e8f0; border: 0.15mm solid #cbd5e1;
}
.cr80 .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cr80 .foto .ini {
  width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center;
  background: linear-gradient(135deg,#dbeafe,#bfdbfe);
  color: #1e3a8a; font-weight: 800; font-size: 14pt;
}
.cr80 .noemp { text-align: center; width: 20mm; }
.cr80 .noemp .l { font-size: 4pt; text-transform: uppercase; letter-spacing: 1px;
  font-weight: 600; color: #64748b; line-height: 1; }
.cr80 .noemp .v { font-family: 'Courier New', monospace; font-size: 6.5pt;
  font-weight: 800; letter-spacing: 1px; color: #1d4ed8; margin-top: 0.4mm; line-height: 1; }
.cr80 .info {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  padding: 0.4mm 0; position: relative;
}
.cr80 .info .l {
  font-size: 4.5pt; text-transform: uppercase; letter-spacing: 1.2px;
  font-weight: 600; color: #64748b; line-height: 1;
}
.cr80 .info .nm { font-size: 6.8pt; font-weight: 800; line-height: 1.1;
  color: #0f172a; margin-top: 0.5mm; }
.cr80 .info .pst { font-size: 5.8pt; font-weight: 500; line-height: 1.15;
  color: #1e293b; margin-top: 0.4mm; }
.cr80 .info .ar { font-size: 5.8pt; line-height: 1.15; color: #334155; margin-top: 0.4mm; }
.cr80 .info .sp { margin-top: 1mm; }
.cr80 .qr {
  width: 18mm; height: 18mm; align-self: flex-end; flex-shrink: 0;
  background: white; padding: 0.3mm;
}
.cr80 .qr img { width: 100%; height: 100%; object-fit: contain; display: block; }
.cr80 .qr .noqr {
  width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center; font-size: 5pt; color: #94a3b8; background: #f1f5f9;
}
.cr80 .ftr {
  padding: 0.8mm 3mm; border-top: 0.12mm solid #e2e8f0; display: flex;
  align-items: center; justify-content: space-between; font-size: 4.5pt;
  text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600;
}
/* Reverso */
.cr80 .rev-body { flex: 1; display: flex; padding: 2mm; gap: 2.5mm; }
.cr80 .rev-qr { width: 26mm; height: 26mm; flex-shrink: 0; align-self: center; }
.cr80 .rev-qr img { width: 100%; height: 100%; object-fit: contain; display: block; }
.cr80 .rev-qr .noqr {
  width: 100%; height: 100%; display: flex; align-items: center;
  justify-content: center; font-size: 5pt; color: #94a3b8; background: #f1f5f9;
}
.cr80 .rev-info {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  justify-content: center; gap: 1.5mm;
}
.cr80 .rev-info .l {
  font-size: 4.5pt; text-transform: uppercase; letter-spacing: 1.2px;
  font-weight: 600; color: #64748b; line-height: 1;
}
.cr80 .rev-info .blood { font-size: 8pt; font-weight: 800; color: #b91c1c;
  line-height: 1; margin-top: 0.5mm; }
.cr80 .rev-info .em-nom { font-size: 5.8pt; font-weight: 600; color: #0f172a;
  line-height: 1.15; margin-top: 0.5mm; }
.cr80 .rev-info .em-num { font-family: 'Courier New', monospace; font-size: 5.6pt;
  color: #1e293b; line-height: 1; margin-top: 0.4mm; }
.cr80 .rev-info .legal { margin-top: auto; font-size: 4.5pt; color: #64748b;
  font-style: italic; line-height: 1.25; }
.cr80 .rev-ftr {
  padding: 0.8mm 3mm; border-top: 0.12mm solid #e2e8f0; text-align: center;
  font-size: 4.5pt; text-transform: uppercase; letter-spacing: 1.5px;
  color: #64748b; font-weight: 600;
}
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected) return
  const s = document.createElement('style')
  s.dataset.cr80 = '1'
  s.textContent = CSS
  document.head.appendChild(s)
  stylesInjected = true
}

function renderFrente(t, { qrData, fotoData, logoData, empresa }) {
  const logoTag = logoData
    ? `<img src="${logoData}" alt="${escapeHtml(empresa)}"/>`
    : ''
  const fotoTag = fotoData
    ? `<img src="${fotoData}" alt=""/>`
    : `<div class="ini">${escapeHtml(initials(t.nombre_completo))}</div>`
  const qrTag = qrData
    ? `<img src="${qrData}" alt="QR"/>`
    : `<div class="noqr">Sin QR</div>`

  return `
    <div class="cr80">
      <div class="hdr">
        ${logoTag}
        <span class="lbl">Credencial de Asistencia</span>
      </div>
      <div class="body">
        <div class="pattern"></div>
        <div class="foto-wrap">
          <div class="foto">${fotoTag}</div>
          <div class="noemp">
            <div class="l">No. Emp</div>
            <div class="v">${escapeHtml(t.no_empleado || '—')}</div>
          </div>
        </div>
        <div class="info">
          <div class="l">Nombre</div>
          <div class="nm">${escapeHtml(t.nombre_completo || '—')}</div>
          <div class="l sp">Puesto</div>
          <div class="pst">${escapeHtml(t.puesto || '—')}</div>
          <div class="l sp">Área</div>
          <div class="ar">${escapeHtml(t.area || '—')}</div>
        </div>
        <div class="qr">${qrTag}</div>
      </div>
      <div class="ftr">
        <span>Esta credencial es personal e intransferible</span>
        <span>✓</span>
      </div>
    </div>
  `
}

function renderReverso(t, { qrData, logoData, empresa }) {
  const logoTag = logoData
    ? `<img src="${logoData}" alt="${escapeHtml(empresa)}"/>`
    : ''
  const qrTag = qrData
    ? `<img src="${qrData}" alt="QR"/>`
    : `<div class="noqr">Sin QR</div>`
  const numEmerg = t.numero_contacto_emerg
    ? `<div class="em-num">${escapeHtml(t.numero_contacto_emerg)}</div>`
    : ''

  return `
    <div class="cr80">
      <div class="hdr">${logoTag}</div>
      <div class="rev-body">
        <div class="rev-qr">${qrTag}</div>
        <div class="rev-info">
          <div>
            <div class="l">♥ Tipo de Sangre</div>
            <div class="blood">${escapeHtml(t.tipo_sangre || '—')}</div>
          </div>
          <div>
            <div class="l">☎ Emergencia</div>
            <div class="em-nom">${escapeHtml(t.contacto_emergencia || '—')}</div>
            ${numEmerg}
          </div>
          <div class="legal">Si encuentras esta credencial, devuélvela a RRHH.</div>
        </div>
      </div>
      <div class="rev-ftr">© ${new Date().getFullYear()} ${escapeHtml(empresa)}</div>
    </div>
  `
}

async function waitImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalHeight > 0) return Promise.resolve()
    return new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })
  }))
}

async function renderToPng(html) {
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${CR80_WIDTH_MM}mm;
    height: ${CR80_HEIGHT_MM}mm;
    z-index: -1;
    pointer-events: none;
  `
  container.innerHTML = html
  document.body.appendChild(container)
  try {
    await waitImages(container)
    // Doble RAF para garantizar layout + paint antes de la captura.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return await toPng(container.firstElementChild, {
      pixelRatio: PIXEL_RATIO,
      backgroundColor: '#ffffff',
      cacheBust: true,
    })
  } finally {
    container.remove()
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',')
  const mime = (header.match(/data:(.*?);base64/) || [, 'image/png'])[1]
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Pequeño delay antes de revocar para que el navegador haya iniciado la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Descarga las credenciales (frente + reverso) como PNG.
 *   - 1 trabajador  → dos PNG sueltos.
 *   - N trabajadores → un ZIP con 2N archivos.
 *
 * @param {Array<Object>} trabajadores con: id, no_empleado, nombre_completo,
 *   puesto, area, foto_perfil, qr_code, tipo_sangre, contacto_emergencia,
 *   numero_contacto_emerg
 * @param {Object} opts { empresa?: string, logoUrl?: string }
 */
export async function descargarCredenciales(trabajadores, opts = {}) {
  if (!trabajadores?.length) return
  const empresa = opts.empresa || 'SKILLED'
  const logoUrl = opts.logoUrl || '/logo.png'

  ensureStyles()
  const logoData = await fetchLogoDataUrl(logoUrl)

  // Pre-fetch de QR y fotos en paralelo por trabajador.
  const enriched = await Promise.all(trabajadores.map(async (t) => {
    const [qrData, fotoData] = await Promise.all([
      t.qr_code ? fetchQrDataUrl(t.qr_code) : Promise.resolve(null),
      t.foto_perfil ? fetchFotoDataUrl(t.id) : Promise.resolve(null),
    ])
    return { t, qrData, fotoData }
  }))

  // Render + captura secuencial (offscreen reusa el flujo del documento).
  const archivos = []
  for (const { t, qrData, fotoData } of enriched) {
    const base = `${safeFileName(t.nombre_completo)}_${safeFileName(t.no_empleado || 'sn')}`
    const pngFrente = await renderToPng(renderFrente(t, { qrData, fotoData, logoData, empresa }))
    archivos.push({ name: `${base}_frente.png`, blob: dataUrlToBlob(pngFrente) })
    const pngReverso = await renderToPng(renderReverso(t, { qrData, logoData, empresa }))
    archivos.push({ name: `${base}_reverso.png`, blob: dataUrlToBlob(pngReverso) })
  }

  if (trabajadores.length === 1) {
    for (const a of archivos) downloadBlob(a.blob, a.name)
    return
  }

  const zip = new JSZip()
  const folder = zip.folder('credenciales')
  for (const a of archivos) folder.file(a.name, a.blob)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const fecha = new Date().toISOString().slice(0, 10)
  downloadBlob(zipBlob, `credenciales_${fecha}_${trabajadores.length}.zip`)
}
