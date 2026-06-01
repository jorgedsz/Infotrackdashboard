import { FILTER_COLUMNS } from '../lib/columns'
import MultiSelect from './MultiSelect'

// filters: { [colKey]: Set<value> }  (Set vacío = sin filtrar por esa columna)
export default function FilterBar({ rows, filters, setFilters, search, setSearch, onReset }) {
  const setCol = (key, set) => setFilters((f) => ({ ...f, [key]: set }))

  const activeCount =
    Object.values(filters).reduce((a, s) => a + (s?.size || 0), 0) + (search ? 1 : 0)

  return (
    <div className="filterbar">
      <input
        className="filterbar__search"
        placeholder="Buscar empresa, proyecto, # oport…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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
      {activeCount > 0 && (
        <button className="filterbar__reset" onClick={onReset}>
          Limpiar ({activeCount})
        </button>
      )}
    </div>
  )
}
