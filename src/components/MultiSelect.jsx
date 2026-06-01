import { useEffect, useRef, useState } from 'react'

// Dropdown de selección múltiple con checkboxes. value = Set de seleccionados.
export default function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (opt) => {
    const next = new Set(value)
    next.has(opt) ? next.delete(opt) : next.add(opt)
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
          <div className="ms__actions">
            <button type="button" onClick={() => onChange(new Set(options))}>Todos</button>
            <button type="button" onClick={() => onChange(new Set())}>Ninguno</button>
          </div>
          <div className="ms__list">
            {options.map((opt) => (
              <label key={opt} className="ms__opt">
                <input type="checkbox" checked={value.has(opt)} onChange={() => toggle(opt)} />
                <span>{opt === '' ? '(vacío)' : opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
