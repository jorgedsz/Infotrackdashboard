import { useEffect, useMemo, useState } from 'react'
import {
  METRIC_OPTIONS, CONDITION_FIELDS, DATE_FIELDS, evalMetric, metricMeta,
  loadMetrics, saveMetrics, newMetricDef,
} from '../lib/customMetrics'
import { fmtMoney, fmtNum, fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { fetchSharedMetrics, upsertSharedMetric, deleteSharedMetric } from '../services/metricsApi'
import MultiSelect from './MultiSelect'

const fmtVal = (key, v) => (metricMeta(key).money ? fmtMoney(v) : fmtNum(v))

// --- Tarjeta de una métrica ---
function MetricCard({ def, rows, onEdit, onDelete }) {
  const { value, count } = useMemo(() => evalMetric(rows, def), [rows, def])
  const goal = Number(def.goal) || 0
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null

  return (
    <div className="cmcard">
      <div className="cmcard__head">
        <span className="cmcard__name">{def.name || 'Sin nombre'}</span>
        <span className="cmcard__actions">
          <button onClick={() => onEdit(def)} title="Editar">✎</button>
          <button onClick={() => onDelete(def.id)} title="Eliminar">🗑</button>
        </span>
      </div>
      <div className="cmcard__metric">{metricMeta(def.metric).label}</div>
      <div className="cmcard__value">{fmtVal(def.metric, value)}</div>
      <div className="cmcard__count">{count} oportunidad{count === 1 ? '' : 'es'}</div>
      {pct != null && (
        <div className="cmcard__goal">
          <div className="cmbar"><div className="cmbar__fill" style={{ width: pct + '%' }} /></div>
          <span className="cmcard__goaltext">
            {pct}% · meta {fmtVal(def.metric, goal)}
          </span>
        </div>
      )}
      {((def.conditions || []).some((c) => c.values?.length) ||
        DATE_FIELDS.some(({ key }) => def.dates?.[key]?.from || def.dates?.[key]?.to)) && (
        <div className="cmcard__conds">
          {(def.conditions || []).filter((c) => c.values?.length).map((c, i) => (
            <span key={i} className="cmchip">
              {CONDITION_FIELDS.find((f) => f.key === c.field)?.label || c.field}: {c.values.join(', ')}
            </span>
          ))}
          {DATE_FIELDS.map(({ key, label }) => {
            const r = def.dates?.[key]
            if (!r || (!r.from && !r.to)) return null
            return (
              <span key={key} className="cmchip">
                {label}: {r.from ? fmtDate(r.from) : '…'} – {r.to ? fmtDate(r.to) : '…'}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Constructor (form) ---
function Builder({ rows, draft, setDraft, onSave, onCancel }) {
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const setCond = (i, patch) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const addCond = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: 'comercial', values: [] }] }))
  const removeCond = (i) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))
  const setDate = (key, side, value) =>
    setDraft((d) => ({ ...d, dates: { ...d.dates, [key]: { ...(d.dates?.[key] || {}), [side]: value } } }))

  return (
    <div className="cmbuilder">
      <div className="cmbuilder__row">
        <label className="cmfield">
          <span>Nombre</span>
          <input
            value={draft.name}
            placeholder="Ej. Meta Isabel Zapata"
            onChange={(e) => setField('name', e.target.value)}
          />
        </label>
        <label className="cmfield">
          <span>Medir</span>
          <select value={draft.metric} onChange={(e) => setField('metric', e.target.value)}>
            {METRIC_OPTIONS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="cmfield">
          <span>Meta (opcional)</span>
          <input
            type="number"
            value={draft.goal}
            placeholder="Ej. 100000000"
            onChange={(e) => setField('goal', e.target.value)}
          />
        </label>
      </div>

      <div className="cmbuilder__conds">
        <span className="cmbuilder__label">Condiciones (se cumplen todas; dentro de cada una, cualquiera de los valores)</span>
        {draft.conditions.map((c, i) => {
          const options = [...new Set(rows.map((r) => r[c.field] ?? ''))].sort((a, b) =>
            String(a).localeCompare(String(b), 'es')
          )
          return (
            <div className="cmcond" key={i}>
              <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value, values: [] })}>
                {CONDITION_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <MultiSelect
                label="Valores"
                options={options}
                value={new Set(c.values)}
                onChange={(set) => setCond(i, { values: [...set] })}
              />
              {draft.conditions.length > 1 && (
                <button className="cmcond__rm" onClick={() => removeCond(i)} title="Quitar condición">✕</button>
              )}
            </div>
          )
        })}
        <button className="cmbuilder__add" onClick={addCond}>+ Agregar condición</button>
      </div>

      <div className="cmbuilder__conds">
        <span className="cmbuilder__label">Rangos de fecha (opcional)</span>
        {DATE_FIELDS.map(({ key, label }) => (
          <div className="cmcond" key={key}>
            <span className="cmdate__label">{label}</span>
            <input
              type="date"
              className="cmdate__input"
              value={draft.dates?.[key]?.from || ''}
              onChange={(e) => setDate(key, 'from', e.target.value)}
              title={`${label} desde`}
            />
            <span className="daterange__sep">–</span>
            <input
              type="date"
              className="cmdate__input"
              value={draft.dates?.[key]?.to || ''}
              onChange={(e) => setDate(key, 'to', e.target.value)}
              title={`${label} hasta`}
            />
          </div>
        ))}
      </div>

      <div className="cmbuilder__footer">
        <button className="cmbtn cmbtn--primary" onClick={onSave} disabled={!draft.name.trim()}>Guardar</button>
        <button className="cmbtn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

export default function CustomMetrics({ rows }) {
  const { authEnabled } = useAuth()
  const shared = authEnabled === true // con DB: métricas compartidas en el servidor
  const [metrics, setMetrics] = useState(shared ? [] : loadMetrics)
  const [draft, setDraft] = useState(null) // def en edición o null

  // Carga inicial: del servidor (compartidas) o de localStorage (local)
  useEffect(() => {
    if (shared) fetchSharedMetrics().then(setMetrics).catch(() => setMetrics([]))
    else setMetrics(loadMetrics())
  }, [shared])

  // En modo local, persistimos en localStorage
  useEffect(() => { if (!shared) saveMetrics(metrics) }, [metrics, shared])

  const startNew = () => setDraft(newMetricDef())
  const startEdit = (def) => setDraft({ ...def, conditions: def.conditions.map((c) => ({ ...c })) })
  const cancel = () => setDraft(null)
  const save = async () => {
    setMetrics((ms) => {
      const exists = ms.some((m) => m.id === draft.id)
      return exists ? ms.map((m) => (m.id === draft.id ? draft : m)) : [...ms, draft]
    })
    if (shared) { try { await upsertSharedMetric(draft) } catch { /* noop */ } }
    setDraft(null)
  }
  const remove = async (id) => {
    setMetrics((ms) => ms.filter((m) => m.id !== id))
    if (shared) { try { await deleteSharedMetric(id) } catch { /* noop */ } }
  }

  return (
    <div className="custommetrics">
      <div className="custommetrics__head">
        <p className="custommetrics__hint">
          Arma tus propias métricas: define condiciones, elige qué medir y, si quieres, una meta.
        </p>
        {!draft && <button className="cmbtn cmbtn--primary" onClick={startNew}>+ Nueva métrica</button>}
      </div>

      {draft && (
        <Builder rows={rows} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
      )}

      {metrics.length === 0 && !draft && (
        <div className="custommetrics__empty">
          Aún no has creado métricas. Toca <strong>+ Nueva métrica</strong> para empezar.
        </div>
      )}

      <div className="cmgrid">
        {metrics.map((def) => (
          <MetricCard key={def.id} def={def} rows={rows} onEdit={startEdit} onDelete={remove} />
        ))}
      </div>
    </div>
  )
}
