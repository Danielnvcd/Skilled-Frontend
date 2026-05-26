import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Button, Input } from '../components/ui'

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
        navigate('/verify-2fa', { state: { username, stepToken: result.stepToken, from: searchParams.get('from') } })
      } else {
        const from = searchParams.get('from')
        const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
        navigate(safeFrom)
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
    <div className="min-h-screen relative flex items-center justify-center p-6 dark overflow-hidden font-['Inter'] bg-black">
      {/* Video de fondo */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster=""
        className="absolute inset-0 w-full h-full object-cover z-0"
        aria-hidden="true"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Overlay para legibilidad del formulario sobre el video */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-black/70 via-black/55 to-brand-950/70" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0.55)_100%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 p-8 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.75)] ring-1 ring-white/5">
          <div className="flex flex-col items-center text-center mb-10">
            <img
              src="/logo1.png"
              alt="Skilled"
              className="h-16 max-w-[240px] object-contain mb-6 drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              draggable={false}
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">Bienvenido de vuelta</h1>
            <p className="mt-2 text-sm text-white/60">
              Ingresa tus credenciales para acceder a la plataforma.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200 animate-fade-in"
              >
                <AlertCircle size={16} className="text-red-300 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider ml-1">Usuario</label>
              <Input
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) setError('') }}
                leftIcon={<User size={16} className="text-white/40" />}
                required
                placeholder="ejemplo.usuario"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider ml-1">Contraseña</label>
              <Input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                leftIcon={<Lock size={16} className="text-white/40" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="pointer-events-auto text-white/40 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                required
                placeholder="••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
              />
            </div>

            <label className="flex items-center gap-2 select-none cursor-pointer text-sm text-white/70 hover:text-white/90 transition-colors">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-white accent-white focus:ring-1 focus:ring-white/40 cursor-pointer"
              />
              Recordarme
            </label>

            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="w-full h-11 mt-4 bg-white text-black hover:bg-white/90 font-bold tracking-wide transition-all active:scale-[0.98]"
            >
              Iniciar sesión
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-bold border-t border-white/5 pt-8">
            <ShieldCheck size={14} className="text-brand-400" />
            Conexión segura
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          ¿Problemas para acceder? Contacta a soporte técnico.
        </p>
      </div>
    </div>
  )
}
