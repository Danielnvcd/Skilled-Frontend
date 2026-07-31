/**
 * Barra visual + label que muestra la fuerza estimada de una contraseña.
 *
 * No bloquea el submit — solo guía. El back impone el mínimo real: 12 chars
 * con mayúsculas, minúsculas, números y símbolos (ver `is_strong_password` en
 * app/utils/security.py). Mantener este umbral sincronizado con el backend: si
 * el indicador dice "Fuerte" y el back la rechaza, el usuario no entiende nada.
 *
 * Score 0–5 sumando: 12+ chars, 16+ chars, mixto mayús/minús, dígitos, símbolos.
 */
const LARGO_MINIMO = 12
export default function PasswordStrengthIndicator({ password, className = '' }) {
  if (!password) return null

  const score = computeScore(password)
  const { label, tone, fillSegments } = mapScore(score)

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < fillSegments ? tone.bar : 'bg-ink-200 dark:bg-ink-700'}`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${tone.text}`}>
        {label}
        {score < 5 && (
          <span className="text-ink-500 dark:text-ink-400 font-normal"> — {hint(password)}</span>
        )}
      </p>
    </div>
  )
}

function computeScore(pw) {
  let s = 0
  if (pw.length >= LARGO_MINIMO) s++
  if (pw.length >= 16) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^a-zA-Z0-9]/.test(pw)) s++
  return s
}

function mapScore(s) {
  if (s <= 2) {
    return {
      label: 'Débil',
      fillSegments: 1,
      tone: {
        bar: 'bg-red-500 dark:bg-red-500',
        text: 'text-red-700 dark:text-red-400',
      },
    }
  }
  if (s === 3) {
    return {
      label: 'Media',
      fillSegments: 2,
      tone: {
        bar: 'bg-amber-500 dark:bg-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
      },
    }
  }
  return {
    label: 'Fuerte',
    fillSegments: 3,
    tone: {
      bar: 'bg-emerald-500 dark:bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
    },
  }
}

function hint(pw) {
  if (pw.length < LARGO_MINIMO) {
    return `mínimo ${LARGO_MINIMO} caracteres (${pw.length}/${LARGO_MINIMO})`
  }
  const missing = []
  if (!(/[a-z]/.test(pw) && /[A-Z]/.test(pw))) missing.push('mayúsculas y minúsculas')
  if (!/[0-9]/.test(pw)) missing.push('números')
  if (!/[^a-zA-Z0-9]/.test(pw)) missing.push('símbolos')
  if (missing.length === 0 && pw.length < 16) return 'agregá más caracteres para "Fuerte"'
  if (missing.length === 0) return ''
  return `agregá ${missing.slice(0, 2).join(' y ')}`
}
