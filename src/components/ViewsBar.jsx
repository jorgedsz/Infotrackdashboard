import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listViews, saveView, removeView } from '../services/viewsApi'

// Barra de vistas: guarda y reaplica presets de filtros (personales).
// getState() -> estado actual serializable | applyState(state) -> lo reaplica
export default function ViewsBar({ getState, applyState }) {
  const { authEnabled } = useAuth()
  const enabled = authEnabled === true
  const [views, setViews] = useState([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    listViews(enabled).then(setViews).catch(() => setViews([]))
  }, [enabled])

  const save = async () => {
    const name = window.prompt('Nombre de la vista (ej. "Abiertas Colombia"):')
    if (!name || !name.trim()) return
    const view = { id: crypto?.randomUUID?.() || String(Date.now()), name: name.trim(), state: getState() }
    const next = [...views, view]
    setViews(next)
    setSelected(view.id)
    try { await saveView(enabled, view, next) } catch { /* noop */ }
  }

  const apply = (id) => {
    setSelected(id)
    const v = views.find((x) => x.id === id)
    if (v) applyState(v.state)
  }

  const remove = async () => {
    if (!selected) return
    const v = views.find((x) => x.id === selected)
    if (!v || !window.confirm(`¿Eliminar la vista "${v.name}"?`)) return
    const next = views.filter((x) => x.id !== selected)
    setViews(next)
    setSelected('')
    try { await removeView(enabled, v.id, next) } catch { /* noop */ }
  }

  return (
    <div className="viewsbar">
      <span className="viewsbar__label">Vistas:</span>
      <select className="viewsbar__select" value={selected} onChange={(e) => apply(e.target.value)}>
        <option value="">— Selecciona una vista —</option>
        {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <button className="viewsbar__btn viewsbar__btn--primary" onClick={save} title="Guardar los filtros actuales como vista">
        + Guardar vista actual
      </button>
      {selected && (
        <button className="viewsbar__btn viewsbar__btn--danger" onClick={remove} title="Eliminar la vista seleccionada">
          Eliminar
        </button>
      )}
    </div>
  )
}
