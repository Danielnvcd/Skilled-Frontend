import useAuthenticatedBlob, { useLazyAuthenticatedBlob } from '../hooks/useAuthenticatedBlob'
import { Avatar } from './ui'

/**
 * Muestra la foto de perfil de un usuario (autenticada via Bearer) o el
 * placeholder con iniciales. `lazy` difiere el fetch hasta que el avatar entra
 * al viewport — útil para grids con muchos rows.
 *
 * Pasa `profilePic` (el filename actual del usuario) como cache buster: cada
 * upload genera un filename nuevo (profile_<id>_<uuid>.<ext>), así que la URL
 * cambia y el blob cache del hook trae la nueva foto en vez de la vieja.
 */
export default function UserAvatar({ id, profilePic, name, size = 'md', lazy = false, className = '' }) {
  const hasFoto = Boolean(profilePic && profilePic !== 'default.png')
  const url = hasFoto && id
    ? `/auth/users/${id}/foto?v=${encodeURIComponent(profilePic)}`
    : null
  const eagerUrl = useAuthenticatedBlob(lazy ? null : url)
  const [lazyUrl, lazyRef] = useLazyAuthenticatedBlob(lazy ? url : null)
  const src = lazy ? lazyUrl : eagerUrl
  if (lazy) {
    return (
      <span ref={lazyRef} className={`inline-block ${className}`}>
        <Avatar name={name} size={size} src={src || undefined} />
      </span>
    )
  }
  return <Avatar name={name} size={size} src={src || undefined} className={className} />
}
