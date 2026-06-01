import { fmtMoney, fmtNum, fmtDate } from '../lib/format'

// Totales calculados sobre las filas ya filtradas
export default function KpiBar({ rows }) {
  const sum = (key) => rows.reduce((a, r) => a + (r[key] || 0), 0)

  // Rango de fechas (min/max) sobre las filas, ignorando vacíos
  const range = (key) => {
    const ds = rows.map((r) => r[key]).filter(Boolean).sort()
    return ds.length ? `${fmtDate(ds[0])} – ${fmtDate(ds[ds.length - 1])}` : '—'
  }

  const kpis = [
    { label: 'Oportunidades', value: fmtNum(rows.length), accent: '#6366f1' },
    { label: 'Booking Total', value: fmtMoney(sum('bookingTotal')), accent: '#0ea5e9', money: true },
    { label: 'Pipeline Sensibilizado', value: fmtMoney(sum('sensibilizado')), accent: '#22c55e', money: true },
    { label: 'Total MCB', value: fmtMoney(sum('totalMCB')), accent: '#f59e0b', money: true },
    { label: 'Total Facturación', value: fmtMoney(sum('totalFacturacion')), accent: '#ec4899', money: true },
    { label: 'Total MB', value: fmtMoney(sum('totalMB')), accent: '#8b5cf6', money: true },
    { label: 'Creación (rango)', value: range('fechaCreacion'), accent: '#14b8a6', date: true },
    { label: 'Cierre (rango)', value: range('fechaCierre'), accent: '#ef4444', date: true },
  ]
  return (
    <section className="kpis">
      {kpis.map((k) => (
        <div className="kpi" key={k.label} style={{ '--accent': k.accent }}>
          <span className="kpi__label">{k.label}</span>
          <span className={'kpi__value' + (k.money ? ' kpi__value--money' : '') + (k.date ? ' kpi__value--date' : '')}>
            {k.value}
          </span>
        </div>
      ))}
    </section>
  )
}
