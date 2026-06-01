// Motor de cálculo del Pipeline Total.
// Replica las fórmulas del Excel "Dashboard Comercial" en JavaScript puro,
// para poder recalcular en tiempo real con datos que lleguen desde GoHighLevel.

import lookups from '../data/lookups.json'

// Mes objetivo del modelo de facturación (el Excel reparte sobre el año 2026)
export const BILLING_YEAR = 2026
export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// % de Margen de Contribución Bruto (MCB) por línea de producto
const MCB_PCT = { sumhw: 0.22, hwaas: 0.28, svcs: 0.35, swter: 0.27, swss: 0.27 }
// % de Margen Bruto (MB) mensual, según la línea de producto con MCB > 0
const MB_PCT = { sumhw: 0.24, hwaas: 0.34, svcs: 0.35, swter: 0.30, swss: 0.27 }

const toDate = (v) => (v ? new Date(v + 'T00:00:00') : null)
const monthsFromContrato = (txt) => {
  // "36 Meses" -> 36 ; "Venta transaccional" -> null
  const m = String(txt || '').match(/(\d+)\s*mes/i)
  return m ? Number(m[1]) : null
}
const esTransaccional = (txt) => /venta\s+transaccional/i.test(String(txt || ''))
const tieneSmartSuite = (aliado) => /smartsuite/i.test(String(aliado || ''))

// Empresa Interna (BG): según comercial y si el aliado contiene "SmartSuite".
export function empresaInternaDe(row) {
  if (!tieneSmartSuite(row.aliado)) return 'Infotrack'
  return row.comercial === 'Valeria Martinez' ? 'SmartSuite Propio' : 'SmartSuite SAS'
}

// --- Lookups (VLOOKUP del Excel) ---
export const probabilidadNum = (texto) => {
  if (texto == null || texto === '') return 0
  const v = lookups.probabilidad[String(texto).trim()]
  return typeof v === 'number' ? v : 0
}
export const arquitectoDe = (aliado) =>
  lookups.aliadoArquitecto[String(aliado || '').trim()] ?? ''
export const clasificacionDe = (kare) =>
  lookups.kareClasificacion[String(kare || '').trim()] ?? ''

// --- MCB por producto y total ---
export function calcMCB(row) {
  const mcb = {
    sumhw: (row.sumhw || 0) * MCB_PCT.sumhw,
    hwaas: (row.hwaas || 0) * MCB_PCT.hwaas,
    svcs: (row.svcs || 0) * MCB_PCT.svcs,
    swter: (row.swter || 0) * MCB_PCT.swter,
    swss: (row.swss || 0) * MCB_PCT.swss,
  }
  mcb.total = mcb.sumhw + mcb.hwaas + mcb.svcs + mcb.swter + mcb.swss
  return mcb
}

// Línea de producto dominante (la primera con MCB > 0), define el % de MB
function lineaDominante(mcb) {
  for (const k of ['sumhw', 'hwaas', 'svcs', 'swter', 'swss']) {
    if (mcb[k] !== 0) return k
  }
  return null
}

// --- Facturación mes a mes (AE..AP) ---
// Venta transaccional: el monto recurrente cae completo en el mes de inicio.
// Recurrente "X Meses": el monto se factura cada mes desde el inicio hasta inicio+X-1.
export function calcFacturacionMensual(row) {
  const fact = new Array(12).fill(0)
  const inicio = toDate(row.fechaInicioFact)
  const monto = row.recurrente || 0
  if (!inicio || !monto) return fact

  if (esTransaccional(row.tiempoContrato)) {
    if (inicio.getFullYear() === BILLING_YEAR) fact[inicio.getMonth()] = monto
    return fact
  }
  const meses = monthsFromContrato(row.tiempoContrato)
  if (!meses) return fact
  // Rango [inicio, inicio+meses-1]; marcamos los meses de BILLING_YEAR que caen dentro
  const start = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  const end = new Date(inicio.getFullYear(), inicio.getMonth() + meses - 1, 1)
  for (let m = 0; m < 12; m++) {
    const cur = new Date(BILLING_YEAR, m, 1)
    if (cur >= start && cur <= end) fact[m] = monto
  }
  return fact
}

// --- MB mes a mes (AR..BC) = facturación del mes * % según línea dominante ---
export function calcMBMensual(facturacion, mcb) {
  const linea = lineaDominante(mcb)
  const pct = linea ? MB_PCT[linea] : 0
  return facturacion.map((v) => v * pct)
}

// --- Fila enriquecida con todas las columnas calculadas ---
export function enrich(row) {
  const mcb = calcMCB(row)
  const facturacion = calcFacturacionMensual(row)
  const mb = calcMBMensual(facturacion, mcb)
  const probabilidad = probabilidadNum(row.probabilidadCierre)
  const totalFacturacion = facturacion.reduce((a, b) => a + b, 0)
  const totalMB = mb.reduce((a, b) => a + b, 0)
  // Aplanamos los 12 meses como campos (facEne..facDic, mbEne..mbDic) para la tabla
  const flat = {}
  MESES.forEach((m, i) => {
    flat['fac' + m] = facturacion[i]
    flat['mb' + m] = mb[i]
  })
  return {
    ...row,
    mcb,
    totalMCB: mcb.total,
    facturacion,
    totalFacturacion,
    mb,
    totalMB,
    ...flat,
    probabilidad,
    tipoVenta: clasificacionDe(row.kare),
    venta: esTransaccional(row.tiempoContrato) ? 'Venta Transaccional' : 'Recurrente',
    empresaInterna: empresaInternaDe(row),
    arquitecto: arquitectoDe(row.aliado),
    // Pipeline Sensibilizado = Booking Total * Probabilidad
    sensibilizado: (row.bookingTotal || 0) * probabilidad,
  }
}

export function enrichAll(rows) {
  return rows.map(enrich)
}
