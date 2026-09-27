// Fotos del pipeline para la hoja "Evol.Pipeline" del Excel: cómo se mueve el
// pipeline de una semana a otra (Abierta / Ganada / Perdida y sus variaciones).
//
// El dashboard lee GoHighLevel en vivo, así que sin guardar nada no hay pasado
// que comparar. Acá se archiva una foto por día (la última del día manda) y la
// vista compara las dos fechas que se elijan.
import { query, AUTH_ENABLED } from './db.js'
import { requireAuth, requireAdmin } from './auth.js'

// Agrupa el booking y el conteo por una dimensión de las filas crudas.
// Se usa `bookingTotal` porque es lo que compara el Excel y porque viene del
// mapeo, sin depender del motor de cálculo del frontend.
function agrupar(rows, campo) {
  const out = {}
  for (const r of rows) {
    const k = r[campo] === '' || r[campo] == null ? '(sin dato)' : String(r[campo])
    const cur = out[k] || { oportunidades: 0, booking: 0 }
    cur.oportunidades += 1
    cur.booking += r.bookingTotal || 0
    out[k] = cur
  }
  return out
}

export const resumenDe = (rows) => ({
  oportunidades: rows.length,
  booking: rows.reduce((a, r) => a + (r.bookingTotal || 0), 0),
  porEstado: agrupar(rows, 'estado'),
  porFase: agrupar(rows, 'fase'),
  porComercial: agrupar(rows, 'comercial'),
})

export async function initSnapshots() {
  if (!AUTH_ENABLED) return
  await query(`
    CREATE TABLE IF NOT EXISTS pipeline_snapshots (
      fecha DATE PRIMARY KEY,
      datos JSONB NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Guarda (o actualiza) la foto de hoy. Sin base de datos no hay histórico.
export async function guardarSnapshot(rows) {
  if (!AUTH_ENABLED || !rows.length) return null
  const datos = resumenDe(rows)
  await query(
    `INSERT INTO pipeline_snapshots (fecha, datos) VALUES ($1, $2)
     ON CONFLICT (fecha) DO UPDATE SET datos = EXCLUDED.datos, creado_en = now()`,
    [hoyISO(), datos]
  )
  return datos
}

// Una sola foto por día: si la de hoy ya está, no se vuelve a escribir en cada
// refresh (que corre cada 30 s).
let ultimaGuardada = null
export async function guardarSnapshotDiario(rows) {
  const hoy = hoyISO()
  if (ultimaGuardada === hoy || !AUTH_ENABLED || !rows.length) return
  try {
    await guardarSnapshot(rows)
    ultimaGuardada = hoy
    console.log(`[infotrack] foto del pipeline guardada (${hoy})`)
  } catch (e) {
    console.warn('[infotrack] no se pudo guardar la foto del pipeline:', e.message)
  }
}

export function mountSnapshotsRoutes(app, { rowsActuales } = {}) {
  // Histórico: las fotos guardadas, de la más antigua a la más reciente.
  app.get('/api/snapshots', requireAuth, async (req, res) => {
    if (!AUTH_ENABLED) {
      return res.json({ snapshots: [], sinHistorico: true })
    }
    try {
      const limite = Math.min(Number(req.query.limite) || 60, 365)
      const { rows } = await query(
        'SELECT fecha, datos FROM pipeline_snapshots ORDER BY fecha DESC LIMIT $1',
        [limite]
      )
      res.json({
        snapshots: rows
          .map((r) => ({ fecha: r.fecha.toISOString?.().slice(0, 10) || String(r.fecha), datos: r.datos }))
          .reverse(),
      })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  // Fuerza la foto de hoy (útil para no esperar al primer refresh del día).
  app.post('/api/snapshots', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const datos = await guardarSnapshot(rowsActuales?.() || [])
      if (!datos) return res.status(400).json({ error: 'Sin datos que archivar (o sin base de datos)' })
      res.json({ ok: true, fecha: hoyISO(), datos })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })
}
