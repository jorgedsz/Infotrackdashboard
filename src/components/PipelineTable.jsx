import { useEffect, useMemo, useState } from 'react'
import { COLUMNS, renderCell } from '../lib/columns'

const PAGE_SIZES = [25, 50, 100, 'Todas']

export default function PipelineTable({ rows }) {
  const [sort, setSort] = useState({ key: 'bookingTotal', dir: 'desc' })
  const [showMonthly, setShowMonthly] = useState(true)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  const cols = useMemo(
    () => COLUMNS.filter((c) => showMonthly || !c.monthly),
    [showMonthly]
  )

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      let cmp
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'es')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort])

  const total = sorted.length
  const allPages = pageSize === 'Todas'
  const size = allPages ? total || 1 : pageSize
  const pageCount = Math.max(1, Math.ceil(total / size))

  // Si cambian filtros/orden/tamaño y la página actual queda fuera de rango, vuelve a 1
  useEffect(() => { setPage(1) }, [rows, pageSize, sort])

  const start = (page - 1) * size
  const visible = allPages ? sorted : sorted.slice(start, start + size)

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const isNum = (col) => col.type === 'money' || col.type === 'num' || col.type === 'pct'

  return (
    <div>
      <div className="tablebar">
        <label className="tabletoggle">
          <input type="checkbox" checked={showMonthly} onChange={(e) => setShowMonthly(e.target.checked)} />
          Ver desglose mensual (Facturación y MB · Ene–Dic)
        </label>
        <div className="pagesize">
          <span className="pagesize__label">Por página:</span>
          {PAGE_SIZES.map((s) => (
            <button
              key={s}
              className={'pagesize__btn' + (pageSize === s ? ' pagesize__btn--active' : '')}
              onClick={() => setPageSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

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
            {visible.map((row, i) => (
              <tr key={start + i}>
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
            {total === 0 && (
              <tr><td colSpan={cols.length} className="ptable__empty">Sin resultados con los filtros actuales</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pager">
          <span className="pager__info">
            Mostrando {allPages ? 1 : start + 1}–{allPages ? total : Math.min(start + size, total)} de {total}
          </span>
          {!allPages && (
            <div className="pager__nav">
              <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Anterior</button>
              <span className="pager__page">Página {page} de {pageCount}</span>
              <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Siguiente ›</button>
              <button disabled={page >= pageCount} onClick={() => setPage(pageCount)}>»</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
