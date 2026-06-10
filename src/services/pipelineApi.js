// Carga las filas del pipeline desde el backend (/api/pipeline) con el token de sesión.
// La data real vive en GoHighLevel; no se empaqueta ningún seed en el repo.
import { apiFetch } from './http'

export async function loadPipeline() {
  try {
    const data = await apiFetch('/api/pipeline')
    return {
      rows: data.rows || [],
      source: data.source || 'backend',
      updatedAt: data.updatedAt || null,
      error: data.error || null,
    }
  } catch (e) {
    return { rows: [], source: 'sin-backend', updatedAt: null, error: String(e.message || e) }
  }
}
