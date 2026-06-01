// Carga las filas del pipeline desde el backend (/api/pipeline).
// La data real vive en GoHighLevel; no se empaqueta ningún seed en el repo.
export async function loadPipeline() {
  try {
    const res = await fetch('/api/pipeline', { cache: 'no-store' })
    if (!res.ok) throw new Error('backend ' + res.status)
    const data = await res.json()
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
