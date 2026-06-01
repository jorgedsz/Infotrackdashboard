import { useEffect, useMemo, useState } from 'react'
import { enrichAll } from '../lib/calc'
import { FILTER_COLUMNS } from '../lib/columns'
import { loadPipeline } from '../services/pipelineApi'
import FilterBar from '../components/FilterBar'
import KpiBar from '../components/KpiBar'
import Charts from '../components/Charts'
import PipelineTable from '../components/PipelineTable'

const emptyFilters = () => Object.fromEntries(FILTER_COLUMNS.map((c) => [c.key, new Set()]))

const SOURCE_LABEL = {
  ghl: 'GoHighLevel (en vivo)',
  seed: 'Datos del Excel',
  'seed-local': 'Datos del Excel (sin backend)',
  'ghl-error': 'Error GHL — mostrando Excel',
}

export default function InfoTrackDashboard() {
  const [rawRows, setRawRows] = useState([])
  const [meta, setMeta] = useState({ source: null, updatedAt: null, error: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPipeline().then(({ rows, source, updatedAt, error }) => {
      setRawRows(rows)
      setMeta({ source, updatedAt, error })
      setLoading(false)
    })
  }, [])

  // Enriquecemos: aplica todas las fórmulas a las oportunidades
  const allRows = useMemo(() => enrichAll(rawRows), [rawRows])

  const [filters, setFilters] = useState(emptyFilters)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('tabla')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((row) => {
      for (const [key, set] of Object.entries(filters)) {
        if (set.size && !set.has(row[key] ?? '')) return false
      }
      if (q) {
        const hay = `${row.empresa} ${row.proyecto} ${row.oportunidad}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allRows, filters, search])

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>InfoTrack Dashboard</h1>
          <p className="dashboard__subtitle">
            Pipeline Total · {SOURCE_LABEL[meta.source] || 'cargando…'}
            {meta.updatedAt && ` · actualizado ${new Date(meta.updatedAt).toLocaleString('es-CO')}`}
          </p>
        </div>
        <span className="dashboard__badge">
          {loading ? 'cargando…' : `${filtered.length} / ${allRows.length} oportunidades`}
        </span>
      </header>

      <KpiBar rows={filtered} />

      <FilterBar
        rows={allRows}
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        onReset={() => { setFilters(emptyFilters()); setSearch('') }}
      />

      <nav className="tabs">
        <button className={'tab' + (tab === 'tabla' ? ' tab--active' : '')} onClick={() => setTab('tabla')}>
          Tabla
        </button>
        <button className={'tab' + (tab === 'graficos' ? ' tab--active' : '')} onClick={() => setTab('graficos')}>
          Gráficos
        </button>
      </nav>

      {tab === 'tabla' ? <PipelineTable rows={filtered} /> : <Charts rows={filtered} />}
    </div>
  )
}
