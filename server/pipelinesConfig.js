// Configuración de pipelines editable desde la interfaz (solo admin):
//   - cuál es el pipeline COMERCIAL (o "todas las oportunidades")
//   - cuáles son los pipelines IA, uno por agente (ver iaPipelines.js)
//
// Reemplaza a las variables GHL_PIPELINE_ID y GHL_PIPELINE_IA, que ahora solo
// siembran la configuración la primera vez que se arranca con la DB vacía.
import { query, AUTH_ENABLED } from './db.js'
import { requireAuth, requireAdmin } from './auth.js'
import { getPipelines } from './ghl.js'
import { getIaPipelines, setIaPipelines } from './iaPipelines.js'

// Tabla clave/valor para la configuración general del dashboard.
const CLAVE_COMERCIAL = 'pipeline_comercial'

// Distinguimos tres estados: sin configurar (cae a la env var), un pipeline
// concreto, o null = todas las oportunidades de la location.
let comercialMem = { configurado: false, id: process.env.GHL_PIPELINE_ID || null }

export async function initPipelinesConfig() {
  if (!AUTH_ENABLED) return
  await query(`
    CREATE TABLE IF NOT EXISTS app_config (
      clave TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  // Primer arranque tras el cambio: migra lo que hubiera en GHL_PIPELINE_ID.
  const semilla = process.env.GHL_PIPELINE_ID || null
  if (semilla) {
    const { rowCount } = await query(
      'INSERT INTO app_config (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING',
      [CLAVE_COMERCIAL, JSON.stringify({ id: semilla })]
    )
    if (rowCount) console.log('[infotrack] pipeline comercial sembrado desde GHL_PIPELINE_ID')
  }
}

// Pipeline comercial vigente: id, o null para traer todas las oportunidades.
// Nunca lanza: si la DB falla seguimos con lo último conocido.
export async function getPipelineComercial() {
  if (!AUTH_ENABLED) return comercialMem.id
  try {
    const { rows } = await query('SELECT valor FROM app_config WHERE clave = $1', [CLAVE_COMERCIAL])
    // Sin fila la configuración no se ha tocado: vale la env var (o todas).
    if (rows.length) comercialMem = { configurado: true, id: rows[0].valor?.id ?? null }
  } catch (e) {
    console.warn('[infotrack] no se pudo leer el pipeline comercial, uso el último:', e.message)
  }
  return comercialMem.id
}

async function setPipelineComercial(id) {
  const limpio = id ? String(id).trim() : null
  comercialMem = { configurado: true, id: limpio }
  if (!AUTH_ENABLED) return limpio
  await query(
    `INSERT INTO app_config (clave, valor, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
    [CLAVE_COMERCIAL, JSON.stringify({ id: limpio })]
  )
  return limpio
}

// onChange: se llama tras guardar para refrescar la data con la nueva configuración.
export function mountPipelinesConfigRoutes(app, { locationId, onChange } = {}) {
  // Todo lo que necesita la pantalla de Configuración en una sola llamada.
  app.get('/api/pipelines/config', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [pipelines, ia, comercial] = await Promise.all([
        getPipelines(locationId),
        getIaPipelines(),
        getPipelineComercial(),
      ])
      // Un id configurado puede no estar en el catálogo (pipeline borrado en GHL,
      // otra sub-cuenta, o una semilla vieja de las env vars). Lo marcamos para
      // que la pantalla lo muestre en vez de arrastrarlo invisible.
      const ids = new Set(pipelines.map((p) => p.id))
      res.json({
        comercial,
        comercialExiste: comercial ? ids.has(comercial) : true,
        ia: ia.map((p) => ({ id: p.id, alias: p.alias, existe: ids.has(p.id) })),
        pipelines: pipelines.map((p) => ({
          id: p.id,
          nombre: p.name,
          etapas: (p.stages || []).map((s) => s.name),
        })),
      })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  // Guarda ambas cosas juntas: body { comercial: id|null, ia: [{ id, alias }] }
  app.put('/api/pipelines/config', requireAuth, requireAdmin, async (req, res) => {
    const ia = Array.isArray(req.body?.ia) ? req.body.ia : null
    if (!ia) return res.status(400).json({ error: 'Se espera { comercial, ia: [...] }' })
    const comercial = req.body.comercial ? String(req.body.comercial).trim() : null
    try {
      // Validamos contra GHL para atajar ids mal escritos. Si GHL no responde,
      // guardamos igual: no vale bloquear la configuración por eso.
      const ids = await idsDeGhl(locationId)
      if (ids) {
        const desconocidos = [comercial, ...ia.map((p) => p?.id)]
          .filter(Boolean)
          .filter((id) => !ids.has(String(id).trim()))
        if (desconocidos.length) {
          return res.status(400).json({
            error: `Estos pipelines no están en la cuenta ${locationId}: ${desconocidos.join(', ')}. `
              + 'Pueden haber sido borrados en GoHighLevel o pertenecer a otra sub-cuenta. '
              + 'Elige uno de la lista o quita la marca.',
          })
        }
      }
      const guardados = { comercial: await setPipelineComercial(comercial), ia: await setIaPipelines(ia) }
      if (onChange) onChange().catch((e) => console.warn('[infotrack] refresh tras guardar config:', e.message))
      res.json({ ok: true, ...guardados })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })
}

// Set de ids válidos, o null si GHL no respondió.
async function idsDeGhl(locationId) {
  try {
    const pipelines = await getPipelines(locationId)
    return new Set(pipelines.map((p) => p.id))
  } catch {
    return null
  }
}
