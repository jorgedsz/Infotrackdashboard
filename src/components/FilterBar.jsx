import { FILTER_COLUMNS } from '../lib/columns'
import MultiSelect from './MultiSelect'

// Rangos de fecha editables que se muestran como controles Desde/Hasta
const DATE_RANGES = [
  { key: 'fechaCreacion', label: 'Creación' },
  { key: 'fechaCierre', label: 'Cierre' },
]

// filters: { [colKey]: Set<value> }  (Set vacío = sin filtrar por esa columna)
// dateFilters: { [colKey]: { from, to } }
export default function FilterBar({ rows, filters, setFilters, search, setSearch, dateFilters, setDateFilters, onReset }) {
  const setCol = (key, set) => setFilters((f) => ({ ...f, [key]: set }))
  const setDate = (key, side, value) =>
    setDateFilters((d) => ({ ...d, [key]: { ...d[key], [side]: value } }))

  const activeDates = Object.values(dateFilters || {}).reduce((a, r) => a + (r.from ? 1 : 0) + (r.to ? 1 : 0), 0)
  const activeCount =
    Object.values(filters).reduce((a, s) => a + (s?.size || 0), 0) + (search ? 1 : 0) + activeDates

  return (
    <div className="filterbar">
      {/* Búsqueda arriba, a todo lo ancho */}
      <div className="filterbar__searchrow">
        <input
          className="filterbar__search"
          placeholder="🔍  Buscar empresa, proyecto, # oportunidad…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {activeCount > 0 && (
          <button className="filterbar__reset" onClick={onReset}>
            Limpiar ({activeCount})
          </button>
        )}
      </div>

      {/* Filtros + rangos de fecha debajo */}
      <div className="filterbar__filters">
        {FILTER_COLUMNS.map((col) => {
          const options = [...new Set(rows.map((r) => r[col.key] ?? ''))].sort((a, b) =>
            String(a).localeCompare(String(b), 'es')
          )
          return (
            <MultiSelect
              key={col.key}
              label={col.label}
              options={options}
              value={filters[col.key] || new Set()}
              onChange={(set) => setCol(col.key, set)}
            />
          )
        })}

        {DATE_RANGES.map(({ key, label }) => (
          <div className="daterange" key={key}>
            <span className="daterange__label">{label}</span>
            <input
              type="date"
              className="daterange__input"
              value={dateFilters?.[key]?.from || ''}
              onChange={(e) => setDate(key, 'from', e.target.value)}
              title={`${label} desde`}
            />
            <span className="daterange__sep">–</span>
            <input
              type="date"
              className="daterange__input"
              value={dateFilters?.[key]?.to || ''}
              onChange={(e) => setDate(key, 'to', e.target.value)}
              title={`${label} hasta`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
