import { fmtMoney, fmtNum, fmtDate } from '../lib/format'

// Paleta de marca para los acentos de los KPIs
const C = { navy: '#002149', blue: '#0068ff', cyan: '#00c6ff', gray: '#6b7480', grayDark: '#4b5160' }

// Totales calculados sobre las filas ya filtradas
export default function KpiBar({ rows }) {
  const sum = (key) => rows.reduce((a, r) => a + (r[key] || 0), 0)

  // Rango de fechas (min/max) sobre las filas, ignorando vacíos
  const range = (key) => {
    const ds = rows.map((r) => r[key]).filter(Boolean).sort()
    return ds.length ? `${fmtDate(ds[0])} – ${fmtDate(ds[ds.length - 1])}` : '—'
  }

  const kpis = [
    { label: 'Oportunidades', value: fmtNum(rows.length), accent: C.navy },
    { label: 'Booking Total', value: fmtMoney(sum('bookingTotal')), accent: C.blue, money: true },
    { label: 'Pipeline Sensibilizado', value: fmtMoney(sum('sensibilizado')), accent: C.cyan, money: true },
    { label: 'Total MCB', value: fmtMoney(sum('totalMCB')), accent: C.blue, money: true },
    { label: 'Total Facturación', value: fmtMoney(sum('totalFacturacion')), accent: C.navy, money: true },
    { label: 'Total MB', value: fmtMoney(sum('totalMB')), accent: C.cyan, money: true },
  ]
  const dateKpis = [
    { label: 'Creación (rango)', value: range('fechaCreacion'), accent: C.gray },
    { label: 'Cierre (rango)', value: range('fechaCierre'), accent: C.grayDark },
  ]

  return (
    <>
      <section className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label} style={{ '--accent': k.accent }}>
            <span className="kpi__label">{k.label}</span>
            <span className={'kpi__value' + (k.money ? ' kpi__value--money' : '')}>{k.value}</span>
          </div>
        ))}
      </section>
      <section className="kpis kpis--dates">
        {dateKpis.map((k) => (
          <div className="kpi kpi--date" key={k.label} style={{ '--accent': k.accent }}>
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value kpi__value--date">{k.value}</span>
          </div>
        ))}
      </section>
    </>
  )
}
