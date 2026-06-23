// Mapea una oportunidad de GoHighLevel a una fila "cruda" del Pipeline Total
// (las 24 columnas de entrada que luego el motor de cálculo enriquece).
//
// Los campos comerciales viven como CUSTOM FIELDS de OPORTUNIDAD en GHL.
// Mapeamos por fieldKey (estable) -> columna del dashboard.

// columnaDelDashboard : fieldKey del custom field de oportunidad en GHL
export const FIELD_MAP = {
  pais: 'opportunity.pais',
  sumhw: 'opportunity.total_linea_sumhw',
  hwaas: 'opportunity.total_linea_hwaas',
  svcs: 'opportunity.total_linea_svcs',
  swter: 'opportunity.swter',
  swss: 'opportunity.total_linea_solsw',
  proyecto: 'opportunity.descripcion',
  productos: 'opportunity.lista_productos',
  lineaNegocio: 'opportunity.linea_de_negocio',
  aliado: 'opportunity.nombre_de_aliado',
  kare: 'opportunity.tipo_de_venta_kare',
  probabilidadCierre: 'opportunity.probabilidad_cierre',
  fechaInicioFact: 'opportunity.fecha_inicio_de_facturacin',
  fechaCierre: 'opportunity.fecha_de_cierre_de_la_op',
  recurrente: 'opportunity.recurrente_smartsuite',
  tiempoContrato: 'opportunity.tiempo_de_contrato',
  fuenteLead: 'opportunity.fuente_de_lead',
  margenMix: 'opportunity.margen_mix',
  areaNegocio: 'opportunity.area_de_negocio',
  codigoOp: 'opportunity.codigo_de_oportunidad',
}

const numericKeys = new Set(['sumhw', 'hwaas', 'svcs', 'swter', 'swss', 'recurrente', 'margenMix'])
const dateKeys = new Set(['fechaInicioFact', 'fechaCierre'])

const toNum = (v) =>
  v == null || v === '' ? 0 : typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, '')) || 0
const toISO = (v) => {
  if (v == null || v === '') return null
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v))
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

// status de GHL -> Estado del Excel
const ESTADO = { open: 'Abierto', won: 'Ganada', lost: 'Perdida', abandoned: 'Abandonada' }

// Extrae el valor tipado de un custom field de oportunidad.
const cfValue = (cf) =>
  cf.fieldValueString ??
  cf.fieldValueNumber ??
  cf.fieldValueDate ??
  (Array.isArray(cf.fieldValueArray) ? cf.fieldValueArray.join(', ') : undefined)

// Construye índice {fieldKey -> valor} para una oportunidad.
function indexByKey(opp, keyById) {
  const out = {}
  for (const cf of opp.customFields || []) {
    const key = keyById[cf.id]
    if (!key) continue
    const v = cfValue(cf)
    if (v !== undefined) out[key] = v
  }
  return out
}

// ctx: { keyById, stageById, userById }
export function mapOpportunity(opp, ctx) {
  const byKey = indexByKey(opp, ctx.keyById)
  const pick = (col) => byKey[FIELD_MAP[col]]

  const row = {
    pais: pick('pais') || '',
    comercial: ctx.userById?.[opp.assignedTo] || '',
    oportunidad: pick('codigoOp') || opp.name?.match(/OP\d+/i)?.[0] || opp.name || opp.id,
    estado: ESTADO[opp.status] || opp.status || '',
    fase: ctx.stageById?.[opp.pipelineStageId] || '',
    empresa: opp.contact?.companyName || opp.contact?.name || opp.name || '',
    bookingTotal: toNum(opp.monetaryValue),
    fechaCreacion: toISO(opp.createdAt),
    fuente: opp.source || '',
  }
  // Resto de columnas desde custom fields
  for (const col of ['sumhw', 'hwaas', 'svcs', 'swter', 'swss', 'proyecto', 'productos',
    'lineaNegocio', 'aliado', 'kare', 'probabilidadCierre', 'fechaInicioFact', 'fechaCierre',
    'recurrente', 'tiempoContrato', 'fuenteLead', 'margenMix', 'areaNegocio']) {
    let v = pick(col)
    if (numericKeys.has(col)) v = toNum(v)
    else if (dateKeys.has(col)) v = toISO(v)
    else v = v ?? ''
    row[col] = v
  }
  return row
}

export function mapAll(opportunities, ctx) {
  return opportunities.map((o) => mapOpportunity(o, ctx))
}
