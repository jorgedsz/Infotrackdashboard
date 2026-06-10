// Autenticación: login con JWT, middlewares y gestión de usuarios (admin).
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query, AUTH_ENABLED } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'
const TOKEN_TTL = '12h'

const publicUser = (u) => ({
  id: u.id, email: u.email, name: u.name, role: u.role,
  comerciales: u.comerciales || [], view_all: u.view_all,
})

// Normaliza el body a { viewAll, comerciales[] }
function parseScope(body) {
  const viewAll = body?.view_all !== false
  let comerciales = []
  if (!viewAll) {
    const raw = Array.isArray(body?.comerciales) ? body.comerciales : (body?.comercial ? [body.comercial] : [])
    comerciales = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))]
  }
  return { viewAll, comerciales }
}

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

// Middleware: exige token válido (solo si AUTH está activo).
export async function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next() // dev sin DB: abierto
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const { rows } = await query('SELECT id, email, name, role, comerciales, view_all FROM users WHERE id = $1', [payload.uid])
    if (!rows.length) return res.status(401).json({ error: 'Usuario no existe' })
    req.user = rows[0]
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function requireAdmin(req, res, next) {
  if (!AUTH_ENABLED) return next()
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Requiere rol admin' })
  next()
}

// Monta las rutas de autenticación en la app de Express.
export function mountAuthRoutes(app) {
  // Indica al frontend si el login está activo
  app.get('/api/auth/config', (_req, res) => res.json({ enabled: AUTH_ENABLED }))

  // Login
  app.post('/api/auth/login', async (req, res) => {
    if (!AUTH_ENABLED) return res.status(400).json({ error: 'Auth no configurado' })
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    res.json({ token: signToken(user), user: publicUser(user) })
  })

  // Datos del usuario actual
  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user, authEnabled: AUTH_ENABLED }))

  // --- Gestión de usuarios (solo admin) ---
  app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
    const { rows } = await query('SELECT id, email, name, role, comerciales, view_all, created_at FROM users ORDER BY created_at')
    res.json({ users: rows })
  })

  app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const name = String(req.body?.name || '').trim()
    const password = String(req.body?.password || '')
    const role = req.body?.role === 'admin' ? 'admin' : 'user'
    const { viewAll, comerciales } = parseScope(req.body)
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    if (!viewAll && comerciales.length === 0) return res.status(400).json({ error: 'Si no puede ver todo, asigna al menos un comercial' })
    try {
      const hash = await bcrypt.hash(password, 10)
      const { rows } = await query(
        `INSERT INTO users (email, name, password_hash, role, comerciales, view_all)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, email, name, role, comerciales, view_all, created_at`,
        [email, name || null, hash, role, JSON.stringify(comerciales), viewAll]
      )
      res.json({ user: rows[0] })
    } catch (e) {
      if (String(e.message).includes('duplicate')) return res.status(409).json({ error: 'Ese email ya existe' })
      res.status(500).json({ error: String(e.message) })
    }
  })

  // Editar usuario (rol, comerciales, alcance y, opcionalmente, contraseña)
  app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id)
    const role = req.body?.role === 'admin' ? 'admin' : 'user'
    const { viewAll, comerciales } = parseScope(req.body)
    if (!viewAll && comerciales.length === 0) return res.status(400).json({ error: 'Si no puede ver todo, asigna al menos un comercial' })
    try {
      await query('UPDATE users SET role=$1, comerciales=$2, view_all=$3 WHERE id=$4', [role, JSON.stringify(comerciales), viewAll, id])
      const newPass = String(req.body?.password || '')
      if (newPass) {
        if (newPass.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
        await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(newPass, 10), id])
      }
      const { rows } = await query('SELECT id, email, name, role, comerciales, view_all, created_at FROM users WHERE id=$1', [id])
      res.json({ user: rows[0] })
    } catch (e) {
      res.status(500).json({ error: String(e.message) })
    }
  })

  app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id)
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' })
    await query('DELETE FROM users WHERE id = $1', [id])
    res.json({ ok: true })
  })
}
