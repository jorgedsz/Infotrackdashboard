import { useEffect, useMemo, useState } from 'react'
import {
  DATASETS, datasetMeta, evalMetric, metricMeta,
  loadMetrics, saveMetrics, newMetricDef,
} from '../lib/customMetrics'
import { fmtMoney, fmtNum, fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { fetchSharedMetrics, upsertSharedMetric, deleteSharedMetric } from '../services/metricsApi'
import { loadPipelineIA } from '../services/pipelineIaApi'
import { loadCitas } from '../services/citasApi'
import MultiSelect from './MultiSelect'

const fmtVal = (def, v) => (metricMeta(def.metric, def.dataset).money ? fmtMoney(v) : fmtNum(v))

// --- Tarjeta de una métrica ---
function MetricCard({ def, rows, onEdit, onDelete }) {
  const { value, count, grupos, metaTotal } = useMemo(() => evalMetric(rows, def), [rows, def])
  const ds = datasetMeta(def.dataset)
  // Con desglose, la meta de cabecera es la suma de las metas por fila (si no se
  // fijó una meta global aparte).
  const goal = Number(def.goal) || metaTotal || 0
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null
  const unidad = ds.key === 'citas' ? 'cita' : 'oportunidad'
  const campoDesglose = ds.fields.find((f) => f.key === def.groupBy)

  return (
    <div className="cmcard">
      <div className="cmcard__head">
        <span className="cmcard__name">{def.name || 'Sin nombre'}</span>
        <span className="cmcard__actions">
          <button onClick={() => onEdit(def)} title="Editar">✎</button>
          <button onClick={() => onDelete(def.id)} title="Eliminar">🗑</button>
        </span>
      </div>
      <div className="cmcard__metric">
        {metricMeta(def.metric, def.dataset).label}
        {ds.key !== 'comercial' && <span className="cmcard__dataset">{ds.label}</span>}
      </div>
      <div className="cmcard__value">{fmtVal(def, value)}</div>
      <div className="cmcard__count">{count} {unidad}{count === 1 ? '' : 's'}</div>
      {pct != null && (
        <div className="cmcard__goal">
          <div className="cmbar"><div className="cmbar__fill" style={{ width: pct + '%' }} /></div>
          <span className="cmcard__goaltext">
            {pct}% · meta {fmtVal(def, goal)}
          </span>
        </div>
      )}

      {grupos && grupos.length > 0 && (
        <table className="cmbreak">
          <thead>
            <tr>
              <th>{campoDesglose?.label || def.groupBy}</th>
              <th>Ejecutado</th>
              <th>Meta</th>
              <th>%</th>
              <th>GAP</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.name}>
                <td title={g.name}>{g.name}</td>
                <td className="cmbreak__num">{fmtVal(def, g.value)}</td>
                <td className="cmbreak__num">{g.meta ? fmtVal(def, g.meta) : '—'}</td>
                <td className="cmbreak__num">
                  {g.pct == null ? '—' : (
                    <span className={'cmbreak__pct' + (g.pct >= 100 ? ' cmbreak__pct--ok' : '')}>{g.pct}%</span>
                  )}
                </td>
                {/* GAP = ejecutado - meta: negativo es lo que falta */}
                <td className={'cmbreak__num' + (g.gap != null && g.gap < 0 ? ' cmbreak__num--neg' : '')}>
                  {g.gap == null ? '—' : fmtVal(def, g.gap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {((def.conditions || []).some((c) => c.values?.length) ||
        ds.dates.some(({ key }) => def.dates?.[key]?.from || def.dates?.[key]?.to)) && (
        <div className="cmcard__conds">
          {(def.conditions || []).filter((c) => c.values?.length).map((c, i) => (
            <span key={i} className="cmchip">
              {ds.fields.find((f) => f.key === c.field)?.label || c.field}: {c.values.join(', ')}
            </span>
          ))}
          {ds.dates.map(({ key, label }) => {
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
  const ds = datasetMeta(draft.dataset)
  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  // Cambiar de dataset invalida métrica, condiciones y fechas: se rearman desde cero
  const setDataset = (key) =>
    setDraft((d) => ({ ...newMetricDef(key), id: d.id, name: d.name, goal: d.goal }))
  const setCond = (i, patch) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const addCond = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: ds.defaultField, values: [] }] }))
  const removeCond = (i) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))
  const setDate = (key, side, value) =>
    setDraft((d) => ({ ...d, dates: { ...d.dates, [key]: { ...(d.dates?.[key] || {}), [side]: value } } }))

  return (
    <div className="cmbuilder">
      <div className="cmbuilder__row">
        <label className="cmfield">
          <span>Datos</span>
          <select value={ds.key} onChange={(e) => setDataset(e.target.value)}>
            {DATASETS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label className="cmfield">
          <span>Nombre</span>
          <input
            value={draft.name}
            placeholder="Ej. Citas agendadas de agosto"
            onChange={(e) => setField('name', e.target.value)}
          />
        </label>
        <label className="cmfield">
          <span>Medir</span>
          <select value={draft.metric} onChange={(e) => setField('metric', e.target.value)}>
            {ds.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="cmfield">
          <span>Desglosar por (opcional)</span>
          <select value={draft.groupBy || ''} onChange={(e) => setField('groupBy', e.target.value)}>
            <option value="">Sin desglose (un solo número)</option>
            {ds.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label className="cmfield">
          <span>Meta {draft.groupBy ? 'total (opcional)' : '(opcional)'}</span>
          <input
            type="number"
            value={draft.goal}
            placeholder={draft.groupBy ? 'suma de las metas de abajo' : 'Ej. 20'}
            onChange={(e) => setField('goal', e.target.value)}
          />
        </label>
      </div>

      {draft.groupBy && <MetasPorFila rows={rows} draft={draft} setDraft={setDraft} ds={ds} />}

      <div className="cmbuilder__conds">
        <span className="cmbuilder__label">Condiciones (se cumplen todas; dentro de cada una, cualquiera de los valores)</span>
        {draft.conditions.map((c, i) => {
          const options = [...new Set(rows.map((r) => r[c.field] ?? ''))].sort((a, b) =>
            String(a).localeCompare(String(b), 'es')
          )
          return (
            <div className="cmcond" key={i}>
              <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value, values: [] })}>
                {ds.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
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
        {ds.dates.map(({ key, label }) => (
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

// Metas por cada valor del campo de desglose (las filas del cuadro de resultados).
const TOPE_VALORES = 40
function MetasPorFila({ rows, draft, setDraft, ds }) {
  const campo = ds.fields.find((f) => f.key === draft.groupBy)
  const valores = useMemo(() => {
    const set = new Set(rows.map((r) => (r[draft.groupBy] ?? '') === '' ? '(sin dato)' : String(r[draft.groupBy])))
    for (const k of Object.keys(draft.goals || {})) set.add(k) // metas de valores que hoy no traen filas
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows, draft.groupBy, draft.goals])

  const setMeta = (valor, meta) =>
    setDraft((d) => {
      const goals = { ...(d.goals || {}) }
      if (meta === '') delete goals[valor]
      else goals[valor] = meta
      return { ...d, goals }
    })

  const visibles = valores.slice(0, TOPE_VALORES)
  return (
    <div className="cmbuilder__conds">
      <span className="cmbuilder__label">
        Meta de cada {campo?.label?.toLowerCase() || 'valor'} (opcional; en pesos, no en miles)
      </span>
      <div className="cmmetas">
        {visibles.map((v) => (
          <label className="cmmetas__item" key={v}>
            <span title={v}>{v}</span>
            <input
              type="number"
              value={draft.goals?.[v] ?? ''}
              placeholder="sin meta"
              onChange={(e) => setMeta(v, e.target.value)}
            />
          </label>
        ))}
      </div>
      {valores.length > visibles.length && (
        <span className="cmbuilder__label">
          Mostrando {visibles.length} de {valores.length} valores. Si son tantos, conviene
          desglosar por otro campo o filtrar con una condición.
        </span>
      )}
    </div>
  )
}

export default function CustomMetrics({ rows }) {
  const { authEnabled } = useAuth()
  const shared = authEnabled === true // con DB: métricas compartidas en el servidor
  const [metrics, setMetrics] = useState(shared ? [] : loadMetrics)
  const [draft, setDraft] = useState(null) // def en edición o null
  // Datasets extra: el comercial llega por props, IA y citas los traemos acá
  const [iaRows, setIaRows] = useState([])
  const [citasRows, setCitasRows] = useState([])

  // Carga inicial: del servidor (compartidas) o de localStorage (local)
  useEffect(() => {
    if (shared) fetchSharedMetrics().then(setMetrics).catch(() => setMetrics([]))
    else setMetrics(loadMetrics())
  }, [shared])

  // En modo local, persistimos en localStorage
  useEffect(() => { if (!shared) saveMetrics(metrics) }, [metrics, shared])

  // Datasets de IA y citas, refrescados al mismo ritmo que el resto del dashboard
  useEffect(() => {
    const load = () => {
      loadPipelineIA().then(({ rows }) => setIaRows(rows))
      loadCitas().then(({ rows }) => setCitasRows(rows))
    }
    load()
    const id = setInterval(load, 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const datasetRows = useMemo(
    () => ({ comercial: rows, ia: iaRows, citas: citasRows }),
    [rows, iaRows, citasRows]
  )
  const rowsDe = (def) => datasetRows[datasetMeta(def.dataset).key] || []

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
          Arma tus propias métricas sobre el pipeline comercial, el pipeline IA o las citas
          agendadas: define condiciones, elige qué medir y, si quieres, una meta. Con
          <strong> desglosar por</strong> obtienes un cuadro con una fila por comercial,
          línea o trimestre, cada una con su meta, su % de cumplimiento y su GAP.
        </p>
        {!draft && <button className="cmbtn cmbtn--primary" onClick={startNew}>+ Nueva métrica</button>}
      </div>

      {draft && (
        <Builder rows={rowsDe(draft)} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
      )}

      {metrics.length === 0 && !draft && (
        <div className="custommetrics__empty">
          Aún no has creado métricas. Toca <strong>+ Nueva métrica</strong> para empezar.
        </div>
      )}

      <div className="cmgrid">
        {metrics.map((def) => (
          <MetricCard key={def.id} def={def} rows={rowsDe(def)} onEdit={startEdit} onDelete={remove} />
        ))}
      </div>
    </div>
  )
}
