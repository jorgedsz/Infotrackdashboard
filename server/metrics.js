// Métricas personalizadas COMPARTIDAS, guardadas en la base de datos.
// Todos los usuarios autenticados las ven; cualquiera puede crear/editar/borrar.
import { query, AUTH_ENABLED } from './db.js'
import { requireAuth } from './auth.js'

export function mountMetricsRoutes(app) {
  // Sin DB (dev) no hay métricas compartidas; el frontend usa localStorage.
  if (!AUTH_ENABLED) return

  app.get('/api/metrics', requireAuth, async (_req, res) => {
    const { rows } = await query('SELECT def FROM custom_metrics ORDER BY created_at')
    res.json({ metrics: rows.map((r) => r.def) })
  })

  // Upsert (crear o actualizar) una métrica
  app.put('/api/metrics/:id', requireAuth, async (req, res) => {
    const id = String(req.params.id)
    const def = req.body?.def
    if (!def || def.id !== id) return res.status(400).json({ error: 'Definición inválida' })
    await query(
      `INSERT INTO custom_metrics (id, def, owner_id) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET def = EXCLUDED.def`,
      [id, def, req.user?.id || null]
    )
    res.json({ ok: true })
  })

  app.delete('/api/metrics/:id', requireAuth, async (req, res) => {
    await query('DELETE FROM custom_metrics WHERE id = $1', [String(req.params.id)])
    res.json({ ok: true })
  })
}
