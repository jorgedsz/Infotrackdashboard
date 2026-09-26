import { useEffect, useMemo, useState } from 'react'
import { loadPipelinesConfig, savePipelinesConfig } from '../services/pipelinesConfigApi'

// Configuración de pipelines (solo admin), en dos bloques independientes:
//   1. el pipeline COMERCIAL, que alimenta KPIs, booking y facturación
//   2. los AGENTES IA, uno por tarjeta, cada uno atado a su pipeline de GHL
// Los pipelines salen de GoHighLevel, así que uno nuevo aparece acá solo.
const TODAS = '__todas__' // valor del select para "todas las oportunidades"
const SIN_PIPELINE = '' // agente recién agregado, aún sin pipeline elegido

// Clave local y estable para las tarjetas (el pipeline puede cambiar o estar vacío).
let contador = 0
const nuevaClave = () => `ag-${++contador}`

// Firma de las etapas, para detectar un agente cuyo embudo no calza con el resto.
const firma = (etapas = []) => etapas.join(' | ')

export default function PipelinesConfig({ onSaved }) {
  const [pipelines, setPipelines] = useState([])
  const [comercial, setComercial] = useState(TODAS)
  const [comercialHuerfano, setComercialHuerfano] = useState(null)
  const [agentes, setAgentes] = useState([]) // [{ clave, pipelineId, alias }]
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: '', ok: '' })

  const cargar = async () => {
    try {
      const cfg = await loadPipelinesConfig()
      setPipelines(cfg.pipelines)
      setComercial(cfg.comercial || TODAS)
      setComercialHuerfano(cfg.comercialExiste ? null : cfg.comercial)
      // Los agentes cuyo pipeline ya no existe se conservan como tarjeta marcada:
      // así se ve cuál quedó roto y se puede reasignar o eliminar.
      setAgentes(cfg.ia.map((p) => ({ clave: nuevaClave(), pipelineId: p.id, alias: p.alias || '' })))
      setEstado((e) => ({ ...e, cargando: false, error: '', ok: '' }))
    } catch (e) {
      setEstado((s) => ({ ...s, cargando: false, error: String(e.message || e) }))
    }
  }
  useEffect(() => { cargar() }, [])

  const porId = useMemo(() => new Map(pipelines.map((p) => [p.id, p])), [pipelines])

  // Un pipeline es comercial o de un agente, y de un solo agente: al elegirlo en
  // un lado lo sacamos del otro.
  const elegirComercial = (valor) => {
    setComercial(valor)
    if (valor !== TODAS) setAgentes((as) => as.filter((a) => a.pipelineId !== valor))
  }

  const editarAgente = (clave, cambios) =>
    setAgentes((as) => as.map((a) => (a.clave === clave ? { ...a, ...cambios } : a)))

  const quitarAgente = (clave) => setAgentes((as) => as.filter((a) => a.clave !== clave))
  const agregarAgente = () =>
    setAgentes((as) => [...as, { clave: nuevaClave(), pipelineId: SIN_PIPELINE, alias: '' }])

  // Para el select de una tarjeta: lo libre, más el propio.
  const opcionesPara = (agente) => {
    const tomados = new Set(agentes.filter((a) => a.clave !== agente.clave).map((a) => a.pipelineId))
    if (comercial !== TODAS) tomados.add(comercial)
    return pipelines.filter((p) => !tomados.has(p.id) || p.id === agente.pipelineId)
  }

  // Los agentes deberían compartir etapas; si uno difiere, los gráficos
  // comparativos quedan desalineados y conviene avisarlo.
  const firmaComun = useMemo(() => {
    const firmas = agentes.map((a) => firma(porId.get(a.pipelineId)?.etapas)).filter(Boolean)
    if (firmas.length < 2) return null
    const cuenta = new Map()
    for (const f of firmas) cuenta.set(f, (cuenta.get(f) || 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }, [agentes, porId])

  const sinPipeline = agentes.filter((a) => !a.pipelineId).length

  const guardar = async () => {
    if (sinPipeline) {
      setEstado((s) => ({ ...s, error: `Hay ${sinPipeline} agente(s) sin pipeline asignado.`, ok: '' }))
      return
    }
    setEstado((s) => ({ ...s, guardando: true, error: '', ok: '' }))
    try {
      const ia = agentes.map((a) => ({ id: a.pipelineId, alias: a.alias }))
      await savePipelinesConfig({ comercial: comercial === TODAS ? null : comercial, ia })
      setEstado((s) => ({ ...s, guardando: false, ok: `Guardado: pipeline comercial y ${ia.length} agente(s) IA` }))
      await cargar()
      onSaved?.()
    } catch (e) {
      setEstado((s) => ({ ...s, guardando: false, error: String(e.message || e) }))
    }
  }

  if (estado.cargando) return <div className="cfg__msg">Cargando pipelines de GoHighLevel…</div>
  if (estado.error && !pipelines.length) return <div className="login__error">{estado.error}</div>

  const nombreComercial = porId.get(comercial)?.nombre

  return (
    <div className="cfg">
      {/* --- Bloque 1: pipeline comercial --- */}
      <section className="cfg__bloque">
        <h3 className="cfg__titulo">Pipeline comercial</h3>
        <p className="cfg__nota">
          Alimenta los KPIs, el booking, la facturación y el dataset <em>Pipeline Comercial</em>
          {' '}de Mis Métricas. Es uno solo.
        </p>
        <div className="cfg__fila">
          <select className="cfg__select" value={comercial} onChange={(e) => elegirComercial(e.target.value)}>
            <option value={TODAS}>Todas las oportunidades de la cuenta</option>
            {comercialHuerfano === comercial && (
              <option value={comercial}>⚠ {comercial} — no está en GoHighLevel</option>
            )}
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <span className="cfg__nota">
            {comercial === TODAS
              ? 'Se mezclan todos los pipelines de la cuenta, incluidos los de los agentes IA.'
              : `${porId.get(comercial)?.etapas.length ?? '—'} etapas · ${nombreComercial || comercial}`}
          </span>
        </div>
        {comercialHuerfano === comercial && (
          <p className="cfg__alerta">
            GoHighLevel no devuelve este pipeline para la cuenta configurada: puede haber
            sido borrado, estar en otra sub-cuenta, o venir de la variable GHL_PIPELINE_ID.
            Elige uno de la lista.
          </p>
        )}
      </section>

      {/* --- Bloque 2: un agente por tarjeta --- */}
      <section className="cfg__bloque">
        <div className="cfg__bloquehead">
          <div>
            <h3 className="cfg__titulo">Agentes IA</h3>
            <p className="cfg__nota">
              Cada agente tiene su propio pipeline en GoHighLevel. El nombre es con el que
              aparece en la columna <em>Agente</em>, los filtros y los gráficos; si lo dejas
              vacío se usa el nombre del pipeline.
            </p>
          </div>
          <button className="cmbtn" onClick={agregarAgente}>+ Agregar agente</button>
        </div>

        {agentes.length === 0 && (
          <div className="cfg__vacio">
            Sin agentes configurados. Agrega uno para que el Pipeline IA muestre data.
          </div>
        )}

        <div className="cfg__agentes">
          {agentes.map((a, i) => {
            const p = porId.get(a.pipelineId)
            const huerfano = a.pipelineId && !p
            const etapas = p?.etapas || []
            const distinto = firmaComun && etapas.length > 0 && firma(etapas) !== firmaComun
            return (
              <article className={'agcard' + (huerfano ? ' agcard--alerta' : '')} key={a.clave}>
                <header className="agcard__head">
                  <span className="agcard__num">Agente {i + 1}</span>
                  <button className="agcard__rm" onClick={() => quitarAgente(a.clave)}
                    title="Quitar este agente">🗑</button>
                </header>

                <label className="cmfield">
                  <span>Nombre del agente</span>
                  <input value={a.alias} onChange={(e) => editarAgente(a.clave, { alias: e.target.value })}
                    placeholder={p?.nombre || 'Nombre del pipeline'} />
                </label>

                <label className="cmfield">
                  <span>Pipeline en GoHighLevel</span>
                  <select value={a.pipelineId} onChange={(e) => editarAgente(a.clave, { pipelineId: e.target.value })}>
                    <option value={SIN_PIPELINE}>— Elegir pipeline —</option>
                    {huerfano && <option value={a.pipelineId}>⚠ {a.pipelineId} — no está en GoHighLevel</option>}
                    {opcionesPara(a).map((op) => <option key={op.id} value={op.id}>{op.nombre}</option>)}
                  </select>
                </label>

                {huerfano ? (
                  <p className="cfg__alerta">
                    GoHighLevel no devuelve este pipeline. Reasigna el agente o quítalo.
                  </p>
                ) : etapas.length > 0 && (
                  <div className="agcard__etapas">
                    <span className="agcard__etapaslabel">{etapas.length} etapas</span>
                    <div className="cmcard__conds">
                      {etapas.map((e) => <span className="cmchip" key={e}>{e}</span>)}
                    </div>
                    {distinto && (
                      <p className="cfg__alerta">
                        Sus etapas no coinciden con las de los demás agentes: el embudo
                        comparativo va a quedar desalineado.
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {estado.error && <div className="login__error">{estado.error}</div>}
      {estado.ok && <div className="cfg__ok">{estado.ok}</div>}

      <div className="cfg__acciones">
        <button className="cmbtn cmbtn--primary" onClick={guardar} disabled={estado.guardando}>
          {estado.guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
        <button className="cmbtn" onClick={cargar} disabled={estado.guardando}>Descartar cambios</button>
        <span className="cfg__hint">Al guardar se consulta GoHighLevel de inmediato.</span>
      </div>
    </div>
  )
}
