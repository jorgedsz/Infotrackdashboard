import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getCustomFields, getPipelines, searchOpportunities, getUsers, getCalendars, getContactAppointments } from './ghl.js'
import { mapAll, FIELD_MAP, fieldKeysDe } from './mapping.js'
import { mapAllIA } from './mappingIA.js'
import { mapAllCitas } from './mappingCitas.js'
import { initDb, AUTH_ENABLED } from './db.js'
import { mountAuthRoutes, requireAuth, requireAdmin } from './auth.js'
import { mountMetricsRoutes } from './metrics.js'
import { mountViewsRoutes } from './views.js'
import { initIaPipelines, getIaPipelines, etiquetaAgente } from './iaPipelines.js'
import { initPipelinesConfig, getPipelineComercial, mountPipelinesConfigRoutes } from './pipelinesConfig.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const LOCATION = process.env.GHL_LOCATION_ID
const REFRESH_MS = Number(process.env.REFRESH_MS || 30 * 1000) // 30 s
// Qué pipelines se leen ya no se fija acá: el comercial y los de IA se eligen
// desde Configuración y se guardan en la DB (ver server/pipelinesConfig.js).

const configured = () => Boolean(process.env.GHL_TOKEN && LOCATION)

// Seed local opcional (no versionado): si existe src/data/pipeline.json lo usa
// como fallback offline; si no, arranca vacío y espera la data de GHL.
const SEED_PATH = join(__dirname, '../src/data/pipeline.json')
const seed = existsSync(SEED_PATH) ? JSON.parse(readFileSync(SEED_PATH, 'utf8')) : []

let cache = { rows: seed, source: 'seed', updatedAt: null, error: null }
let cacheIA = { rows: [], agentes: [], source: 'seed', updatedAt: null, error: null }
let cacheCitas = { rows: [], source: 'seed', updatedAt: null, error: null }

// Etapas cuyo nombre indica que hay una cita agendada (hoy: "Cita Agendada").
const ES_ETAPA_CITA = /cita/i
// Tope de contactos a consultar por refresh: cada uno es una llamada extra a GHL.
// Es un tope COMPARTIDO entre todos los pipelines IA; súbelo si al agregar
// agentes empiezan a quedar citas fuera (el arranque avisa por consola).
const MAX_CONTACTOS_CITA = Number(process.env.MAX_CONTACTOS_CITA || 300)

// Ejecuta las promesas de a `limite` en paralelo; los fallos individuales no
// tumban el lote (esa cita simplemente queda sin traer).
async function enLotes(items, limite, fn) {
  const out = []
  for (let i = 0; i < items.length; i += limite) {
    const lote = items.slice(i, i + limite)
    const res = await Promise.all(lote.map((it) => fn(it).catch(() => null)))
    out.push(...res)
  }
  return out
}

// Última tanda buena de cada pipeline IA, para no vaciar a un agente cuando GHL
// falla de forma pasajera (429, 503, conexión cortada).
const ultimasOppsIA = new Map()

// Trae las oportunidades de TODOS los pipelines IA seleccionados. Cada pipeline
// se consulta por separado: si uno falla (id borrado en GHL, permisos, un corte),
// los demás igual entran, se sirve la última data buena del que falló y el error
// se reporta en la respuesta.
async function traerOppsIA(pipelinesIA) {
  const fallos = []
  const lotes = await Promise.all(
    pipelinesIA.map(async (p) => {
      try {
        const opps = await searchOpportunities(LOCATION, p.id)
        // La oportunidad ya trae pipelineId, pero lo fijamos con el pipeline que
        // consultamos: así ninguna fila queda sin agente si la API lo omite.
        const conAgente = opps.map((o) => ({ ...o, pipelineId: o.pipelineId || p.id }))
        ultimasOppsIA.set(p.id, conAgente)
        return conAgente
      } catch (e) {
        const previas = ultimasOppsIA.get(p.id) || []
        fallos.push({ id: p.id, error: String(e.message || e), conservadas: previas.length })
        return previas
      }
    })
  )
  // Un pipeline que se deselecciona no debe seguir ocupando memoria.
  const vigentes = new Set(pipelinesIA.map((p) => p.id))
  for (const id of ultimasOppsIA.keys()) if (!vigentes.has(id)) ultimasOppsIA.delete(id)
  return { opps: lotes.flat(), fallos }
}

// Aviso para la pestaña IA: nombra al agente (no el id) y dice si lo que se ve
// es su última data buena o si quedó sin nada.
function avisoFallosIA(fallos, agenteById) {
  return fallos
    .map(({ id, error, conservadas }) => {
      const quien = agenteById[id] || id
      const estado = conservadas
        ? `mostrando ${conservadas} contacto(s) del último refresco correcto`
        : 'sin data para este agente'
      return `${quien}: ${error} — ${estado}`
    })
    .join(' | ')
}

// Trae las citas de las oportunidades que están en etapa de cita agendada.
// Una oportunidad puede compartir contacto con otra: deduplicamos por contacto
// para no contar la misma cita dos veces. Si el mismo contacto aparece en dos
// pipelines IA, sus citas quedan atribuidas al primer agente que lo trajo.
async function traerCitas(oppsIA, ctx) {
  const enCita = oppsIA.filter((o) => ES_ETAPA_CITA.test(ctx.stageById?.[o.pipelineStageId] || ''))
  const porContacto = new Map()
  for (const o of enCita) {
    const cid = o.contactId || o.contact?.id
    if (cid && !porContacto.has(cid)) porContacto.set(cid, o)
  }
  let pares = [...porContacto.entries()]
  if (pares.length > MAX_CONTACTOS_CITA) {
    console.warn(`[infotrack] ${pares.length} contactos en etapa de cita; consultando solo los primeros ${MAX_CONTACTOS_CITA}`)
    pares = pares.slice(0, MAX_CONTACTOS_CITA)
  }
  const res = await enLotes(pares, 5, async ([cid, opp]) => ({ opp, citas: await getContactAppointments(cid) }))
  return mapAllCitas(res.filter(Boolean), ctx)
}

async function refresh() {
  if (!configured()) {
    cache = { rows: seed, source: 'seed', updatedAt: new Date().toISOString(), error: 'GHL no configurado' }
    return cache
  }
  try {
    const [pipelinesIA, comercial] = await Promise.all([getIaPipelines(), getPipelineComercial()])
    const [fields, pipelines, users, calendars, opps, ia] = await Promise.all([
      getCustomFields(LOCATION, 'opportunity'),
      getPipelines(LOCATION),
      getUsers(LOCATION),
      getCalendars(LOCATION).catch(() => []), // sin calendarios seguimos: solo perdemos el nombre
      searchOpportunities(LOCATION, comercial),
      traerOppsIA(pipelinesIA),
    ])
    const keyById = Object.fromEntries(fields.map((f) => [f.id, f.fieldKey]))
    const stageById = {}
    for (const p of pipelines) for (const s of p.stages || []) stageById[s.id] = s.name
    const userById = Object.fromEntries(users.map((u) => [u.id, u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim()]))
    const calendarById = Object.fromEntries(calendars.map((c) => [c.id, c.name]))
    // Nombre del agente por pipeline: alias del admin, o el nombre que tiene en GHL.
    const nombreGhl = Object.fromEntries(pipelines.map((p) => [p.id, p.name]))
    const agenteById = Object.fromEntries(pipelinesIA.map((p) => [p.id, etiquetaAgente(p, nombreGhl[p.id])]))
    const now = new Date().toISOString()
    cache = { rows: mapAll(opps, { keyById, stageById, userById }), source: 'ghl', updatedAt: now, error: null }
    cacheIA = {
      rows: mapAllIA(ia.opps, { stageById, userById, agenteById }),
      agentes: pipelinesIA.map((p) => ({ id: p.id, agente: agenteById[p.id] })),
      source: 'ghl',
      updatedAt: now,
      error: ia.fallos.length
        ? `GoHighLevel falló en ${ia.fallos.length} pipeline(s) IA — ${avisoFallosIA(ia.fallos, agenteById)}`
        : null,
    }
    // Las citas dependen de una llamada por contacto: si fallan, el resto del
    // refresh igual queda servido y se conserva el último set bueno.
    try {
      cacheCitas = {
        rows: await traerCitas(ia.opps, { stageById, userById, calendarById, agenteById }),
        source: 'ghl', updatedAt: now, error: null,
      }
    } catch (e) {
      cacheCitas = { ...cacheCitas, source: 'ghl-error', error: String(e.message || e), updatedAt: now }
    }
  } catch (e) {
    cache = { ...cache, source: 'ghl-error', error: String(e.message || e), updatedAt: new Date().toISOString() }
  }
  return cache
}

// --- Auth + métricas compartidas + vistas personales ---
mountAuthRoutes(app)
mountMetricsRoutes(app)
mountViewsRoutes(app)
// Configuración de pipelines (comercial + IA), editable desde la interfaz.
// Al guardar disparamos un refresh para que la data nueva entre ya.
mountPipelinesConfigRoutes(app, { locationId: LOCATION, onChange: refresh })

// --- Endpoints ---
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, configured: configured(), authEnabled: AUTH_ENABLED, source: cache.source, updatedAt: cache.updatedAt, rows: cache.rows.length, rowsIA: cacheIA.rows.length, pipelinesIA: cacheIA.agentes?.length || 0, citas: cacheCitas.rows.length, error: cache.error })
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

// Pipelines IA (uno por agente) — visible para todos los usuarios autenticados.
// Vienen todos los agentes seleccionados en un mismo set; cada fila trae el suyo
// en `agente` y el frontend filtra desde ahí.
app.get('/api/pipeline-ia', requireAuth, (_req, res) =>
  res.json({ rows: cacheIA.rows, agentes: cacheIA.agentes || [], source: cacheIA.source, updatedAt: cacheIA.updatedAt, error: cacheIA.error })
)

// Citas de las oportunidades en etapa "Cita Agendada" (una fila por cita).
app.get('/api/citas', requireAuth, (_req, res) =>
  res.json({ rows: cacheCitas.rows, source: cacheCitas.source, updatedAt: cacheCitas.updatedAt, error: cacheCitas.error })
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
// Solo admin: exponen la estructura del CRM (pipelines, etapas, campos).
app.get('/api/ghl/custom-fields', requireAuth, requireAdmin, async (req, res) => {
  try {
    const fields = await getCustomFields(LOCATION, req.query.model || 'opportunity')
    res.json(fields.map((f) => ({ id: f.id, name: f.name, dataType: f.dataType, fieldKey: f.fieldKey })))
  } catch (e) { res.status(500).json({ error: String(e.message || e) }) }
})
app.get('/api/ghl/pipelines', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const pipelines = await getPipelines(LOCATION)
    res.json(pipelines.map((p) => ({ id: p.id, name: p.name, stages: (p.stages || []).map((s) => s.name) })))
  } catch (e) { res.status(500).json({ error: String(e.message || e) }) }
})
// Muestra el mapeo actual + qué columnas quedaron sin custom field correspondiente.
app.get('/api/ghl/mapping-check', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const fields = await getCustomFields(LOCATION, 'opportunity')
    const keys = new Set(fields.map((f) => f.fieldKey))
    // Una columna puede tener varios fieldKeys candidatos: existe si alguno está.
    const check = Object.keys(FIELD_MAP).map((col) => {
      const candidatos = fieldKeysDe(col)
      const encontrado = candidatos.find((k) => keys.has(k)) || null
      return { columna: col, candidatos, fieldKey: encontrado, existe: Boolean(encontrado) }
    })
    res.json({
      check,
      faltantes: check.filter((c) => !c.existe).map((c) => ({ columna: c.columna, probados: c.candidatos })),
      // Para encontrar el nombre correcto de un campo que no se halló
      disponibles: [...keys].sort(),
    })
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
  try { await initIaPipelines() } catch (e) { console.error('[infotrack] Error init pipelines IA:', e.message) }
  try { await initPipelinesConfig() } catch (e) { console.error('[infotrack] Error init config de pipelines:', e.message) }
  await refresh()
  if (configured()) setInterval(refresh, REFRESH_MS)
})
