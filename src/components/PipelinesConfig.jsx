import { useEffect, useMemo, useState } from 'react'
import { loadPipelinesConfig, savePipelinesConfig } from '../services/pipelinesConfigApi'

// Configuración de pipelines (solo admin): cuál es el pipeline comercial y
// cuáles son los de agentes IA. Los pipelines salen de GoHighLevel, así que uno
// nuevo aparece acá solo — sin variables de entorno ni redeploy.
const TODAS = '__todas__' // valor del select para "todas las oportunidades"

export default function PipelinesConfig({ onSaved }) {
  const [pipelines, setPipelines] = useState([])
  const [comercial, setComercial] = useState(TODAS)
  const [ia, setIa] = useState({}) // id -> { alias }
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: '', ok: '' })

  const cargar = async () => {
    try {
      const cfg = await loadPipelinesConfig()
      setPipelines(cfg.pipelines)
      setComercial(cfg.comercial || TODAS)
      setIa(Object.fromEntries(cfg.ia.map((p) => [p.id, { alias: p.alias || '' }])))
      setEstado((e) => ({ ...e, cargando: false, error: '' }))
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false, error: String(e.message || e) }))
    }
  }
  useEffect(() => { cargar() }, [])

  // Un pipeline es comercial o de agente, no las dos cosas: al elegirlo como
  // comercial lo sacamos de la selección IA.
  const elegirComercial = (valor) => {
    setComercial(valor)
    if (valor !== TODAS) {
      setIa((s) => {
        if (!s[valor]) return s
        const next = { ...s }
        delete next[valor]
        return next
      })
    }
  }

  const toggleIa = (id) =>
    setIa((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else next[id] = { alias: '' }
      return next
    })

  const setAlias = (id, alias) => setIa((s) => ({ ...s, [id]: { ...s[id], alias } }))

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return pipelines
    return pipelines.filter((p) => p.nombre.toLowerCase().includes(term))
  }, [pipelines, q])

  const guardar = async () => {
    setEstado((s) => ({ ...s, guardando: true, error: '', ok: '' }))
    try {
      // Se envían en el orden en que están en GHL, para que el orden de los
      // agentes sea estable entre guardados.
      const listaIa = pipelines.filter((p) => ia[p.id]).map((p) => ({ id: p.id, alias: ia[p.id].alias }))
      await savePipelinesConfig({ comercial: comercial === TODAS ? null : comercial, ia: listaIa })
      setEstado((s) => ({ ...s, guardando: false, ok: `Guardado: 1 pipeline comercial y ${listaIa.length} de agentes IA` }))
      await cargar()
      onSaved?.()
    } catch (e) {
      setEstado((s) => ({ ...s, guardando: false, error: String(e.message || e) }))
    }
  }

  if (estado.cargando) return <div className="cfg__msg">Cargando pipelines de GoHighLevel…</div>
  if (estado.error && !pipelines.length) return <div className="login__error">{estado.error}</div>

  const nombreComercial = pipelines.find((p) => p.id === comercial)?.nombre

  return (
    <div className="cfg">
      <div className="cmbuilder">
        <span className="cmbuilder__label">
          Qué pipelines de GoHighLevel usa el dashboard. Cuando el equipo cree uno nuevo
          aparece en esta lista: basta configurarlo acá.
        </span>

        <div className="cmbuilder__row">
          <label className="cmfield" style={{ flex: '1 1 320px' }}>
            <span>Pipeline comercial</span>
            <select value={comercial} onChange={(e) => elegirComercial(e.target.value)}>
              <option value={TODAS}>Todas las oportunidades de la cuenta</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <div className="cmfield" style={{ flex: '1 1 260px' }}>
            <span>Alimenta</span>
            <span className="cfg__nota">
              KPIs, booking, facturación y Mis Métricas del Pipeline Comercial.
              {comercial === TODAS
                ? ' Con “todas” se mezclan los pipelines de la cuenta, incluidos los de IA.'
                : ` Hoy: ${nombreComercial || comercial}.`}
            </span>
          </div>
        </div>

        <div className="cmbuilder__row" style={{ marginBottom: 6 }}>
          <label className="cmfield" style={{ flex: '1 1 260px' }}>
            <span>Buscar pipeline</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del pipeline…" />
          </label>
          <div className="cmfield" style={{ flex: '0 0 auto' }}>
            <span>Agentes IA seleccionados</span>
            <strong style={{ fontSize: 20 }}>{Object.keys(ia).length}</strong>
          </div>
        </div>

        <div className="tablewrap">
          <table className="ptable">
            <thead>
              <tr>
                <th style={{ width: 44 }}>IA</th>
                <th>Pipeline en GHL</th>
                <th>Alias (nombre del agente)</th>
                <th>Etapas</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const esComercial = p.id === comercial
                const marcado = !!ia[p.id]
                return (
                  <tr key={p.id} className={marcado ? 'cfg__row--on' : undefined}>
                    <td>
                      <input type="checkbox" checked={marcado} disabled={esComercial}
                        onChange={() => toggleIa(p.id)}
                        title={esComercial ? 'Es el pipeline comercial' : `Usar ${p.nombre} como pipeline de agente IA`}
                        aria-label={`Usar ${p.nombre} como pipeline de agente IA`} />
                    </td>
                    <td title={p.id}>
                      {p.nombre}
                      {esComercial && <span className="cfg__tag">comercial</span>}
                    </td>
                    <td>
                      <input className="cfg__alias" value={ia[p.id]?.alias || ''} disabled={!marcado}
                        onChange={(e) => setAlias(p.id, e.target.value)}
                        placeholder={marcado ? p.nombre : '—'} />
                    </td>
                    <td className="cfg__etapas" title={p.etapas.join(' → ')}>{p.etapas.length} etapas</td>
                  </tr>
                )
              })}
              {visibles.length === 0 && <tr><td colSpan={4} className="ptable__empty">Sin pipelines</td></tr>}
            </tbody>
          </table>
        </div>

        {estado.error && <div className="login__error">{estado.error}</div>}
        {estado.ok && <div className="cfg__ok">{estado.ok}</div>}

        <div className="cmbuilder__footer">
          <button className="cmbtn cmbtn--primary" onClick={guardar} disabled={estado.guardando}>
            {estado.guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
          <button className="cmbtn" onClick={cargar} disabled={estado.guardando}>Descartar cambios</button>
          <span className="cfg__hint">
            El alias es opcional: sin alias se usa el nombre del pipeline en GoHighLevel.
            Al guardar se consulta GHL de inmediato.
          </span>
        </div>
      </div>
    </div>
  )
}
