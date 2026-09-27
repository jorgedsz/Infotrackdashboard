// Tablas de cálculo (márgenes por línea, probabilidades, KARE, aliado→arquitecto).
// Viven en la base de datos y se editan en Configuración → Tablas de cálculo.
import { apiFetch } from './http'

export async function loadTablas() {
  try {
    const data = await apiFetch('/api/tablas')
    return { tablas: data.tablas || null, defecto: data.defecto || null, definicion: data.definicion || [], error: null }
  } catch (e) {
    // Si no se pueden cargar, el frontend calcula con los valores del código.
    return { tablas: null, defecto: null, definicion: [], error: String(e.message || e) }
  }
}

export const saveTablas = (tablas) => apiFetch('/api/tablas', { method: 'PUT', body: { tablas } })
