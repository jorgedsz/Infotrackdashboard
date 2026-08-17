import { useEffect, useMemo, useRef, useState } from 'react'

// A partir de esta cantidad de opciones mostramos el buscador (campos como
// "Fuente" traen cientos de valores distintos y son inmanejables a puro scroll).
const SEARCH_FROM = 8

// Dropdown de selección múltiple con checkboxes. value = Set de seleccionados.
export default function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Al cerrar, limpiamos la búsqueda para que la próxima apertura arranque completa
  useEffect(() => { if (!open) setQ('') }, [open])

  const withSearch = options.length >= SEARCH_FROM
  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => String(o).toLowerCase().includes(term))
  }, [options, q])

  const toggle = (opt) => {
    const next = new Set(value)
    next.has(opt) ? next.delete(opt) : next.add(opt)
    onChange(next)
  }
  // "Todos"/"Ninguno" actúan sobre lo visible: sin búsqueda es todo, con búsqueda
  // permite seleccionar de a grupos sin perder lo ya elegido.
  const selectVisible = () => onChange(new Set([...value, ...visibles]))
  const clearVisible = () => {
    const next = new Set(value)
    for (const o of visibles) next.delete(o)
    onChange(next)
  }

  const count = value.size
  return (
    <div className="ms" ref={ref}>
      <button
        type="button"
        className={'ms__btn' + (count ? ' ms__btn--active' : '')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ms__label">{label}</span>
        {count > 0 && <span className="ms__count">{count}</span>}
        <span className="ms__caret">▾</span>
      </button>
      {open && (
        <div className="ms__menu">
          {withSearch && (
            <input
              className="ms__search"
              type="search"
              value={q}
              autoFocus
              placeholder={`Buscar en ${options.length} valores…`}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
          <div className="ms__actions">
            <button type="button" onClick={selectVisible}>Todos</button>
            <button type="button" onClick={clearVisible}>Ninguno</button>
          </div>
          <div className="ms__list">
            {visibles.map((opt) => (
              <label key={opt} className="ms__opt">
                <input type="checkbox" checked={value.has(opt)} onChange={() => toggle(opt)} />
                <span>{opt === '' ? '(vacío)' : opt}</span>
              </label>
            ))}
            {visibles.length === 0 && <div className="ms__empty">Sin coincidencias</div>}
          </div>
        </div>
      )}
    </div>
  )
}
