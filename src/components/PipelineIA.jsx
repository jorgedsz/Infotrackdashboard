import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { COLUMNS_IA, FILTER_COLUMNS_IA } from '../lib/columnsIA'
import { renderCell } from '../lib/columns'
import { sumBy } from '../lib/aggregate'
import { fmtNum } from '../lib/format'
import { loadPipelineIA } from '../services/pipelineIaApi'
import { exportCSV, exportXLSX, exportPDF } from '../lib/export'
import { useAuth } from '../context/AuthContext'
import MultiSelect from './MultiSelect'
import CitasIA from './CitasIA'
import IaPipelinesAdmin from './IaPipelinesAdmin'

const COLORS = ['#0068ff', '#002149', '#00c6ff', '#4b5160', '#6b7480', '#3385ff', '#0a4f9e', '#5ad8ff', '#94a3b0', '#80b4ff', '#013a7a', '#5e0', '#1e90ff', '#00b4d8']
const PAGE_SIZES = [25, 50, 100, 'Todas']
const emptyFilters = () => Object.fromEntries(FILTER_COLUMNS_IA.map((c) => [c.key, new Set()]))

// Agrupa por mes (YYYY-MM) de una fecha
function porMes(rows, key = 'fechaCreacion') {
  const m = {}
  for (const r of rows) { const d = r[key]; if (!d) continue; const ym = d.slice(0, 7); m[ym] = (m[ym] || 0) + 1 }
  return Object.entries(m).sort().map(([name, value]) => ({ name, value }))
}

// Embudo comparativo: una fila por etapa y una serie por agente. Todos los
// pipelines IA comparten etapas, así que la etapa es la dimensión común.
function porEtapaYAgente(rows, agentes) {
  const map = new Map()
  for (const r of rows) {
    const etapa = r.etapa || '(sin etapa)'
    const cur = map.get(etapa) || { name: etapa, __total: 0 }
    const a = r.agente || '(sin agente)'
    cur[a] = (cur[a] || 0) + 1
    cur.__total += 1
    map.set(etapa, cur)
  }
  // Las etapas sin dato de un agente quedan en 0 para que las barras se alineen
  const out = [...map.values()].sort((x, y) => y.__total - x.__total)
  for (const fila of out) for (const a of agentes) if (fila[a] == null) fila[a] = 0
  return out
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

export default function PipelineIA() {
  const { user, authEnabled } = useAuth()
  const esAdmin = authEnabled === false || user?.role === 'admin'

  const [rows, setRows] = useState([])
  const [agentes, setAgentes] = useState([]) // pipelines IA configurados
  const [meta, setMeta] = useState({ updatedAt: null, error: null })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(emptyFilters)
  const [search, setSearch] = useState('')
  const [sub, setSub] = useState('tabla')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [recargar, setRecargar] = useState(0) // se incrementa al guardar la config

  useEffect(() => {
    const load = () => loadPipelineIA().then(({ rows, agentes, updatedAt, error }) => {
      setRows(rows); setAgentes(agentes); setMeta({ updatedAt, error }); setLoading(false)
    })
    load()
    const id = setInterval(load, 30 * 1000)
    return () => clearInterval(id)
  }, [recargar])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      for (const [k, set] of Object.entries(filters)) if (set.size && !set.has(r[k] ?? '')) return false
      if (q) {
        const hay = `${r.contacto} ${r.empresa} ${r.email} ${r.telefono}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filters, search])

  useEffect(() => { setPage(1) }, [filters, search, pageSize])

  // KPIs
  const cnt = (fn) => filtered.filter(fn).length
  const kpis = [
    { label: 'Contactos', value: fmtNum(filtered.length), accent: '#79b4ff' },
    { label: 'Abiertos', value: fmtNum(cnt((r) => r.estado === 'Abierto')), accent: '#00c6ff' },
    { label: 'Perdidos', value: fmtNum(cnt((r) => r.estado === 'Perdida')), accent: '#6b8299' },
    { label: 'Citas agendadas', value: fmtNum(cnt((r) => /cita/i.test(r.etapa))), accent: '#0068ff' },
    { label: 'En seguimiento', value: fmtNum(cnt((r) => /seguimiento/i.test(r.etapa))), accent: '#3385ff' },
  ]

  // Datos de gráficos
  const porEtapa = useMemo(() => sumBy(filtered, 'etapa', '__count__'), [filtered])
  const porEstado = useMemo(() => sumBy(filtered, 'estado', '__count__'), [filtered])
  const porAsignado = useMemo(() => sumBy(filtered, 'asignado', '__count__', { top: 12 }), [filtered])
  const porAgente = useMemo(() => sumBy(filtered, 'agente', '__count__'), [filtered])
  const creadasMes = useMemo(() => porMes(filtered), [filtered])

  // Agentes presentes en lo que se está viendo (para las series comparativas)
  const agentesVisibles = useMemo(
    () => [...new Set(filtered.map((r) => r.agente || '(sin agente)'))].sort((a, b) => String(a).localeCompare(String(b), 'es')),
    [filtered]
  )
  const comparativa = useMemo(() => porEtapaYAgente(filtered, agentesVisibles), [filtered, agentesVisibles])
  const variosAgentes = agentesVisibles.length > 1

  // Tabla paginada
  const allPages = pageSize === 'Todas'
  const size = allPages ? (filtered.length || 1) : pageSize
  const pageCount = Math.max(1, Math.ceil(filtered.length / size))
  const start = (page - 1) * size
  const visible = allPages ? filtered : filtered.slice(start, start + size)

  // Las sub-pestañas de Citas y Pipelines tienen su propio contenido: los KPIs
  // y filtros de oportunidades no aplican ahí.
  const enCitas = sub === 'citas'
  const enConfig = sub === 'config'
  const conBarra = !enCitas && !enConfig

  // Sin pipelines configurados no hay nada que mostrar: se avisa y, si es admin,
  // se le manda directo a la pantalla donde los elige.
  const sinPipelines = !loading && agentes.length === 0

  return (
    <div>
      {sinPipelines && !enConfig && (
        <div className="iapipes__aviso">
          No hay pipelines IA seleccionados.{' '}
          {esAdmin
            ? <button className="iapipes__link" onClick={() => setSub('config')}>Elegir pipelines →</button>
            : 'Pídele a un administrador que los configure en Pipeline IA → Pipelines.'}
        </div>
      )}

      {conBarra && (
      <section className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label} style={{ '--accent': k.accent }}>
            <span className="kpi__label">{k.label}</span>
            <span className="kpi__value">{k.value}</span>
          </div>
        ))}
      </section>
      )}

      {conBarra && (
      <div className="filterbar">
        <div className="filterbar__searchrow">
          <input className="filterbar__search" placeholder="🔍  Buscar contacto, empresa, email, teléfono…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {(search || Object.values(filters).some((s) => s.size)) && (
            <button className="filterbar__reset" onClick={() => { setFilters(emptyFilters()); setSearch('') }}>Limpiar</button>
          )}
        </div>
        <div className="filterbar__filters">
          {FILTER_COLUMNS_IA.map((col) => {
            const options = [...new Set(rows.map((r) => r[col.key] ?? ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'))
            return (
              <MultiSelect key={col.key} label={col.label} options={options}
                value={filters[col.key] || new Set()} onChange={(set) => setFilters((f) => ({ ...f, [col.key]: set }))} />
            )
          })}
        </div>
      </div>
      )}

      <nav className="tabs">
        <button className={'tab' + (sub === 'tabla' ? ' tab--active' : '')} onClick={() => setSub('tabla')}>Tabla</button>
        <button className={'tab' + (sub === 'graficos' ? ' tab--active' : '')} onClick={() => setSub('graficos')}>Gráficos</button>
        <button className={'tab' + (enCitas ? ' tab--active' : '')} onClick={() => setSub('citas')}>Citas</button>
        {esAdmin && (
          <button className={'tab' + (enConfig ? ' tab--active' : '')} onClick={() => setSub('config')}>
            Pipelines{agentes.length ? ` (${agentes.length})` : ''}
          </button>
        )}
        {conBarra && (
          <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            {loading ? 'cargando…' : `${filtered.length} de ${rows.length}`}
          </span>
        )}
      </nav>

      {enConfig ? (
        <IaPipelinesAdmin onSaved={() => setRecargar((n) => n + 1)} />
      ) : enCitas ? <CitasIA /> : sub === 'tabla' ? (
        <div>
          <div className="tablebar">
            <div className="exportbar">
              <span className="exportbar__label">Exportar:</span>
              <button className="exportbar__btn" onClick={() => exportCSV(filtered, COLUMNS_IA, 'pipeline-ia')}>CSV</button>
              <button className="exportbar__btn" onClick={() => exportXLSX(filtered, COLUMNS_IA, 'pipeline-ia')}>XLSX</button>
              <button className="exportbar__btn" onClick={() => exportPDF(filtered, COLUMNS_IA, 'pipeline-ia')}>PDF</button>
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
              <thead><tr>{COLUMNS_IA.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {visible.map((row, i) => (
                  <tr key={start + i}>
                    {COLUMNS_IA.map((c) => <td key={c.key} title={c.type === 'text' ? row[c.key] : undefined}>{renderCell(c, row)}</td>)}
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={COLUMNS_IA.length} className="ptable__empty">Sin resultados</td></tr>}
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
          {variosAgentes && (
            <Card title="Contactos por Agente">
              <BarChart data={porAgente} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} width={140} />
                <Tooltip formatter={fmtNum} />
                <Bar dataKey="value" name="Contactos" radius={[0, 4, 4, 0]}>
                  {porAgente.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </Card>
          )}

          {variosAgentes && (
            <Card title="Embudo por etapa y agente" wide>
              <BarChart data={comparativa} margin={{ left: 10, right: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9fb3c8' }} interval={0} angle={-12} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#9fb3c8' }} width={40} />
                <Tooltip formatter={fmtNum} />
                <Legend />
                {agentesVisibles.map((a, i) => (
                  <Bar key={a} dataKey={a} name={a} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </Card>
          )}

          <Card title="Contactos por Etapa (embudo)" wide>
            <BarChart data={porEtapa} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9fb3c8' }} width={210} />
              <Tooltip formatter={fmtNum} />
              <Bar dataKey="value" name="Contactos" fill="#0068ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </Card>

          <Card title="Por Estado">
            <PieChart>
              <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={(e) => fmtNum(e.value)}>
                {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={fmtNum} />
              <Legend />
            </PieChart>
          </Card>

          <Card title="Por Asignado">
            <BarChart data={porAsignado} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} width={140} />
              <Tooltip formatter={fmtNum} />
              <Bar dataKey="value" name="Contactos" fill="#00c6ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </Card>

          <Card title="Contactos creados por mes" wide>
            <AreaChart data={creadasMes} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="gIA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0068ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0068ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9fb3c8' }} width={40} />
              <Tooltip formatter={fmtNum} />
              <Area type="monotone" dataKey="value" name="Creados" stroke="#0068ff" fill="url(#gIA)" strokeWidth={2} />
            </AreaChart>
          </Card>
        </section>
      )}
    </div>
  )
}
