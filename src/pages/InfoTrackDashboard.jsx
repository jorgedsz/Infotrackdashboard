import { useCallback, useEffect, useMemo, useState } from 'react'
import { enrichAll } from '../lib/calc'
import { FILTER_COLUMNS } from '../lib/columns'
import { loadPipeline } from '../services/pipelineApi'
import FilterBar from '../components/FilterBar'
import KpiBar from '../components/KpiBar'
import Charts from '../components/Charts'
import PipelineTable from '../components/PipelineTable'
import CustomMetrics from '../components/CustomMetrics'

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
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    const { rows, source, updatedAt, error } = await loadPipeline()
    setRawRows(rows)
    setMeta({ source, updatedAt, error })
    setLoading(false)
    setRefreshing(false)
  }, [])

  // Carga inicial + auto-refresco cada 30 s (sin recargar la página)
  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  // Enriquecemos: aplica todas las fórmulas a las oportunidades
  const allRows = useMemo(() => enrichAll(rawRows), [rawRows])

  const [filters, setFilters] = useState(emptyFilters)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('tabla')
  // Rangos de fecha editables (ISO YYYY-MM-DD; '' = sin límite)
  const emptyDates = { fechaCreacion: { from: '', to: '' }, fechaCierre: { from: '', to: '' } }
  const [dateFilters, setDateFilters] = useState(emptyDates)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((row) => {
      for (const [key, set] of Object.entries(filters)) {
        if (set.size && !set.has(row[key] ?? '')) return false
      }
      // Rangos de fecha (comparación de strings ISO funciona lexicográficamente)
      for (const [key, { from, to }] of Object.entries(dateFilters)) {
        const v = row[key]
        if (from && (!v || v < from)) return false
        if (to && (!v || v > to)) return false
      }
      if (q) {
        const hay = `${row.empresa} ${row.proyecto} ${row.oportunidad}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allRows, filters, search, dateFilters])

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <img className="dashboard__logo" src="/logo-infotrack.png" alt="InfoTrack" />
        </div>
        <div className="dashboard__actions">
          <span className="dashboard__badge">
            {loading ? 'cargando…' : `${filtered.length} / ${allRows.length} oportunidades`}
          </span>
          <div className="dashboard__refreshcol">
            <button className="dashboard__refresh" onClick={fetchData} disabled={refreshing} title="Actualizar ahora">
              {refreshing ? '↻ …' : '↻ Actualizar'}
            </button>
            <span className="dashboard__live">auto cada 30s</span>
          </div>
        </div>
      </header>

      <KpiBar rows={filtered} />

      <FilterBar
        rows={allRows}
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        dateFilters={dateFilters}
        setDateFilters={setDateFilters}
        onReset={() => { setFilters(emptyFilters()); setSearch(''); setDateFilters(emptyDates) }}
      />

      <nav className="tabs">
        <button className={'tab' + (tab === 'tabla' ? ' tab--active' : '')} onClick={() => setTab('tabla')}>
          Tabla
        </button>
        <button className={'tab' + (tab === 'graficos' ? ' tab--active' : '')} onClick={() => setTab('graficos')}>
          Gráficos
        </button>
        <button className={'tab' + (tab === 'metricas' ? ' tab--active' : '')} onClick={() => setTab('metricas')}>
          Mis Métricas
        </button>
      </nav>

      {tab === 'tabla' && <PipelineTable rows={filtered} />}
      {tab === 'graficos' && <Charts rows={filtered} />}
      {tab === 'metricas' && <CustomMetrics rows={allRows} />}
    </div>
  )
}
