// Capa de base de datos (PostgreSQL). Crea tablas si no existen y siembra el admin.
import pkg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pkg

export const AUTH_ENABLED = Boolean(process.env.DATABASE_URL)

// SSL: requerido en conexiones externas (Railway público), no en local/interno.
function sslConfig(url) {
  if (!url) return false
  if (/localhost|127\.0\.0\.1|\.railway\.internal/.test(url)) return false
  return { rejectUnauthorized: false }
}

export const pool = AUTH_ENABLED
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig(process.env.DATABASE_URL) })
  : null

export async function query(text, params) {
  if (!pool) throw new Error('Base de datos no configurada (falta DATABASE_URL)')
  return pool.query(text, params)
}

// Inicializa el esquema y crea el admin inicial desde variables de entorno.
// Reintenta ante fallos transitorios de red/DNS al arrancar.
export async function initDb(retries = 5) {
  if (!AUTH_ENABLED) {
    console.log('[infotrack] AUTH desactivado (no hay DATABASE_URL) — dashboard abierto en dev')
    return
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await initDbOnce()
    } catch (e) {
      if (attempt >= retries) throw e
      console.warn(`[infotrack] init DB intento ${attempt} falló (${e.message}); reintentando…`)
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

async function initDbOnce() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  // Columnas para relacionar usuario ↔ comercial(es) y alcance de visibilidad
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS comercial TEXT`)
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS view_all BOOLEAN NOT NULL DEFAULT true`)
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS comerciales JSONB NOT NULL DEFAULT '[]'`)
  // Migra el comercial único previo al arreglo, si aplica
  await query(`UPDATE users SET comerciales = to_jsonb(ARRAY[comercial])
               WHERE comercial IS NOT NULL AND comerciales = '[]'::jsonb`)
  // Métricas compartidas (guardadas en servidor)
  await query(`
    CREATE TABLE IF NOT EXISTS custom_metrics (
      id TEXT PRIMARY KEY,
      def JSONB NOT NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  // Vistas (presets de filtros) PERSONALES por usuario
  await query(`
    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  // Siembra del admin inicial
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  if (email && password) {
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [email])
    if (rows.length === 0) {
      const hash = await bcrypt.hash(password, 10)
      await query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
        [email, process.env.ADMIN_NAME || 'Admin', hash, 'admin']
      )
      console.log(`[infotrack] Admin inicial creado: ${email}`)
    }
  }
  console.log('[infotrack] Base de datos lista (AUTH activo)')
}
