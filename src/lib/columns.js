// Definición de columnas del Pipeline Total.
// type: 'text' | 'money' | 'date' | 'pct' | 'num'
// filter: 'category' (dropdown de valores únicos) | 'search' (texto) | null
import { fmtMoney, fmtNum, fmtPct, fmtDate } from './format'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
// Genera las 12 columnas mensuales para un prefijo dado (fac / mb)
const mesesCols = (prefix, labelPrefix) =>
  MESES.map((m) => ({
    key: prefix + m,
    label: `${labelPrefix} ${m}`,
    type: 'money',
    filter: null,
    calc: true,
    monthly: true,
  }))

export const COLUMNS = [
  { key: 'pais', label: 'País', type: 'text', filter: 'category' },
  { key: 'comercial', label: 'Comercial', type: 'text', filter: 'category' },
  { key: 'oportunidad', label: '# Oport.', type: 'text', filter: 'search' },
  { key: 'estado', label: 'Estado', type: 'text', filter: 'category' },
  { key: 'fase', label: 'Fase', type: 'text', filter: 'category' },
  { key: 'empresa', label: 'Empresa', type: 'text', filter: 'search' },
  { key: 'bookingTotal', label: 'Booking Total', type: 'money', filter: null },
  { key: 'lineaNegocio', label: 'Línea Negocio', type: 'text', filter: 'category' },
  { key: 'aliado', label: 'Aliado', type: 'text', filter: 'category' },
  { key: 'kare', label: 'KARE', type: 'text', filter: 'category' },
  { key: 'probabilidadCierre', label: 'Prob. Cierre', type: 'text', filter: 'category' },
  { key: 'tiempoContrato', label: 'Contrato', type: 'text', filter: 'category' },
  { key: 'fechaCreacion', label: 'F. Creación', type: 'date', filter: null },
  { key: 'fechaCierre', label: 'F. Cierre', type: 'date', filter: null },
  // --- columnas calculadas ---
  { key: 'tipoVenta', label: 'Tipo Venta', type: 'text', filter: 'category', calc: true },
  { key: 'venta', label: 'Venta', type: 'text', filter: 'category', calc: true },
  { key: 'empresaInterna', label: 'Empresa Interna', type: 'text', filter: 'category', calc: true },
  { key: 'arquitecto', label: 'Arquitecto', type: 'text', filter: 'category', calc: true },
  { key: 'probabilidad', label: 'Prob.', type: 'pct', filter: null, calc: true },
  { key: 'totalMCB', label: 'Total MCB', type: 'money', filter: null, calc: true },
  { key: 'totalFacturacion', label: 'Total Facturación', type: 'money', filter: null, calc: true },
  ...mesesCols('fac', 'Fact.'),
  { key: 'totalMB', label: 'Total MB', type: 'money', filter: null, calc: true },
  ...mesesCols('mb', 'MB'),
  { key: 'sensibilizado', label: 'Pipeline Sensibilizado', type: 'money', filter: null, calc: true },
]

export const FILTER_COLUMNS = COLUMNS.filter((c) => c.filter === 'category')

export function renderCell(col, row) {
  const v = row[col.key]
  switch (col.type) {
    case 'money': return fmtMoney(v)
    case 'num': return fmtNum(v)
    case 'pct': return fmtPct(v)
    case 'date': return fmtDate(v)
    default: return v === '' || v == null ? '—' : v
  }
}
