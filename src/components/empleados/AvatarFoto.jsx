import useAuthenticatedBlob, { useLazyAuthenticatedBlob } from '../../hooks/useAuthenticatedBlob'
import { Avatar } from '../ui'

/**
 * Muestra la foto de perfil del trabajador (autenticada via Bearer) o el
 * placeholder con iniciales. `lazy=true` difiere el fetch hasta que el avatar
 * entra al viewport — útil para tablas con muchos rows.
 */
export default function AvatarFoto({ id, hasFoto, name, size = 'md', thumb = true, lazy = false }) {
  const url = hasFoto ? `/api/trabajadores/${id}/foto${thumb ? '/thumb' : ''}` : null
  // Hooks must be called unconditionally — we instantiate both and pick one
  const eagerUrl = useAuthenticatedBlob(lazy ? null : url)
  const [lazyUrl, lazyRef] = useLazyAuthenticatedBlob(lazy ? url : null)
  const src = lazy ? lazyUrl : eagerUrl
  if (lazy) {
    return (
      <span ref={lazyRef} className="inline-block">
        <Avatar name={name} size={size} src={src || undefined} />
      </span>
    )
  }
  return <Avatar name={name} size={size} src={src || undefined} />
}
