// Acceso a las métricas compartidas del servidor (cuando hay base de datos/auth).
import { apiFetch } from './http'

export const fetchSharedMetrics = async () => (await apiFetch('/api/metrics')).metrics || []
export const upsertSharedMetric = (def) => apiFetch(`/api/metrics/${def.id}`, { method: 'PUT', body: { def } })
export const deleteSharedMetric = (id) => apiFetch(`/api/metrics/${id}`, { method: 'DELETE' })
