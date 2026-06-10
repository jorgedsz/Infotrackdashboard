// Vistas (presets de filtros) PERSONALES de cada usuario, guardadas en la DB.
import { query, AUTH_ENABLED } from './db.js'
import { requireAuth } from './auth.js'

export function mountViewsRoutes(app) {
  if (!AUTH_ENABLED) return // dev sin DB: el frontend usa localStorage

  app.get('/api/views', requireAuth, async (req, res) => {
    const { rows } = await query(
      'SELECT id, name, state FROM views WHERE owner_id = $1 ORDER BY created_at',
      [req.user.id]
    )
    res.json({ views: rows })
  })

  app.put('/api/views/:id', requireAuth, async (req, res) => {
    const id = String(req.params.id)
    const name = String(req.body?.name || '').trim()
    const state = req.body?.state
    if (!name || !state) return res.status(400).json({ error: 'Nombre y estado requeridos' })
    await query(
      `INSERT INTO views (id, owner_id, name, state) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state
       WHERE views.owner_id = $2`,
      [id, req.user.id, name, state]
    )
    res.json({ ok: true })
  })

  app.delete('/api/views/:id', requireAuth, async (req, res) => {
    await query('DELETE FROM views WHERE id = $1 AND owner_id = $2', [String(req.params.id), req.user.id])
    res.json({ ok: true })
  })
}
