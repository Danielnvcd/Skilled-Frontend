import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button, Input } from '../components/ui'
import { safeRedirectPath } from '../utils/safeRedirect'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login(username, password, remember)
      if (result.requires2fa) {
        // El `from` se sanea AQUÍ, antes de propagarlo al paso de 2FA, para que
        // nunca circule un destino no confiable por el state de navegación.
        navigate('/verify-2fa', {
          state: { username, stepToken: result.stepToken, from: safeRedirectPath(searchParams.get('from')) },
        })
      } else {
        // `?from=` lo controla quien manda el enlace: ver src/utils/safeRedirect.js
        // (el guard ingenuo dejaba pasar `/\evil.com` → https://evil.com).
        navigate(safeRedirectPath(searchParams.get('from')))
        toast.success('Inicio de sesión exitoso')
      }
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.response?.status === 401 ? 'Usuario o contraseña incorrectos'
          : err.message?.includes('Network') ? 'No se pudo conectar con el servidor'
            : 'Error al iniciar sesión')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 dark font-['Inter'] bg-ink-950 login-enter">
      {/* ───────────────────────── Panel de marca (izquierda) ─────────────────────────
          Solo visible en desktop. Muestra el video institucional con un degradado
          corporativo encima y un mensaje de valor + indicadores de confianza. */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0"
          aria-hidden="true"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
        {/* Degradado corporativo: del azul de marca al slate profundo, en diagonal. */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-brand-950/85 via-ink-950/80 to-ink-950/95" />

        {/* Logo arriba */}
        <div className="relative z-10">
          <img
            src="/logo1.png"
            alt="Skilled"
            className="h-12 max-w-[200px] object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* ───────────────────────── Panel de formulario (derecha) ───────────────────────── */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        {/* En móvil reutilizamos el video como fondo sutil ya que el panel de
            marca queda oculto. */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0 lg:hidden"
          aria-hidden="true"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-0 bg-ink-950/85 lg:hidden" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Logo solo en móvil (en desktop ya está en el panel de marca). */}
          <img
            src="/logo1.png"
            alt="Skilled"
            className="h-12 max-w-[200px] object-contain mb-8 lg:hidden"
            draggable={false}
          />

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-ink-100 tracking-tight">Iniciar sesión</h1>
            <p className="mt-1.5 text-sm text-ink-400">
              Ingresa tus credenciales para acceder a la plataforma.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-900/20 px-3.5 py-2.5 text-sm text-red-300 animate-fade-in"
              >
                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider ml-0.5">Usuario</label>
              <Input
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) setError('') }}
                leftIcon={<User size={16} />}
                required
                placeholder="ejemplo.usuario"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider ml-0.5">Contraseña</label>
              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                leftIcon={<Lock size={16} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="pointer-events-auto text-ink-400 hover:text-ink-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                required
                placeholder="••••••••"
              />
            </div>

            <label className="flex items-center gap-2 select-none cursor-pointer text-sm text-ink-300 hover:text-ink-100 transition-colors pt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-brand-500 focus:ring-2 focus:ring-brand-500/30 cursor-pointer"
              />
              Recordarme
            </label>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              size="lg"
              className="w-full mt-2"
            >
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-ink-500">
            ¿Problemas para acceder? Contacta a soporte técnico.
          </p>
        </div>
      </div>
    </div>
  )
}
