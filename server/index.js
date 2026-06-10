import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getCustomFields, getPipelines, searchOpportunities, getUsers } from './ghl.js'
import { mapAll, FIELD_MAP } from './mapping.js'
import { initDb, AUTH_ENABLED } from './db.js'
import { mountAuthRoutes, requireAuth, requireAdmin } from './auth.js'
import { mountMetricsRoutes } from './metrics.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const LOCATION = process.env.GHL_LOCATION_ID
const PIPELINE = process.env.GHL_PIPELINE_ID || null
const REFRESH_MS = Number(process.env.REFRESH_MS || 30 * 1000) // 30 s

const configured = () => Boolean(process.env.GHL_TOKEN && LOCATION)

// Seed local opcional (no versionado): si existe src/data/pipeline.json lo usa
// como fallback offline; si no, arranca vacío y espera la data de GHL.
const SEED_PATH = join(__dirname, '../src/data/pipeline.json')
const seed = existsSync(SEED_PATH) ? JSON.parse(readFileSync(SEED_PATH, 'utf8')) : []

let cache = { rows: seed, source: 'seed', updatedAt: null, error: null }

async function refresh() {
  if (!configured()) {
    cache = { rows: seed, source: 'seed', updatedAt: new Date().toISOString(), error: 'GHL no configurado' }
    return cache
  }
  try {
    const [fields, pipelines, users, opps] = await Promise.all([
      getCustomFields(LOCATION, 'opportunity'),
      getPipelines(LOCATION),
      getUsers(LOCATION),
      searchOpportunities(LOCATION, PIPELINE),
    ])
    const keyById = Object.fromEntries(fields.map((f) => [f.id, f.fieldKey]))
    const stageById = {}
    for (const p of pipelines) for (const s of p.stages || []) stageById[s.id] = s.name
    const userById = Object.fromEntries(users.map((u) => [u.id, u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim()]))
    const rows = mapAll(opps, { keyById, stageById, userById })
    cache = { rows, source: 'ghl', updatedAt: new Date().toISOString(), error: null }
  } catch (e) {
    cache = { ...cache, source: 'ghl-error', error: String(e.message || e), updatedAt: new Date().toISOString() }
  }
  return cache
}

// --- Auth + métricas compartidas ---
mountAuthRoutes(app)
mountMetricsRoutes(app)

// --- Endpoints ---
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, configured: configured(), authEnabled: AUTH_ENABLED, source: cache.source, updatedAt: cache.updatedAt, rows: cache.rows.length, error: cache.error })
)

// Restringe las filas según el usuario: admin o "ver todo" => todo;
// si no, solo las oportunidades de su comercial asignado.
function rowsForUser(user) {
  if (!AUTH_ENABLED || !user) return cache.rows
  if (user.role === 'admin' || user.view_all) return cache.rows
  const asignados = Array.isArray(user.comerciales) ? user.comerciales : []
  if (asignados.length === 0) return [] // restringido sin comerciales => nada
  const set = new Set(asignados)
  return cache.rows.filter((r) => set.has(r.comercial))
}

// Filas crudas del pipeline (protegido y filtrado por usuario cuando AUTH está activo).
app.get('/api/pipeline', requireAuth, (req, res) =>
  res.json({ rows: rowsForUser(req.user), source: cache.source, updatedAt: cache.updatedAt, error: cache.error })
)

// Lista de comerciales (para asignar a usuarios). Solo admin.
app.get('/api/comerciales', requireAuth, requireAdmin, (_req, res) => {
  const set = [...new Set(cache.rows.map((r) => r.comercial).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'es')
  )
  res.json({ comerciales: set })
})

// Fuerza un refresh manual desde GHL.
app.post('/api/refresh', requireAuth, async (_req, res) => res.json(await refresh()))
app.get('/api/refresh', requireAuth, async (_req, res) => res.json(await refresh()))

// --- Descubrimiento (para armar el mapeo de custom fields) ---
app.get('/api/ghl/custom-fields', async (req, res) => {
  try {
    const fields = await getCustomFields(LOCATION, req.query.model || 'opportunity')
    res.json(fields.map((f) => ({ id: f.id, name: f.name, dataType: f.dataType, fieldKey: f.fieldKey })))
  } catch (e) { res.status(500).json({ error: String(e.message || e) }) }
})
app.get('/api/ghl/pipelines', async (_req, res) => {
  try {
    const pipelines = await getPipelines(LOCATION)
    res.json(pipelines.map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s) => s.name) })))
  } catch (e) { res.status(500).json({ error: String(e.message || e) }) }
})
// Muestra el mapeo actual + qué columnas quedaron sin custom field correspondiente.
app.get('/api/ghl/mapping-check', async (_req, res) => {
  try {
    const fields = await getCustomFields(LOCATION, 'opportunity')
    const keys = new Set(fields.map((f) => f.fieldKey))
    const check = Object.entries(FIELD_MAP).map(([col, key]) => ({ columna: col, fieldKey: key, existe: keys.has(key) }))
    res.json({ check, faltantes: check.filter((c) => !c.existe).map((c) => c.fieldKey) })
  } catch (e) { res.status(500).json({ error: String(e.message || e) }) }
})

// --- En producción, servir el frontend compilado (dist) + fallback SPA ---
const DIST = join(__dirname, '../dist')
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(join(DIST, 'index.html')))
}

app.listen(PORT, async () => {
  console.log(`[infotrack] API en http://localhost:${PORT} | GHL ${configured() ? 'configurado' : 'NO configurado (usando seed)'}`)
  try { await initDb() } catch (e) { console.error('[infotrack] Error init DB:', e.message) }
  await refresh()
  if (configured()) setInterval(refresh, REFRESH_MS)
})
