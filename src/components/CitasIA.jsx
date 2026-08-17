import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { COLUMNS_CITAS, FILTER_COLUMNS_CITAS } from '../lib/columnsCitas'
import { renderCell } from '../lib/columns'
import { sumBy } from '../lib/aggregate'
import { fmtNum } from '../lib/format'
import { loadCitas } from '../services/citasApi'
import { exportCSV, exportXLSX, exportPDF } from '../lib/export'
import MultiSelect from './MultiSelect'

const COLORS = ['#0068ff', '#002149', '#00c6ff', '#4b5160', '#6b7480', '#3385ff', '#0a4f9e', '#5ad8ff', '#94a3b0']
const PAGE_SIZES = [25, 50, 100, 'Todas']
const emptyFilters = () => Object.fromEntries(FILTER_COLUMNS_CITAS.map((c) => [c.key, new Set()]))
const hoy = () => new Date().toISOString().slice(0, 10)

// Agrupa las citas por mes (YYYY-MM) de su fecha
function porMes(rows) {
  const m = {}
  for (const r of rows) { if (!r.fechaCita) continue; const ym = r.fechaCita.slice(0, 7); m[ym] = (m[ym] || 0) + 1 }
  return Object.entries(m).sort().map(([name, value]) => ({ name, value }))
}

function Card({ title, wide, children }) {
  return (
    <div className={'chart' + (wide ? ' chart--wide' : '')}>
      <h3 className="chart__title">{title}</h3>
      <div className="chart__body">
        <ResponsiveContainer width="100%" height={wide ? 280 : 260}>{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

export default function CitasIA() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(emptyFilters)
  const [search, setSearch] = useState('')
  const [rango, setRango] = useState({ from: '', to: '' })
  const [sub, setSub] = useState('tabla')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    const load = () => loadCitas().then(({ rows, error }) => {
      setRows(rows); setError(error); setLoading(false)
    })
    load()
    const id = setInterval(load, 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      for (const [k, set] of Object.entries(filters)) if (set.size && !set.has(r[k] ?? '')) return false
      if (rango.from && (!r.fechaCita || r.fechaCita < rango.from)) return false
      if (rango.to && (!r.fechaCita || r.fechaCita > rango.to)) return false
      if (q) {
        const hay = `${r.contacto} ${r.empresa} ${r.telefono} ${r.titulo || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters, search, rango])

  useEffect(() => { setPage(1) }, [filters, search, rango, pageSize])

  const cnt = (fn) => filtered.filter(fn).length
  const kpis = [
    { label: 'Citas', value: fmtNum(filtered.length), accent: '#79b4ff' },
    { label: 'Confirmadas', value: fmtNum(cnt((r) => r.estadoCita === 'Confirmada')), accent: '#0068ff' },
    { label: 'Asistió', value: fmtNum(cnt((r) => r.estadoCita === 'Asistió')), accent: '#00c6ff' },
    { label: 'No asistió', value: fmtNum(cnt((r) => r.estadoCita === 'No asistió')), accent: '#6b8299' },
    { label: 'Próximas', value: fmtNum(cnt((r) => r.fechaCita && r.fechaCita >= hoy())), accent: '#3385ff' },
  ]

  const porEstado = useMemo(() => sumBy(filtered, 'estadoCita', '__count__'), [filtered])
  const porCalendario = useMemo(() => sumBy(filtered, 'calendario', '__count__', { top: 12 }), [filtered])
  const porAsignado = useMemo(() => sumBy(filtered, 'asignadoCita', '__count__', { top: 12 }), [filtered])
  const mensual = useMemo(() => porMes(filtered), [filtered])

  const allPages = pageSize === 'Todas'
  const size = allPages ? (filtered.length || 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(filtered.length / size))
  const start = (page - 1) * size
  const visible = allPages ? filtered : filtered.slice(start, start + size)

  return (
    <div>
      <section className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label} style={{ '--accent': k.accent }}>
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value">{k.value}</span>
          </div>
        ))}
      </section>

      {error && <div className="custommetrics__empty">No se pudieron cargar las citas: {error}</div>}

      <div className="filterbar">
        <div className="filterbar__searchrow">
          <input className="filterbar__search" placeholder="🔍  Buscar contacto, empresa, teléfono…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {(search || rango.from || rango.to || Object.values(filters).some((s) => s.size)) && (
            <button className="filterbar__reset"
              onClick={() => { setFilters(emptyFilters()); setSearch(''); setRango({ from: '', to: '' }) }}>
              Limpiar
            </button>
          )}
        </div>
        <div className="filterbar__filters">
          {FILTER_COLUMNS_CITAS.map((col) => {
            const options = [...new Set(rows.map((r) => r[col.key] ?? ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'))
            return (
              <MultiSelect key={col.key} label={col.label} options={options}
                value={filters[col.key] || new Set()} onChange={(set) => setFilters((f) => ({ ...f, [col.key]: set }))} />
            )
          })}
          <div className="daterange">
            <span className="daterange__label">F. Cita</span>
            <input type="date" value={rango.from} onChange={(e) => setRango((r) => ({ ...r, from: e.target.value }))} />
            <span className="daterange__sep">–</span>
            <input type="date" value={rango.to} onChange={(e) => setRango((r) => ({ ...r, to: e.target.value }))} />
          </div>
        </div>
      </div>

      <nav className="tabs">
        <button className={'tab' + (sub === 'tabla' ? ' tab--active' : '')} onClick={() => setSub('tabla')}>Tabla</button>
        <button className={'tab' + (sub === 'graficos' ? ' tab--active' : '')} onClick={() => setSub('graficos')}>Gráficos</button>
        <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'cargando…' : `${filtered.length} de ${rows.length} citas`}
        </span>
      </nav>

      {sub === 'tabla' ? (
        <div>
          <div className="tablebar">
            <div className="exportbar">
              <span className="exportbar__label">Exportar:</span>
              <button className="exportbar__btn" onClick={() => exportCSV(filtered, COLUMNS_CITAS, 'citas')}>CSV</button>
              <button className="exportbar__btn" onClick={() => exportXLSX(filtered, COLUMNS_CITAS, 'citas')}>XLSX</button>
              <button className="exportbar__btn" onClick={() => exportPDF(filtered, COLUMNS_CITAS, 'citas')}>PDF</button>
            </div>
            <div className="pagesize">
              <span className="pagesize__label">Por página:</span>
              {PAGE_SIZES.map((s) => (
                <button key={s} className={'pagesize__btn' + (pageSize === s ? ' pagesize__btn--active' : '')} onClick={() => setPageSize(s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="tablewrap">
            <table className="ptable">
              <thead><tr>{COLUMNS_CITAS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {visible.map((row, i) => (
                  <tr key={start + i}>
                    {COLUMNS_CITAS.map((c) => <td key={c.key} title={c.type === 'text' ? row[c.key] : undefined}>{renderCell(c, row)}</td>)}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={COLUMNS_CITAS.length} className="ptable__empty">
                    {loading ? 'Cargando…' : 'Sin citas con los filtros actuales'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && !allPages && (
            <div className="pager">
              <span className="pager__info">Mostrando {start + 1}–{Math.min(start + size, filtered.length)} de {filtered.length}</span>
              <div className="pager__nav">
                <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Anterior</button>
                <span className="pager__page">Página {page} de {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Siguiente ›</button>
                <button disabled={page >= pageCount} onClick={() => setPage(pageCount)}>»</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <section className="charts">
          <Card title="Citas por estado">
            <PieChart>
              <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={(e) => fmtNum(e.value)}>
                {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={fmtNum} />
              <Legend />
            </PieChart>
          </Card>

          <Card title="Citas por calendario">
            <BarChart data={porCalendario} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9fb3c8' }} width={180} />
              <Tooltip formatter={fmtNum} />
              <Bar dataKey="value" name="Citas" fill="#0068ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </Card>

          <Card title="Citas por asignado">
            <BarChart data={porAsignado} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} width={140} />
              <Tooltip formatter={fmtNum} />
              <Bar dataKey="value" name="Citas" fill="#00c6ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </Card>

          <Card title="Citas por mes" wide>
            <AreaChart data={mensual} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="gCitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00c6ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00c6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9fb3c8' }} width={40} allowDecimals={false} />
              <Tooltip formatter={fmtNum} />
              <Area type="monotone" dataKey="value" name="Citas" stroke="#00c6ff" fill="url(#gCitas)" strokeWidth={2} />
            </AreaChart>
          </Card>
        </section>
      )}
    </div>
  )
}
