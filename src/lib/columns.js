// Definición de columnas del Pipeline Total.
// type: 'text' | 'money' | 'date' | 'pct' | 'num'
// filter: 'category' (dropdown de valores únicos) | 'search' (texto) | null
import { fmtMoney, fmtNum, fmtPct, fmtDate } from './format'
import { MESES, DEFAULT_BILLING_YEAR } from './calc'

// Genera las 12 columnas mensuales para un prefijo dado (fac / mb), etiquetadas con el año
const mesesCols = (prefix, labelPrefix, year) =>
  MESES.map((m) => ({
    key: prefix + m,
    label: `${labelPrefix} ${m} ${year}`,
    type: 'money',
    filter: null,
    calc: true,
    monthly: true,
  }))

// Las columnas dependen del año de facturación elegido (solo en las mensuales).
export const buildColumns = (year = DEFAULT_BILLING_YEAR) => [
  { key: 'pais', label: 'País', type: 'text', filter: 'category' },
  { key: 'comercial', label: 'Comercial', type: 'text', filter: 'category' },
  { key: 'oportunidad', label: '# Oport.', type: 'text', filter: 'search' },
  { key: 'estado', label: 'Estado', type: 'text', filter: 'category' },
  { key: 'fase', label: 'Fase', type: 'text', filter: 'category' },
  { key: 'empresa', label: 'Empresa', type: 'text', filter: 'search' },
  { key: 'bookingTotal', label: 'Booking Total', type: 'money', filter: null },
  { key: 'sumhw', label: '$ SUMHW', type: 'money', filter: null },
  { key: 'hwaas', label: '$ HWAAS', type: 'money', filter: null },
  { key: 'svcs', label: '$ SVCS', type: 'money', filter: null },
  { key: 'swter', label: '$ SWTER', type: 'money', filter: null },
  { key: 'swss', label: '$ SOLSS', type: 'money', filter: null },
  { key: 'lineaNegocio', label: 'Línea Negocio', type: 'text', filter: 'category' },
  { key: 'aliado', label: 'Aliado', type: 'text', filter: 'category' },
  { key: 'kare', label: 'KARE', type: 'text', filter: 'category' },
  { key: 'probabilidadCierre', label: 'Prob. Cierre', type: 'text', filter: 'category' },
  { key: 'tiempoContrato', label: 'Contrato', type: 'text', filter: 'category' },
  { key: 'fuenteLead', label: 'Fuente de Lead', type: 'text', filter: 'category' },
  // `fuente` es el campo nativo `source` de GHL (texto libre); `seguimiento` es el
  // custom field de etapa de follow-up. Ambos filtrables => condicionan Mis Métricas.
  { key: 'fuente', label: 'Fuente', type: 'text', filter: 'category' },
  { key: 'seguimiento', label: 'Seguimiento', type: 'text', filter: 'category' },
  { key: 'margenMix', label: 'Margen Mix', type: 'pctraw', filter: null },
  { key: 'areaNegocio', label: 'Área de Negocio', type: 'text', filter: 'category' },
  // Clasificación manual que hace el comercial en GHL: Forecast / Upside / Indeterminado
  { key: 'forecast', label: 'Forecast', type: 'text', filter: 'category' },
  // --- columnas calculadas ---
  { key: 'tipoVenta', label: 'Tipo Venta', type: 'text', filter: 'category', calc: true },
  { key: 'venta', label: 'Venta', type: 'text', filter: 'category', calc: true },
  { key: 'empresaInterna', label: 'Empresa Interna', type: 'text', filter: 'category', calc: true },
  { key: 'arquitecto', label: 'Arquitecto', type: 'text', filter: 'category', calc: true },
  { key: 'probabilidad', label: 'Prob.', type: 'pct', filter: null, calc: true },
  { key: 'totalMCB', label: 'Total MCB', type: 'money', filter: null, calc: true },
  { key: 'totalFacturacion', label: 'Total Facturación', type: 'money', filter: null, calc: true },
  ...mesesCols('fac', 'Fact.', year),
  { key: 'totalMB', label: 'Total MB', type: 'money', filter: null, calc: true },
  ...mesesCols('mb', 'MB', year),
  { key: 'sensibilizado', label: 'Pipeline Sensibilizado', type: 'money', filter: null, calc: true },
  // Contribución = facturación del trimestre * Margen Mix de la oportunidad. Es la
  // cifra con la que el Excel mide metas; no confundir con el MB de arriba, que usa
  // un % fijo por línea de producto.
  { key: 'contribucionQ1', label: `Contrib. Q1 ${year}`, type: 'money', filter: null, calc: true },
  { key: 'contribucionQ2', label: `Contrib. Q2 ${year}`, type: 'money', filter: null, calc: true },
  { key: 'contribucionQ3', label: `Contrib. Q3 ${year}`, type: 'money', filter: null, calc: true },
  { key: 'contribucionQ4', label: `Contrib. Q4 ${year}`, type: 'money', filter: null, calc: true },
  { key: 'totalContribucion', label: `Total Contribución ${year}`, type: 'money', filter: null, calc: true },
  // --- fechas al final ---
  { key: 'fechaCreacion', label: 'F. Creación', type: 'date', filter: null },
  { key: 'fechaCierre', label: 'F. Cierre', type: 'date', filter: null },
  { key: 'trimestreCierre', label: 'Trimestre cierre', type: 'text', filter: 'category', calc: true },
  { key: 'anioCierre', label: 'Año cierre', type: 'text', filter: 'category', calc: true },
]

export const COLUMNS = buildColumns()
// Las columnas filtrables son todas categóricas (ninguna mensual), así que no dependen del año.
export const FILTER_COLUMNS = COLUMNS.filter((c) => c.filter === 'category')

export function renderCell(col, row) {
  const v = row[col.key]
  switch (col.type) {
    case 'money': return fmtMoney(v)
    case 'num': return fmtNum(v)
    case 'pct': return fmtPct(v)
    case 'pctraw': return v == null || v === '' ? '—' : `${fmtNum(v)}%` // valor ya en porcentaje (20 => 20%)
    case 'date': return fmtDate(v)
    default: return v === '' || v == null ? '—' : v
  }
}
