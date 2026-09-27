// Métricas personalizadas: el usuario define condiciones + qué medir + meta opcional.
// Se evalúan sobre las filas de un DATASET (pipeline comercial, pipeline IA o citas).
import { FILTER_COLUMNS } from './columns'
import { FILTER_COLUMNS_IA } from './columnsIA'
import { FILTER_COLUMNS_CITAS, DATE_FIELDS_CITAS } from './columnsCitas'

const campos = (cols) => cols.map((c) => ({ key: c.key, label: c.label }))
const CONTEO = { key: '__count__', label: '# Oportunidades', money: false }

// Qué se puede medir en el pipeline comercial (agregación sobre las filas que cumplen)
export const METRIC_OPTIONS = [
  { key: 'bookingTotal', label: 'Booking Total', money: true },
  { key: 'sensibilizado', label: 'Pipeline Sensibilizado', money: true },
  { key: 'totalMCB', label: 'Total MCB', money: true },
  { key: 'totalFacturacion', label: 'Total Facturación', money: true },
  { key: 'totalMB', label: 'Total MB', money: true },
  { key: 'totalContribucion', label: 'Total Contribución', money: true },
  { key: 'contribucionQ1', label: 'Contribución Q1', money: true },
  { key: 'contribucionQ2', label: 'Contribución Q2', money: true },
  { key: 'contribucionQ3', label: 'Contribución Q3', money: true },
  { key: 'contribucionQ4', label: 'Contribución Q4', money: true },
  { key: 'sumhw', label: '$ SUMHW', money: true },
  { key: 'hwaas', label: '$ HWAAS', money: true },
  { key: 'svcs', label: '$ SVCS', money: true },
  { key: 'swter', label: '$ SWTER', money: true },
  { key: 'swss', label: '$ SOLSS', money: true },
  CONTEO,
]

// Rangos de fecha del pipeline comercial
export const DATE_FIELDS = [
  { key: 'fechaCreacion', label: 'Creación' },
  { key: 'fechaCierre', label: 'Cierre' },
]

// --- Datasets sobre los que se puede armar una métrica ---
export const DATASETS = [
  {
    key: 'comercial',
    label: 'Pipeline Comercial',
    metrics: METRIC_OPTIONS,
    fields: campos(FILTER_COLUMNS),
    dates: DATE_FIELDS,
    defaultMetric: 'bookingTotal',
    defaultField: 'comercial',
  },
  {
    key: 'ia',
    label: 'Pipelines IA',
    metrics: [CONTEO],
    fields: campos(FILTER_COLUMNS_IA),
    dates: [
      { key: 'fechaCreacion', label: 'Creación' },
      { key: 'fechaUltimaEtapa', label: 'Últ. cambio de etapa' },
    ],
    defaultMetric: '__count__',
    defaultField: 'etapa',
  },
  {
    key: 'citas',
    label: 'Citas',
    metrics: [
      { key: '__count__', label: '# Citas', money: false },
      { key: 'duracionMin', label: 'Minutos agendados', money: false },
    ],
    fields: campos(FILTER_COLUMNS_CITAS),
    dates: DATE_FIELDS_CITAS,
    defaultMetric: '__count__',
    defaultField: 'estadoCita',
  },
]

// Las métricas guardadas antes de existir los datasets no traen `dataset`: son del comercial.
export const datasetMeta = (key) => DATASETS.find((d) => d.key === key) || DATASETS[0]

// Campos disponibles para condicionar (las columnas categóricas del dataset)
export const CONDITION_FIELDS = DATASETS[0].fields

// GAP del Excel: ejecutado - meta (negativo = falta para llegar).
const gapDe = (valor, meta) => (meta > 0 ? valor - meta : null)
const pctDe = (valor, meta) => (meta > 0 ? Math.round((valor / meta) * 100) : null)

// Evalúa una métrica: filtra por condiciones (AND entre condiciones, OR dentro de cada una)
// + rangos de fecha, y agrega la métrica elegida.
// Con `groupBy` devuelve además una fila por valor de ese campo, cada una con su
// meta de `goals` (así una sola métrica arma el cuadro de metas por comercial,
// por línea de negocio o por trimestre, en vez de una tarjeta por combinación).
export function evalMetric(rows, def) {
  const conds = def.conditions || []
  const dates = def.dates || {}
  const matched = rows.filter((r) => {
    for (const c of conds) {
      if (c.values?.length && !c.values.includes(r[c.field] ?? '')) return false
    }
    // Recorremos los rangos que trae la definición, así sirve para cualquier dataset
    for (const [key, range] of Object.entries(dates)) {
      if (!range) continue
      const v = r[key]
      if (range.from && (!v || v < range.from)) return false
      if (range.to && (!v || v > range.to)) return false
    }
    return true
  })
  const aporte = (r) => (def.metric === '__count__' ? 1 : r[def.metric] || 0)
  const value = matched.reduce((a, r) => a + aporte(r), 0)
  const total = { value, count: matched.length }
  if (!def.groupBy) return total

  const mapa = new Map()
  for (const r of matched) {
    const v = r[def.groupBy]
    const k = v === '' || v == null ? '(sin dato)' : String(v)
    const cur = mapa.get(k) || { name: k, value: 0, count: 0 }
    cur.value += aporte(r)
    cur.count += 1
    mapa.set(k, cur)
  }
  // Los valores con meta se muestran aunque no tengan filas: un comercial en cero
  // frente a su meta es justo lo que hay que ver.
  const goals = def.goals || {}
  for (const nombre of Object.keys(goals)) {
    if (Number(goals[nombre]) > 0 && !mapa.has(nombre)) mapa.set(nombre, { name: nombre, value: 0, count: 0 })
  }
  const grupos = [...mapa.values()]
    .map((g) => {
      const meta = Number(goals[g.name]) || 0
      return { ...g, meta, pct: pctDe(g.value, meta), gap: gapDe(g.value, meta) }
    })
    .sort((a, b) => b.value - a.value)
  const metaTotal = grupos.reduce((a, g) => a + g.meta, 0)
  return { ...total, grupos, metaTotal }
}

export const metricMeta = (key, dataset) => {
  const ds = datasetMeta(dataset)
  return ds.metrics.find((m) => m.key === key) || ds.metrics[0]
}

// --- Persistencia (localStorage) ---
const KEY = 'infotrack.customMetrics.v1'

export function loadMetrics() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}
export function saveMetrics(metrics) {
  try {
    localStorage.setItem(KEY, JSON.stringify(metrics))
  } catch { /* sin persistencia */ }
}

export function newMetricDef(datasetKey = 'comercial') {
  const ds = datasetMeta(datasetKey)
  return {
    id: (crypto?.randomUUID?.() || String(Date.now())),
    dataset: ds.key,
    name: '',
    metric: ds.defaultMetric,
    goal: '',
    groupBy: '', // '' = un solo número; si no, se desglosa por ese campo
    goals: {}, // meta por valor del desglose: { 'Isabel Zapata': 760524764 }
    conditions: [{ field: ds.defaultField, values: [] }],
    dates: Object.fromEntries(ds.dates.map((d) => [d.key, { from: '', to: '' }])),
  }
}
