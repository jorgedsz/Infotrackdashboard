// Formato de moneda y números (pesos colombianos por defecto)
const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
const int = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export const fmtMoney = (v) => (v == null || isNaN(v) ? '—' : cop.format(v))
export const fmtNum = (v) => (v == null || isNaN(v) ? '—' : int.format(v))
export const fmtPct = (v) => (v == null || isNaN(v) ? '—' : `${Math.round(v * 100)}%`)

// Fecha ISO (YYYY-MM-DD) -> DD/MM/YYYY
export const fmtDate = (v) => {
  if (!v) return '—'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : v
}

// Versión compacta para KPIs grandes: $12.834 M / $1,2 B
export function fmtCompact(v) {
  if (v == null || isNaN(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return `$${(v / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} B`
  if (abs >= 1e6) return `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 0 })} M`
  return cop.format(v)
}
