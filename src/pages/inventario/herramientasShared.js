// Helpers compartidos entre las páginas de Herramientas.
// Centraliza catálogos de estados, mapeo de tonos y formatos.

export const ESTADOS_UNIDAD = [
  'DISPONIBLE', 'ASIGNADA', 'EN_MANTENIMIENTO', 'DAÑADA', 'EXTRAVIADA', 'DADA_DE_BAJA',
]

export const ESTADO_LABEL = {
  DISPONIBLE: 'Disponible',
  ASIGNADA: 'Asignada',
  EN_MANTENIMIENTO: 'En mantenimiento',
  DAÑADA: 'Dañada',
  EXTRAVIADA: 'Extraviada',
  DADA_DE_BAJA: 'Dada de baja',
}

export const ESTADO_TONE = {
  DISPONIBLE: 'success',
  ASIGNADA: 'info',
  EN_MANTENIMIENTO: 'warning',
  DAÑADA: 'danger',
  EXTRAVIADA: 'warning',
  DADA_DE_BAJA: 'neutral',
}

export const USO_HERRAMIENTA = ['MANUAL', 'ELÉCTRICA', 'NEUMÁTICA', 'HIDRÁULICA', 'MEDICIÓN', 'SEGURIDAD', 'OTRO']

export const TIPO_INCIDENCIA = ['DAÑO', 'EXTRAVIO', 'MAL_FUNCIONAMIENTO', 'OTRO']
export const TIPO_INCIDENCIA_LABEL = {
  DAÑO: 'Daño',
  EXTRAVIO: 'Extravío',
  MAL_FUNCIONAMIENTO: 'Mal funcionamiento',
  OTRO: 'Otro',
}

export const TIPO_MANTENIMIENTO = ['PREVENTIVO', 'CORRECTIVO']
export const CONDICION = ['BUENA', 'REGULAR', 'MALA']

export const TIPO_EVENTO_LABEL = {
  ALTA: 'Alta',
  EDICION: 'Edición',
  ASIGNACION: 'Asignación',
  DEVOLUCION: 'Devolución',
  MANTENIMIENTO_IN: 'Envío a mantenimiento',
  MANTENIMIENTO_OUT: 'Salida de mantenimiento',
  INCIDENCIA: 'Incidencia',
  BAJA_SOLICITUD: 'Solicitud de baja',
  BAJA_APROBADA: 'Baja aprobada',
  BAJA_RECHAZADA: 'Baja rechazada',
  BAJA_EJECUTADA: 'Baja ejecutada',
  CAMBIO_ESTADO: 'Cambio de estado',
  TRASLADO: 'Traslado',
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return iso
  }
}
