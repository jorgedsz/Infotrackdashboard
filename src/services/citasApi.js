// Carga las citas de las oportunidades en etapa "Cita Agendada" (/api/citas).
import { apiFetch } from './http'

export async function loadCitas() {
  try {
    const data = await apiFetch('/api/citas')
    return { rows: data.rows || [], updatedAt: data.updatedAt || null, error: data.error || null }
  } catch (e) {
    return { rows: [], updatedAt: null, error: String(e.message || e) }
  }
}
