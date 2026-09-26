// Pipelines IA seleccionados desde la interfaz: uno por agente.
//
// Antes había un único pipeline fijado en GHL_PIPELINE_IA. Ahora la selección
// vive en la tabla `ia_pipelines` y un admin la edita en Configuración, así que
// un pipeline nuevo en GHL solo hay que marcarlo — sin redeploy.
// Sin DATABASE_URL (dev) la selección queda en memoria, sembrada desde la env var.
// Las rutas HTTP están en pipelinesConfig.js, junto al pipeline comercial.
import { query, AUTH_ENABLED } from './db.js'

// La env var vieja sigue sirviendo de semilla y ahora admite varios ids separados por coma.
const semilla = () =>
  String(process.env.GHL_PIPELINE_IA || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id, i) => ({ id, alias: '', orden: i }))

// Con DB es la caché del último valor leído (para no tumbar el refresh si PG falla);
// sin DB es la selección misma, que se pierde al reiniciar.
let memoria = semilla()

export async function initIaPipelines() {
  if (!AUTH_ENABLED) return
  await query(`
    CREATE TABLE IF NOT EXISTS ia_pipelines (
      id TEXT PRIMARY KEY,
      alias TEXT,
      orden INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  // Primer arranque tras el cambio: migra lo que hubiera en GHL_PIPELINE_IA.
  const { rows } = await query('SELECT count(*)::int AS n FROM ia_pipelines')
  const inicial = semilla()
  if (rows[0].n === 0 && inicial.length) {
    for (const p of inicial) {
      await query('INSERT INTO ia_pipelines (id, alias, orden) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [p.id, null, p.orden])
    }
    console.log(`[infotrack] ia_pipelines sembrada desde GHL_PIPELINE_IA (${inicial.length})`)
  }
}

// Selección vigente: [{ id, alias, orden }]. Nunca lanza: si la DB falla
// devolvemos lo último conocido para que el refresh siga sirviendo data.
export async function getIaPipelines() {
  if (!AUTH_ENABLED) return memoria
  try {
    const { rows } = await query('SELECT id, alias, orden FROM ia_pipelines ORDER BY orden, id')
    memoria = rows.map((r) => ({ id: r.id, alias: r.alias || '', orden: r.orden }))
  } catch (e) {
    console.warn('[infotrack] no se pudo leer ia_pipelines, uso la última selección:', e.message)
  }
  return memoria
}

// Reemplaza la selección completa por la recibida.
export async function setIaPipelines(lista) {
  const limpia = []
  const vistos = new Set()
  for (const [i, p] of lista.entries()) {
    const id = String(p?.id || '').trim()
    if (!id || vistos.has(id)) continue
    vistos.add(id)
    limpia.push({ id, alias: String(p?.alias || '').trim(), orden: i })
  }
  if (!AUTH_ENABLED) {
    memoria = limpia
    return limpia
  }
  await query('DELETE FROM ia_pipelines')
  for (const p of limpia) {
    await query('INSERT INTO ia_pipelines (id, alias, orden) VALUES ($1, $2, $3)',
      [p.id, p.alias || null, p.orden])
  }
  memoria = limpia
  return limpia
}

// Nombre a mostrar del agente: alias del admin > nombre del pipeline en GHL > id.
export const etiquetaAgente = (sel, nombreGhl) => sel.alias || nombreGhl || sel.id

