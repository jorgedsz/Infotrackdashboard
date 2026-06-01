// Cliente mínimo de la API de GoHighLevel (LeadConnector v2).
// Docs: https://highlevel.stoplight.io/docs/integrations
const BASE = 'https://services.leadconnectorhq.com'
const VERSION = '2021-07-28'

function authHeaders() {
  const token = process.env.GHL_TOKEN
  if (!token) throw new Error('Falta GHL_TOKEN en el .env')
  return {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: 'application/json',
  }
}

async function ghlGet(path, params = {}) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GHL ${res.status} ${path}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// Custom fields de la location. model='opportunity' trae los campos comerciales
// (los del Excel); 'contact' trae los de contacto.
export async function getCustomFields(locationId, model = 'opportunity') {
  const data = await ghlGet(`/locations/${locationId}/customFields`, { model })
  return data.customFields || data.customField || []
}

// Usuarios de la location: para resolver assignedTo -> nombre del comercial.
export async function getUsers(locationId) {
  const data = await ghlGet('/users/', { locationId })
  return data.users || []
}

// Pipelines y sus stages (para resolver fase y filtrar por pipeline).
export async function getPipelines(locationId) {
  const data = await ghlGet('/opportunities/pipelines', { locationId })
  return data.pipelines || []
}

// Trae TODAS las oportunidades de una location (paginando), opcionalmente de un pipeline.
export async function searchOpportunities(locationId, pipelineId = null) {
  const all = []
  let page = 1
  // La API v2 pagina con startAfter/startAfterId o page; usamos limit alto + page.
  for (;;) {
    const data = await ghlGet('/opportunities/search', {
      location_id: locationId,
      pipeline_id: pipelineId,
      limit: 100,
      page,
    })
    const batch = data.opportunities || []
    all.push(...batch)
    const total = data.meta?.total ?? null
    if (batch.length < 100) break
    if (total != null && all.length >= total) break
    page += 1
    if (page > 100) break // tope de seguridad
  }
  return all
}
