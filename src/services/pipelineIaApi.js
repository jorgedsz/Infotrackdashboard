// Carga las filas de los pipelines IA desde el backend (/api/pipeline-ia).
// Vienen todos los agentes seleccionados juntos; cada fila trae el suyo en `agente`.
import { apiFetch } from './http'

export async function loadPipelineIA() {
  try {
    const data = await apiFetch('/api/pipeline-ia')
    return {
      rows: data.rows || [],
      agentes: data.agentes || [],
      updatedAt: data.updatedAt || null,
      error: data.error || null,
    }
  } catch (e) {
    return { rows: [], agentes: [], updatedAt: null, error: String(e.message || e) }
  }
}
