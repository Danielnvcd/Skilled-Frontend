/**
 * Saneamiento de rutas de redirección post-login (`?from=`).
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * Después de un 401 el interceptor manda al usuario a `/login?from=<ruta>` y
 * al autenticarse lo devolvemos a esa ruta con `navigate(from)`. Ese `from`
 * viaja en la URL, así que lo controla quien mande el enlace — es entrada NO
 * confiable.
 *
 * El guard anterior (`from.startsWith('/') && !from.startsWith('//')`) era
 * insuficiente: el parser de URLs de los navegadores (WHATWG) trata la barra
 * invertida como separador de ruta, así que `/\evil.com` se resuelve como
 * `//evil.com` → `https://evil.com/`. Verificado:
 *
 *     new URL('/\\evil.com', 'https://app.skilledmx.cloud') // → https://evil.com/
 *
 * Un atacante manda `https://app.skilledmx.cloud/login?from=%2F%5Cevil.com`;
 * la víctima se autentica en el sitio REAL (dominio correcto, certificado
 * correcto) y termina en el sitio del atacante — phishing de alta credibilidad
 * y, si el destino imita la app, robo de credenciales en el siguiente paso.
 *
 * Es la misma clase de bug que CVE-2025-68470 y su bypass CVE-2026-53669 en
 * react-router (`useNavigate`/`<Link>`). Ese bypass solo está parchado en
 * react-router 7.18.0+ — no hay parche en la línea 6.x que usamos. Por eso el
 * arreglo va aquí, en el borde de la aplicación: si ningún string controlado
 * por el atacante llega a `navigate()`, la vulnerabilidad de la librería deja
 * de ser explotable, independientemente de la versión instalada.
 *
 * ── Política ────────────────────────────────────────────────────────────────
 * Allowlist, no denylist. Solo se acepta una ruta interna simple:
 *   - empieza con exactamente una `/`
 *   - sin barras invertidas, ni caracteres de control, ni espacios en blanco
 *   - sin `@` de userinfo
 *   - resuelta contra el origen actual, sigue siendo del mismo origen
 * Cualquier otra cosa cae a `/`.
 */

const FALLBACK = '/'

// Rango C0 (U+0000..U+001F) + espacio + DEL. Los navegadores ELIMINAN tab, LF y
// CR al parsear una URL, así que `/<TAB>/evil.com` termina siendo `//evil.com`.
// eslint-disable-next-line no-control-regex
const CARACTERES_PROHIBIDOS = /[\u0000-\u0020\u007f]/

export function safeRedirectPath(raw, fallback = FALLBACK) {
  if (typeof raw !== 'string') return fallback

  const value = raw.trim()
  if (!value) return fallback

  // Debe ser una ruta absoluta interna: una sola barra inicial.
  if (value[0] !== '/' || value[1] === '/') return fallback

  // Barra invertida en cualquier posición: el parser del navegador la convierte
  // en `/`, así que `/\evil.com` sería protocol-relative. No hay ruta legítima
  // de esta app que lleve `\`.
  if (value.includes('\\')) return fallback

  if (CARACTERES_PROHIBIDOS.test(value)) return fallback

  // `@` marca userinfo — `/@evil.com` no aplica aquí (ya validamos la barra
  // inicial), pero lo rechazamos por si la ruta se reusara como URL completa.
  if (value.includes('@')) return fallback

  // Verificación final contra el parser real del navegador: es la autoridad
  // sobre cómo se resolverá la navegación. Si el origen resultante no es el
  // nuestro, se descarta.
  try {
    const origin = window.location.origin
    const resolved = new URL(value, origin)
    if (resolved.origin !== origin) return fallback
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return fallback
  }
}

export default safeRedirectPath
