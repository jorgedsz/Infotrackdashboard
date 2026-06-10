import { useAuth } from '../context/AuthContext'
import Login from './Login'

// Muestra el login si hay auth activa y el usuario no está autenticado.
export default function Protected({ children }) {
  const { ready, authed } = useAuth()
  if (!ready) return <div className="bootscreen">Cargando…</div>
  if (!authed) return <Login />
  return children
}
