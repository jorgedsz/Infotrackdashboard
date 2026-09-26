import { useEffect, useMemo, useState } from 'react'
import { loadPipelinesDisponibles, saveIaPipelines } from '../services/iaPipelinesApi'

// Configuración de los pipelines IA: el admin marca cuáles de los pipelines de
// GoHighLevel son pipelines de agente y, si quiere, les pone un alias.
// Cuando el equipo cree un pipeline nuevo en GHL, aparece acá para marcarlo:
// no hay que tocar variables de entorno ni volver a desplegar.
export default function IaPipelinesAdmin({ onSaved }) {
  const [pipelines, setPipelines] = useState([])
  const [sel, setSel] = useState({}) // id -> { alias }
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: '', ok: '' })

  const cargar = async () => {
    try {
      const lista = await loadPipelinesDisponibles()
      setPipelines(lista)
      setSel(Object.fromEntries(
        lista.filter((p) => p.seleccionado).map((p) => [p.id, { alias: p.alias || '' }])
      ))
      setEstado((e) => ({ ...e, cargando: false, error: '' }))
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false, error: String(e.message || e) }))
    }
  }
  useEffect(() => { cargar() }, [])

  const toggle = (id) =>
    setSel((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else next[id] = { alias: '' }
      return next
    })

  const setAlias = (id, alias) => setSel((s) => ({ ...s, [id]: { ...s[id], alias } }))

  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return pipelines
    return pipelines.filter((p) => p.nombre.toLowerCase().includes(term))
  }, [pipelines, q])

  // Se envían en el orden en que aparecen los pipelines en GHL, para que el
  // orden de los agentes sea estable entre guardados.
  const guardar = async () => {
    setEstado((s) => ({ ...s, guardando: true, error: '', ok: '' }))
    try {
      const cuerpo = pipelines
        .filter((p) => sel[p.id])
        .map((p) => ({ id: p.id, alias: sel[p.id].alias }))
      await saveIaPipelines(cuerpo)
      setEstado((s) => ({ ...s, guardando: false, ok: `Guardado: ${cuerpo.length} pipeline(s) IA` }))
      await cargar()
      onSaved?.()
    } catch (e) {
      setEstado((s) => ({ ...s, guardando: false, error: String(e.message || e) }))
    }
  }

  const cuenta = Object.keys(sel).length

  if (estado.cargando) return <div className="iapipes__msg">Cargando pipelines de GoHighLevel…</div>

  return (
    <div className="iapipes">
      <div className="cmbuilder">
        <span className="cmbuilder__label">
          Marca los pipelines que son de agentes IA. Cada uno se muestra como un “Agente”
          en la tabla, los filtros y los gráficos. El alias es opcional: si lo dejas vacío
          se usa el nombre del pipeline en GoHighLevel.
        </span>

        <div className="cmbuilder__row">
          <label className="cmfield" style={{ flex: '1 1 260px' }}>
            <span>Buscar pipeline</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del pipeline…" />
          </label>
          <div className="cmfield" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
            <span>Seleccionados</span>
            <strong style={{ fontSize: 20 }}>{cuenta}</strong>
          </div>
        </div>

        <div className="tablewrap">
          <table className="ptable">
            <thead>
              <tr>
                <th style={{ width: 40 }}>IA</th>
                <th>Pipeline en GHL</th>
                <th>Alias (nombre del agente)</th>
                <th>Etapas</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const marcado = !!sel[p.id]
                return (
                  <tr key={p.id} className={marcado ? 'iapipes__row--on' : undefined}>
                    <td>
                      <input type="checkbox" checked={marcado} onChange={() => toggle(p.id)}
                        aria-label={`Usar ${p.nombre} como pipeline IA`} />
                    </td>
                    <td title={p.id}>{p.nombre}</td>
                    <td>
                      <input className="iapipes__alias" value={sel[p.id]?.alias || ''} disabled={!marcado}
                        onChange={(e) => setAlias(p.id, e.target.value)}
                        placeholder={marcado ? p.nombre : '—'} />
                    </td>
                    <td className="iapipes__etapas" title={p.etapas.join(' → ')}>
                      {p.etapas.length} etapas
                    </td>
                  </tr>
                )
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={4} className="ptable__empty">Sin pipelines</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {estado.error && <div className="login__error">{estado.error}</div>}
        {estado.ok && <div className="iapipes__ok">{estado.ok}</div>}

        <div className="cmbuilder__footer">
          <button className="cmbtn cmbtn--primary" onClick={guardar} disabled={estado.guardando}>
            {estado.guardando ? 'Guardando…' : 'Guardar selección'}
          </button>
          <button className="cmbtn" onClick={cargar} disabled={estado.guardando}>Descartar cambios</button>
          <span className="iapipes__hint">
            Al guardar se consulta GoHighLevel de inmediato; la data del agente nuevo
            aparece en el siguiente refresco.
          </span>
        </div>
      </div>
    </div>
  )
}
