import { useEffect, useMemo, useState } from 'react'
import { loadTablas, saveTablas } from '../services/tablasApi'
import { TABLAS_DEFECTO } from '../lib/calc'

// Editor de las tablas que alimentan el cálculo. Antes vivían en el código, así
// que agregar un aliado o ajustar un margen obligaba a desplegar.
const LINEAS = [
  { key: 'sumhw', label: 'SUMHW' },
  { key: 'hwaas', label: 'HWAAS' },
  { key: 'svcs', label: 'SVCS' },
  { key: 'swter', label: 'SWTER' },
  { key: 'swss', label: 'SOLSS' },
]
// Los porcentajes se guardan como fracción (0,22) pero se editan como 22 %.
const aPct = (v) => (v == null || v === '' ? '' : String(Math.round(Number(v) * 10000) / 100))
const dePct = (v) => (v === '' ? '' : Number(v) / 100)

// Tabla clave → valor (probabilidades, KARE, aliados): buscador, edición y borrado.
function TablaClaveValor({ titulo, ayuda, tabla, numerica, onChange }) {
  const [q, setQ] = useState('')
  const [nuevaClave, setNuevaClave] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')

  const claves = useMemo(() => {
    const term = q.trim().toLowerCase()
    const todas = Object.keys(tabla).sort((a, b) => a.localeCompare(b, 'es'))
    return term ? todas.filter((k) => k.toLowerCase().includes(term)) : todas
  }, [tabla, q])

  const setValor = (clave, valor) => onChange({ ...tabla, [clave]: valor })
  const quitar = (clave) => {
    const next = { ...tabla }
    delete next[clave]
    onChange(next)
  }
  const agregar = () => {
    const clave = nuevaClave.trim()
    if (!clave) return
    onChange({ ...tabla, [clave]: numerica ? dePct(nuevoValor || '0') : nuevoValor })
    setNuevaClave('')
    setNuevoValor('')
  }

  return (
    <details className="tabc" open={Object.keys(tabla).length <= 8}>
      <summary className="tabc__head">
        <span className="cfg__titulo">{titulo}</span>
        <span className="tabc__cuenta">{Object.keys(tabla).length} entradas</span>
      </summary>
      <p className="cfg__nota">{ayuda}</p>

      {Object.keys(tabla).length > 8 && (
        <input className="tabc__buscar" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…" />
      )}

      <div className="tabc__lista">
        {claves.map((k) => (
          <div className="tabc__fila" key={k}>
            <span className="tabc__clave" title={k}>{k}</span>
            <input
              value={numerica ? aPct(tabla[k]) : tabla[k] ?? ''}
              type={numerica ? 'number' : 'text'}
              onChange={(e) => setValor(k, numerica ? dePct(e.target.value) : e.target.value)}
            />
            {numerica && <span className="tabc__unidad">%</span>}
            <button className="tabc__rm" onClick={() => quitar(k)} title={`Quitar ${k}`}>✕</button>
          </div>
        ))}
        {claves.length === 0 && <span className="cfg__nota">Sin coincidencias.</span>}
      </div>

      <div className="tabc__nueva">
        <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)}
          placeholder={numerica ? 'Texto tal como está en GHL' : 'Valor de GHL (ej. nombre del aliado)'} />
        <input value={nuevoValor} type={numerica ? 'number' : 'text'}
          onChange={(e) => setNuevoValor(e.target.value)}
          placeholder={numerica ? '%' : 'A qué equivale'} />
        <button className="cmbtn" onClick={agregar} disabled={!nuevaClave.trim()}>+ Agregar</button>
      </div>
    </details>
  )
}

export default function TablasCalculo({ onSaved }) {
  const [tablas, setTablas] = useState(null)
  const [definicion, setDefinicion] = useState([])
  const [estado, setEstado] = useState({ cargando: true, guardando: false, error: '', ok: '' })

  const cargar = async () => {
    const { tablas, definicion, error } = await loadTablas()
    // Sin backend (o sin permiso) mostramos los valores del código, que son los
    // que el dashboard está usando de todos modos.
    setTablas(tablas || { ...TABLAS_DEFECTO })
    setDefinicion(definicion.length ? definicion : null)
    setEstado((e) => ({ ...e, cargando: false, error: error || '', ok: '' }))
  }
  useEffect(() => { cargar() }, [])

  const setTabla = (clave, valor) => setTablas((t) => ({ ...t, [clave]: valor }))

  const guardar = async () => {
    setEstado((e) => ({ ...e, guardando: true, error: '', ok: '' }))
    try {
      await saveTablas(tablas)
      setEstado((e) => ({ ...e, guardando: false, ok: 'Tablas guardadas. El dashboard recalcula con ellas.' }))
      onSaved?.()
    } catch (e) {
      setEstado((s) => ({ ...s, guardando: false, error: String(e.message || e) }))
    }
  }

  if (estado.cargando || !tablas) return <div className="cfg__msg">Cargando tablas de cálculo…</div>

  const sinDefinicion = definicion === null

  return (
    <div className="cfg">
      {sinDefinicion && (
        <div className="cfg__aviso">
          No se pudieron leer las tablas del servidor: se muestran los valores del código,
          que son los que el dashboard está usando. Guardar puede fallar.
        </div>
      )}

      <section className="cfg__bloque">
        <h3 className="cfg__titulo">Márgenes por línea de producto</h3>
        <p className="cfg__nota">
          <strong>MCB</strong> multiplica el monto de cada línea para el Margen de Contribución
          Bruto. <strong>MB</strong> multiplica la facturación mensual, según la línea dominante
          de la oportunidad. No confundir con la <em>Contribución</em>, que usa el Margen Mix de
          cada oportunidad y se llena en GoHighLevel.
        </p>
        <table className="ptable tabc__margenes">
          <thead><tr><th>Línea</th><th>MCB %</th><th>MB %</th></tr></thead>
          <tbody>
            {LINEAS.map((l) => (
              <tr key={l.key}>
                <td>{l.label}</td>
                <td>
                  <input type="number" value={aPct(tablas.mcb?.[l.key])}
                    onChange={(e) => setTabla('mcb', { ...tablas.mcb, [l.key]: dePct(e.target.value) })} />
                </td>
                <td>
                  <input type="number" value={aPct(tablas.mb?.[l.key])}
                    onChange={(e) => setTabla('mb', { ...tablas.mb, [l.key]: dePct(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cfg__bloque">
        <TablaClaveValor
          titulo="Probabilidad de cierre"
          ayuda="El texto de la probabilidad en GHL y el % con el que se sensibiliza el pipeline. La clave debe coincidir exactamente con la opción del CRM."
          tabla={tablas.probabilidad || {}}
          numerica
          onChange={(v) => setTabla('probabilidad', v)}
        />
      </section>

      <section className="cfg__bloque">
        <TablaClaveValor
          titulo="KARE → Tipo de venta"
          ayuda="A qué tipo de venta (Nuevo / Renovación) equivale cada valor del campo KARE."
          tabla={tablas.kareClasificacion || {}}
          onChange={(v) => setTabla('kareClasificacion', v)}
        />
      </section>

      <section className="cfg__bloque">
        <TablaClaveValor
          titulo="Aliado → Arquitecto"
          ayuda="Qué arquitecto corresponde a cada aliado. Un aliado sin entrada acá deja la columna Arquitecto vacía."
          tabla={tablas.aliadoArquitecto || {}}
          onChange={(v) => setTabla('aliadoArquitecto', v)}
        />
      </section>

      {estado.error && <div className="login__error">{estado.error}</div>}
      {estado.ok && <div className="cfg__ok">{estado.ok}</div>}

      <div className="cfg__acciones">
        <button className="cmbtn cmbtn--primary" onClick={guardar} disabled={estado.guardando}>
          {estado.guardando ? 'Guardando…' : 'Guardar tablas'}
        </button>
        <button className="cmbtn" onClick={cargar} disabled={estado.guardando}>Descartar cambios</button>
        <span className="cfg__hint">Los porcentajes se escriben como 22, no como 0,22.</span>
      </div>
    </div>
  )
}
