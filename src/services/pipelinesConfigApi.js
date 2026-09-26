// Configuración de pipelines (comercial + IA). Solo admin; el backend la guarda
// en la base de datos y refresca GoHighLevel al guardar.
import { apiFetch } from './http'

// { comercial, comercialExiste, ia: [{ id, alias, existe }], pipelines: [{ id, nombre, etapas }] }
// `existe`/`comercialExiste` en false = el id está configurado pero GoHighLevel
// ya no lo devuelve (borrado, otra sub-cuenta, o semilla vieja de las env vars).
export async function loadPipelinesConfig() {
  const data = await apiFetch('/api/pipelines/config')
  return {
    comercial: data.comercial ?? null,
    comercialExiste: data.comercialExiste !== false,
    ia: data.ia || [],
    pipelines: data.pipelines || [],
  }
}

export async function savePipelinesConfig({ comercial, ia }) {
  return apiFetch('/api/pipelines/config', { method: 'PUT', body: { comercial, ia } })
}
