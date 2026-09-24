// Selección de pipelines IA (uno por agente). La configura un admin desde
// Pipeline IA → Pipelines y el backend la guarda en la base de datos.
import { apiFetch } from './http'

// Los pipelines IA activos hoy: [{ id, alias, nombre, agente, existe }]
export async function loadIaPipelines() {
  try {
    const data = await apiFetch('/api/ia-pipelines')
    return { pipelines: data.pipelines || [], error: null }
  } catch (e) {
    return { pipelines: [], error: String(e.message || e) }
  }
}

// Catálogo completo de la location para la pantalla de configuración (solo admin).
export async function loadPipelinesDisponibles() {
  const data = await apiFetch('/api/ia-pipelines/disponibles')
  return data.pipelines || []
}

// Reemplaza la selección completa: [{ id, alias }] en el orden deseado.
export async function saveIaPipelines(pipelines) {
  return apiFetch('/api/ia-pipelines', { method: 'PUT', body: { pipelines } })
}
