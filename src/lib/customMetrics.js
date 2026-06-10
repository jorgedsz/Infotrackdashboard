// Métricas personalizadas: el usuario define condiciones + qué medir + meta opcional.
// Se evalúan sobre las filas enriquecidas y se guardan en localStorage.
import { FILTER_COLUMNS } from './columns'

// Qué se puede medir (agregación sobre las filas que cumplen las condiciones)
export const METRIC_OPTIONS = [
  { key: 'bookingTotal', label: 'Booking Total', money: true },
  { key: 'sensibilizado', label: 'Pipeline Sensibilizado', money: true },
  { key: 'totalMCB', label: 'Total MCB', money: true },
  { key: 'totalFacturacion', label: 'Total Facturación', money: true },
  { key: 'totalMB', label: 'Total MB', money: true },
  { key: 'sumhw', label: '$ SUMHW', money: true },
  { key: 'hwaas', label: '$ HWAAS', money: true },
  { key: 'svcs', label: '$ SVCS', money: true },
  { key: 'swter', label: '$ SWTER', money: true },
  { key: 'swss', label: '$ SOLSS', money: true },
  { key: '__count__', label: '# Oportunidades', money: false },
]

// Campos disponibles para condicionar (las columnas categóricas)
export const CONDITION_FIELDS = FILTER_COLUMNS.map((c) => ({ key: c.key, label: c.label }))

// Rangos de fecha disponibles para condicionar
export const DATE_FIELDS = [
  { key: 'fechaCreacion', label: 'Creación' },
  { key: 'fechaCierre', label: 'Cierre' },
]

// Evalúa una métrica: filtra por condiciones (AND entre condiciones, OR dentro de cada una)
// + rangos de fecha, y agrega la métrica elegida.
export function evalMetric(rows, def) {
  const conds = def.conditions || []
  const dates = def.dates || {}
  const matched = rows.filter((r) => {
    for (const c of conds) {
      if (c.values?.length && !c.values.includes(r[c.field] ?? '')) return false
    }
    for (const { key } of DATE_FIELDS) {
      const range = dates[key]
      if (!range) continue
      const v = r[key]
      if (range.from && (!v || v < range.from)) return false
      if (range.to && (!v || v > range.to)) return false
    }
    return true
  })
  const value =
    def.metric === '__count__'
      ? matched.length
      : matched.reduce((a, r) => a + (r[def.metric] || 0), 0)
  return { value, count: matched.length }
}

export const metricMeta = (key) => METRIC_OPTIONS.find((m) => m.key === key) || METRIC_OPTIONS[0]

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

export function newMetricDef() {
  return {
    id: (crypto?.randomUUID?.() || String(Date.now())),
    name: '',
    metric: 'bookingTotal',
    goal: '',
    conditions: [{ field: 'comercial', values: [] }],
    dates: { fechaCreacion: { from: '', to: '' }, fechaCierre: { from: '', to: '' } },
  }
}
