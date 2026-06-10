import { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch, getToken, setToken } from '../services/http'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authEnabled, setAuthEnabled] = useState(null) // null = aún cargando
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const cfg = await apiFetch('/api/auth/config', { auth: false })
        setAuthEnabled(cfg.enabled)
        if (cfg.enabled && getToken()) {
          try {
            const me = await apiFetch('/api/auth/me')
            setUser(me.user)
          } catch {
            setToken(null)
          }
        }
      } catch {
        setAuthEnabled(false) // backend caído: no bloqueamos (dev)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const login = async (email, password) => {
    const d = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password }, auth: false })
    setToken(d.token)
    setUser(d.user)
    return d.user
  }
  const logout = () => {
    setToken(null)
    setUser(null)
  }

  // Si auth está desactivado (dev sin DB), todo está permitido.
  const authed = authEnabled === false || !!user

  return (
    <AuthContext.Provider value={{ user, authEnabled, ready, authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
