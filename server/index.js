import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getCustomFields, getPipelines, searchOpportunities, getUsers } from './ghl.js'
import { mapAll, FIELD_MAP } from './mapping.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())

const PORT = process.env.PORT || 3001
const LOCATION = process.env.GHL_LOCATION_ID
const PIPELINE = process.env.GHL_PIPELINE_ID || null
const REFRESH_MS = Number(process.env.REFRESH_MS || 5 * 60 * 1000) // 5 min

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

// --- Endpoints ---
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, configured: configured(), source: cache.source, updatedAt: cache.updatedAt, rows: cache.rows.length, error: cache.error })
)

// Filas crudas del pipeline (el frontend las enriquece con el motor de cálculo).
app.get('/api/pipeline', (_req, res) =>
  res.json({ rows: cache.rows, source: cache.source, updatedAt: cache.updatedAt, error: cache.error })
)

// Fuerza un refresh manual desde GHL.
app.post('/api/refresh', async (_req, res) => res.json(await refresh()))
app.get('/api/refresh', async (_req, res) => res.json(await refresh()))

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
  await refresh()
  if (configured()) setInterval(refresh, REFRESH_MS)
})
