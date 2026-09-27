// Tablas de cálculo editables desde la interfaz (Configuración → Tablas de cálculo):
//   - márgenes MCB y MB por línea de producto
//   - probabilidad de cierre (texto de GHL -> fracción)
//   - KARE -> clasificación (Nuevo / Renovación)
//   - aliado -> arquitecto
//
// Antes vivían en el código (`src/data/lookups.json` y constantes de calc.js), así
// que un aliado nuevo o un margen ajustado obligaba a desplegar. Ahora se guardan
// en `app_config` y el frontend las recibe al cargar.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { query, AUTH_ENABLED } from './db.js'
import { requireAuth, requireAdmin } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLAVE = 'tablas_calculo'

// Mismos valores por defecto que usa el frontend, para no tener dos verdades.
const DEFECTO = (() => {
  try {
    const { _comentario, ...tablas } = JSON.parse(
      readFileSync(join(__dirname, '../src/data/tablasCalculo.json'), 'utf8')
    )
    return tablas
  } catch (e) {
    console.warn('[infotrack] no se pudo leer tablasCalculo.json:', e.message)
    return {}
  }
})()

// Las líneas de producto son un conjunto cerrado: si falta una, su margen sería 0
// y una columna del dashboard se vaciaría sin que nadie se enterara.
const LINEAS = ['sumhw', 'hwaas', 'svcs', 'swter', 'swss']

// Las tablas que existen, con su forma. `numerica` = los valores son números;
// `claves` = las entradas que deben estar todas presentes.
export const TABLAS = [
  { clave: 'mcb', etiqueta: 'Margen MCB por línea', numerica: true, claves: LINEAS },
  { clave: 'mb', etiqueta: 'Margen MB por línea', numerica: true, claves: LINEAS },
  { clave: 'probabilidad', etiqueta: 'Probabilidad de cierre', numerica: true },
  { clave: 'kareClasificacion', etiqueta: 'KARE → Tipo de venta', numerica: false },
  { clave: 'aliadoArquitecto', etiqueta: 'Aliado → Arquitecto', numerica: false },
]

let memoria = DEFECTO

export async function initTablas() {
  if (!AUTH_ENABLED) return
  // app_config la crea pipelinesConfig.js; si aún no existe, la creamos igual.
  await query(`
    CREATE TABLE IF NOT EXISTS app_config (
      clave TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  const { rowCount } = await query(
    'INSERT INTO app_config (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING',
    [CLAVE, JSON.stringify(DEFECTO)]
  )
  if (rowCount) console.log('[infotrack] tablas de cálculo sembradas desde tablasCalculo.json')
}

// Nunca lanza: si la DB falla seguimos con lo último conocido (o los defaults).
export async function getTablas() {
  if (!AUTH_ENABLED) return memoria
  try {
    const { rows } = await query('SELECT valor FROM app_config WHERE clave = $1', [CLAVE])
    if (rows.length) memoria = { ...DEFECTO, ...rows[0].valor }
  } catch (e) {
    console.warn('[infotrack] no se pudieron leer las tablas de cálculo:', e.message)
  }
  return memoria
}

// Deja solo las tablas conocidas y con la forma correcta, para que un cliente
// no meta basura que luego rompa el cálculo.
function sanear(entrada) {
  const out = {}
  for (const { clave, numerica } of TABLAS) {
    const tabla = entrada?.[clave]
    if (!tabla || typeof tabla !== 'object') continue
    const limpia = {}
    for (const [k, v] of Object.entries(tabla)) {
      const nombre = String(k).trim()
      if (!nombre) continue
      if (numerica) {
        // Un vacío no es 0: se descarta y luego la validación lo reporta.
        if (v === '' || v === null || v === undefined) continue
        const n = Number(v)
        if (Number.isFinite(n)) limpia[nombre] = n
      } else {
        limpia[nombre] = String(v ?? '')
      }
    }
    out[clave] = limpia
  }
  return out
}

export function mountTablasRoutes(app, { onChange } = {}) {
  // Las necesita cualquier usuario: el frontend calcula con ellas.
  app.get('/api/tablas', requireAuth, async (_req, res) => {
    try {
      res.json({ tablas: await getTablas(), defecto: DEFECTO, definicion: TABLAS })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  app.put('/api/tablas', requireAuth, requireAdmin, async (req, res) => {
    const saneadas = sanear(req.body?.tablas)
    if (!Object.keys(saneadas).length) {
      return res.status(400).json({ error: 'Se espera { tablas: { ... } }' })
    }
    // Las tablas de claves cerradas deben llegar completas y con números válidos:
    // una línea ausente se calcularía como 0 % sin avisar.
    for (const { clave, claves, etiqueta } of TABLAS) {
      if (!claves) continue
      const faltantes = claves.filter((k) => typeof saneadas[clave]?.[k] !== 'number')
      if (faltantes.length) {
        return res.status(400).json({
          error: `${etiqueta}: falta un porcentaje válido para ${faltantes.join(', ').toUpperCase()}`,
        })
      }
    }
    try {
      memoria = { ...DEFECTO, ...saneadas }
      if (AUTH_ENABLED) {
        await query(
          `INSERT INTO app_config (clave, valor, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
          [CLAVE, JSON.stringify(memoria)]
        )
      }
      onChange?.()
      res.json({ ok: true, tablas: memoria })
    } catch (e) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })
}
