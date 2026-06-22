// Carga las filas del pipeline IA desde el backend (/api/pipeline-ia).
import { apiFetch } from './http'

export async function loadPipelineIA() {
  try {
    const data = await apiFetch('/api/pipeline-ia')
    return { rows: data.rows || [], updatedAt: data.updatedAt || null, error: data.error || null }
  } catch (e) {
    return { rows: [], updatedAt: null, error: String(e.message || e) }
  }
}
