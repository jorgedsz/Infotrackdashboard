// Motor de cálculo del Pipeline Total.
// Replica las fórmulas del Excel "Dashboard Comercial" en JavaScript puro,
// para poder recalcular en tiempo real con datos que lleguen desde GoHighLevel.

import lookups from '../data/lookups.json'

// Año objetivo del modelo de facturación: el Excel repartía sobre 12 meses de un
// año fijo (2026). Acá el año es un parámetro; si no se pasa, se usa el año en curso.
export const DEFAULT_BILLING_YEAR = new Date().getFullYear()
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
export function calcFacturacionMensual(row, year = DEFAULT_BILLING_YEAR) {
  const fact = new Array(12).fill(0)
  const inicio = toDate(row.fechaInicioFact)
  const monto = row.recurrente || 0
  if (!inicio || !monto) return fact

  if (esTransaccional(row.tiempoContrato)) {
    if (inicio.getFullYear() === year) fact[inicio.getMonth()] = monto
    return fact
  }
  const meses = monthsFromContrato(row.tiempoContrato)
  if (!meses) return fact
  // Rango [inicio, inicio+meses-1]; marcamos los meses del año elegido que caen dentro
  const start = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  const end = new Date(inicio.getFullYear(), inicio.getMonth() + meses - 1, 1)
  for (let m = 0; m < 12; m++) {
    const cur = new Date(year, m, 1)
    if (cur >= start && cur <= end) fact[m] = monto
  }
  return fact
}

// Rango [desdeAño, hastaAño] que cubre la facturación de una fila (null si no factura).
function spanDeFacturacion(row) {
  const inicio = toDate(row.fechaInicioFact)
  if (!inicio || !(row.recurrente || 0)) return null
  const desde = inicio.getFullYear()
  if (esTransaccional(row.tiempoContrato)) return [desde, desde]
  const meses = monthsFromContrato(row.tiempoContrato)
  if (!meses) return null
  const fin = new Date(desde, inicio.getMonth() + meses - 1, 1)
  return [desde, fin.getFullYear()]
}

// Años que tiene sentido ofrecer en el selector: los que cubre la data (acotados a
// una ventana razonable, por si hay fechas erróneas en el CRM) más el año en curso.
export function aniosDeFacturacion(
  rows,
  { min = DEFAULT_BILLING_YEAR - 5, max = DEFAULT_BILLING_YEAR + 10 } = {}
) {
  const anios = new Set([DEFAULT_BILLING_YEAR])
  for (const row of rows) {
    const span = spanDeFacturacion(row)
    if (!span) continue
    for (let y = Math.max(span[0], min); y <= Math.min(span[1], max); y++) anios.add(y)
  }
  return [...anios].sort((a, b) => a - b)
}

// --- MB mes a mes (AR..BC) = facturación del mes * % según línea dominante ---
export function calcMBMensual(facturacion, mcb) {
  const linea = lineaDominante(mcb)
  const pct = linea ? MB_PCT[linea] : 0
  return facturacion.map((v) => v * pct)
}

// El Margen Mix del Excel es una fracción (0.14 = 14%). Desde GoHighLevel el
// campo puede venir en cualquiera de las dos formas, así que normalizamos: un
// valor mayor que 1 solo tiene sentido como porcentaje (14 => 0.14).
export const fraccionMargen = (v) => {
  const n = Number(v) || 0
  return n > 1 ? n / 100 : n
}

// --- Contribución por trimestre (AV..AY del Excel) ---
// Contribución Qn = facturación de los 3 meses del trimestre * Margen Mix.
// Ojo: NO es lo mismo que el MB de arriba, que usa un % fijo por línea de
// producto; la Contribución usa el Margen Mix propio de cada oportunidad y es
// la cifra con la que el Excel mide metas y cumplimiento.
export function calcContribucionTrimestral(facturacion, margenMix) {
  const f = fraccionMargen(margenMix)
  return [0, 1, 2, 3].map(
    (q) => (facturacion[q * 3] + facturacion[q * 3 + 1] + facturacion[q * 3 + 2]) * f
  )
}

// Trimestre y año de la fecha de cierre (AA y AB del Excel).
export const trimestreDe = (iso) => {
  const d = toDate(iso)
  return d ? `Q${Math.floor(d.getMonth() / 3) + 1}` : ''
}
export const anioDe = (iso) => {
  const d = toDate(iso)
  return d ? String(d.getFullYear()) : ''
}

// --- Fila enriquecida con todas las columnas calculadas ---
export function enrich(row, year = DEFAULT_BILLING_YEAR) {
  const mcb = calcMCB(row)
  const facturacion = calcFacturacionMensual(row, year)
  const mb = calcMBMensual(facturacion, mcb)
  const probabilidad = probabilidadNum(row.probabilidadCierre)
  const totalFacturacion = facturacion.reduce((a, b) => a + b, 0)
  const totalMB = mb.reduce((a, b) => a + b, 0)
  const contribucion = calcContribucionTrimestral(facturacion, row.margenMix)
  // Aplanamos los 12 meses como campos (facEne..facDic, mbEne..mbDic) para la tabla
  const flat = {}
  MESES.forEach((m, i) => {
    flat['fac' + m] = facturacion[i]
    flat['mb' + m] = mb[i]
  })
  return {
    ...row,
    billingYear: year,
    mcb,
    totalMCB: mcb.total,
    facturacion,
    totalFacturacion,
    mb,
    totalMB,
    ...flat,
    // Contribución por trimestre del año de facturación elegido + el total del año
    contribucion,
    contribucionQ1: contribucion[0],
    contribucionQ2: contribucion[1],
    contribucionQ3: contribucion[2],
    contribucionQ4: contribucion[3],
    totalContribucion: contribucion.reduce((a, b) => a + b, 0),
    // Trimestre y año de CIERRE (no de facturación): sirven para agrupar el pipeline
    trimestreCierre: trimestreDe(row.fechaCierre),
    anioCierre: anioDe(row.fechaCierre),
    probabilidad,
    tipoVenta: clasificacionDe(row.kare),
    venta: esTransaccional(row.tiempoContrato) ? 'Venta Transaccional' : 'Recurrente',
    empresaInterna: empresaInternaDe(row),
    arquitecto: arquitectoDe(row.aliado),
    // Pipeline Sensibilizado = Booking Total * Probabilidad
    sensibilizado: (row.bookingTotal || 0) * probabilidad,
  }
}

export function enrichAll(rows, year = DEFAULT_BILLING_YEAR) {
  // Ojo: arrow function a propósito — `rows.map(enrich)` pasaría el índice como año.
  return rows.map((row) => enrich(row, year))
}
