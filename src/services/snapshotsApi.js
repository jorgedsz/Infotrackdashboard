// Histórico del pipeline (fotos diarias) para la vista de Evolución.
import { apiFetch } from './http'

export async function loadSnapshots() {
  try {
    const data = await apiFetch('/api/snapshots')
    return { snapshots: data.snapshots || [], sinHistorico: Boolean(data.sinHistorico), error: null }
  } catch (e) {
    return { snapshots: [], sinHistorico: false, error: String(e.message || e) }
  }
}

// Archiva la foto de hoy sin esperar al refresco automático (solo admin).
export const tomarSnapshot = () => apiFetch('/api/snapshots', { method: 'POST' })
