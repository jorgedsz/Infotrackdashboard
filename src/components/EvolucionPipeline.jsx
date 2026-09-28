import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { loadSnapshots, tomarSnapshot } from '../services/snapshotsApi'
import { fmtMoney, fmtCompact, fmtNum, fmtDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'

// Evolución del pipeline entre dos fechas, como la hoja "Evol.Pipeline" del Excel:
// el valor de cada estado en cada fecha, su diferencia y su variación.
const DIMENSIONES = [
  { key: 'porEstado', label: 'Estado' },
  { key: 'porFase', label: 'Fase' },
  { key: 'porComercial', label: 'Comercial' },
]
const MEDIDAS = [
  { key: 'booking', label: 'Booking', money: true },
  { key: 'oportunidades', label: '# Oportunidades', money: false },
]
const COLORS = ['#0068ff', '#00c6ff', '#6b8299', '#79b4ff', '#013a7a', '#5ad8ff', '#94a3b0', '#3385ff']

export default function EvolucionPipeline() {
  const { user, authEnabled } = useAuth()
  const esAdmin = authEnabled === false || user?.role === 'admin'
  const [snapshots, setSnapshots] = useState([])
  const [estado, setEstado] = useState({ cargando: true, sinHistorico: false, error: '', guardando: false })
  const [dim, setDim] = useState('porEstado')
  const [medida, setMedida] = useState('booking')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = async () => {
    const { snapshots, sinHistorico, error } = await loadSnapshots()
    setSnapshots(snapshots)
    setEstado((e) => ({ ...e, cargando: false, sinHistorico, error: error || '' }))
    // Por defecto comparamos las dos últimas fotos, que es lo que se quiere ver al entrar
    if (snapshots.length) {
      setHasta(snapshots[snapshots.length - 1].fecha)
      setDesde(snapshots[Math.max(0, snapshots.length - 2)].fecha)
    }
  }
  useEffect(() => { cargar() }, [])

  const medidaMeta = MEDIDAS.find((m) => m.key === medida)
  const fmt = medidaMeta.money ? fmtMoney : fmtNum

  const porFecha = useMemo(() => Object.fromEntries(snapshots.map((s) => [s.fecha, s.datos])), [snapshots])

  // Tabla comparativa: una fila por valor de la dimensión, presente en cualquiera
  // de las dos fechas (algo que apareció o desapareció también es un movimiento).
  const filas = useMemo(() => {
    const a = porFecha[desde]?.[dim] || {}
    const b = porFecha[hasta]?.[dim] || {}
    const nombres = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    return nombres
      .map((name) => {
        const va = a[name]?.[medida] || 0
        const vb = b[name]?.[medida] || 0
        const dif = vb - va
        return { name, va, vb, dif, variacion: va ? dif / va : null }
      })
      .sort((x, y) => y.vb - x.vb)
  }, [porFecha, desde, hasta, dim, medida])

  // Serie completa para el gráfico: una línea por valor de la dimensión
  const series = useMemo(() => {
    const nombres = new Set()
    for (const s of snapshots) for (const k of Object.keys(s.datos?.[dim] || {})) nombres.add(k)
    const claves = [...nombres].slice(0, 8) // más líneas que esto no se leen
    const data = snapshots.map((s) => {
      const fila = { name: s.fecha }
      for (const k of claves) fila[k] = s.datos?.[dim]?.[k]?.[medida] || 0
      return fila
    })
    return { claves, data }
  }, [snapshots, dim, medida])

  const archivarAhora = async () => {
    setEstado((e) => ({ ...e, guardando: true, error: '' }))
    try {
      await tomarSnapshot()
      await cargar()
    } catch (e) {
      setEstado((s) => ({ ...s, error: String(e.message || e) }))
    } finally {
      setEstado((s) => ({ ...s, guardando: false }))
    }
  }

  if (estado.cargando) return <div className="cfg__msg">Cargando histórico…</div>

  if (estado.sinHistorico) {
    return (
      <div className="cfg__aviso cfg__aviso--error">
        El histórico se guarda en la base de datos y el servidor está corriendo{' '}
        <strong>sin ninguna</strong> (falta <code>DATABASE_URL</code>), así que no se está
        archivando nada. Con la base de datos conectada se guarda una foto del pipeline por
        día, sola. Podés confirmarlo en <code>/api/health</code>: <code>authEnabled</code>{' '}
        tiene que decir <code>true</code>.
      </div>
    )
  }

  return (
    <div className="evol">
      {estado.error && <div className="login__error">{estado.error}</div>}

      {snapshots.length < 2 && (
        <div className="cfg__aviso">
          {snapshots.length === 0
            ? 'Todavía no hay fotos del pipeline. Se archiva una por día; vuelve mañana o archiva la de hoy.'
            : 'Solo hay una foto (la de hoy). La comparación necesita al menos dos días, así que esta vista se llena con el tiempo.'}
          {esAdmin && (
            <button className="cfg__link" onClick={archivarAhora} disabled={estado.guardando}>
              {estado.guardando ? 'archivando…' : 'Archivar la foto de hoy →'}
            </button>
          )}
        </div>
      )}

      <div className="evol__barra">
        <label className="evol__campo">
          <span>Agrupar por</span>
          <select value={dim} onChange={(e) => setDim(e.target.value)}>
            {DIMENSIONES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </label>
        <label className="evol__campo">
          <span>Medir</span>
          <select value={medida} onChange={(e) => setMedida(e.target.value)}>
            {MEDIDAS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="evol__campo">
          <span>Comparar</span>
          <select value={desde} onChange={(e) => setDesde(e.target.value)}>
            {snapshots.map((s) => <option key={s.fecha} value={s.fecha}>{fmtDate(s.fecha)}</option>)}
          </select>
        </label>
        <label className="evol__campo">
          <span>contra</span>
          <select value={hasta} onChange={(e) => setHasta(e.target.value)}>
            {snapshots.map((s) => <option key={s.fecha} value={s.fecha}>{fmtDate(s.fecha)}</option>)}
          </select>
        </label>
        <span className="evol__info">{snapshots.length} foto(s) archivada(s)</span>
      </div>

      <div className="tablewrap">
        <table className="ptable">
          <thead>
            <tr>
              <th>{DIMENSIONES.find((d) => d.key === dim).label}</th>
              <th>{desde ? fmtDate(desde) : '—'}</th>
              <th>{hasta ? fmtDate(hasta) : '—'}</th>
              <th>Diferencia</th>
              <th>Variación</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.name}>
                <td title={f.name}>{f.name}</td>
                <td>{fmt(f.va)}</td>
                <td>{fmt(f.vb)}</td>
                <td className={f.dif < 0 ? 'evol__neg' : f.dif > 0 ? 'evol__pos' : undefined}>
                  {f.dif > 0 ? '+' : ''}{fmt(f.dif)}
                </td>
                <td className={f.dif < 0 ? 'evol__neg' : f.dif > 0 ? 'evol__pos' : undefined}>
                  {f.variacion == null ? '—' : `${f.variacion > 0 ? '+' : ''}${(f.variacion * 100).toFixed(2)}%`}
                </td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={5} className="ptable__empty">Sin datos para esas fechas</td></tr>}
          </tbody>
        </table>
      </div>

      {snapshots.length >= 2 && (
        <div className="chart chart--wide" style={{ marginTop: 14 }}>
          <h3 className="chart__title">{medidaMeta.label} por {DIMENSIONES.find((d) => d.key === dim).label} en el tiempo</h3>
          <div className="chart__body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={series.data} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9fb3c8' }} />
                <YAxis width={52} tick={{ fontSize: 11, fill: '#9fb3c8' }}
                  tickFormatter={(v) => (medidaMeta.money ? fmtCompact(v).replace('$', '') : fmtNum(v))} />
                <Tooltip formatter={fmt} />
                <Legend />
                {series.claves.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
