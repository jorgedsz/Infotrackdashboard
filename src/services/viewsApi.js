// Vistas personales: del servidor (con auth) o de localStorage (sin auth).
import { apiFetch } from './http'

const LS_KEY = 'infotrack.views.v1'

const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || [] } catch { return [] }
}
const saveLocal = (views) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(views)) } catch { /* noop */ }
}

// authEnabled decide la fuente
export async function listViews(authEnabled) {
  if (authEnabled) return (await apiFetch('/api/views')).views || []
  return loadLocal()
}

export async function saveView(authEnabled, view, allViews) {
  if (authEnabled) {
    await apiFetch(`/api/views/${view.id}`, { method: 'PUT', body: { name: view.name, state: view.state } })
  } else {
    saveLocal(allViews)
  }
}

export async function removeView(authEnabled, id, remaining) {
  if (authEnabled) await apiFetch(`/api/views/${id}`, { method: 'DELETE' })
  else saveLocal(remaining)
}
