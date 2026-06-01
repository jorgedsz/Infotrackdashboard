import { useMemo, useState } from 'react'
import { COLUMNS, renderCell } from '../lib/columns'

export default function PipelineTable({ rows }) {
  const [sort, setSort] = useState({ key: 'bookingTotal', dir: 'desc' })
  const [showMonthly, setShowMonthly] = useState(true)

  const cols = useMemo(
    () => COLUMNS.filter((c) => showMonthly || !c.monthly),
    [showMonthly]
  )

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    let cmp
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'es')
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const isNum = (col) => col.type === 'money' || col.type === 'num' || col.type === 'pct'

  return (
    <div>
      <label className="tabletoggle">
        <input type="checkbox" checked={showMonthly} onChange={(e) => setShowMonthly(e.target.checked)} />
        Ver desglose mensual (Facturación y MB · Ene–Dic)
      </label>
      <div className="tablewrap">
        <table className="ptable">
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  className={(isNum(col) ? 'num ' : '') + (col.calc ? 'calc ' : '') + (col.monthly ? 'month' : '')}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sort.key === col.key && <span className="ptable__arrow">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className={(isNum(col) ? 'num ' : '') + (col.monthly ? 'month' : '')}
                    title={col.type === 'text' ? row[col.key] : undefined}
                  >
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={cols.length} className="ptable__empty">Sin resultados con los filtros actuales</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
