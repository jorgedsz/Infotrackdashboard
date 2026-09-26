// Configuración de pipelines (comercial + IA). Solo admin; el backend la guarda
// en la base de datos y refresca GoHighLevel al guardar.
import { apiFetch } from './http'

// { comercial: id|null, ia: [{ id, alias }], pipelines: [{ id, nombre, etapas }] }
export async function loadPipelinesConfig() {
  const data = await apiFetch('/api/pipelines/config')
  return {
    comercial: data.comercial ?? null,
    ia: data.ia || [],
    pipelines: data.pipelines || [],
  }
}

export async function savePipelinesConfig({ comercial, ia }) {
  return apiFetch('/api/pipelines/config', { method: 'PUT', body: { comercial, ia } })
}
