import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { sumBy, seriesMensual, mcbPorProducto, bookingPorLinea, stackPorProducto, LINEA_LABELS } from '../lib/aggregate'
import { fmtCompact, fmtMoney, fmtNum } from '../lib/format'

// Paleta basada en la marca InfoTrack (azules + grises + tintes derivados)
const COLORS = ['#0068ff', '#002149', '#00c6ff', '#4b5160', '#6b7480', '#3385ff', '#0a4f9e', '#5ad8ff', '#94a3b0', '#80b4ff', '#013a7a']
const LINEA_COLORS = { SUMHW: '#002149', HWAAS: '#0068ff', SVCS: '#00c6ff', SWTER: '#6b7480', SOLSS: '#3385ff' }

// Métricas seleccionables que aplican a todos los gráficos de dimensión.
// Grupo "Totales" (montos generales) + grupo "Detallado por producto".
const METRICS = [
  { key: 'bookingTotal', label: 'Booking Total', money: true, group: 'Totales' },
  { key: 'sensibilizado', label: 'Pipeline Sensibilizado', money: true, group: 'Totales' },
  { key: 'totalMCB', label: 'Total MCB', money: true, group: 'Totales' },
  { key: 'totalFacturacion', label: 'Total Facturación', money: true, group: 'Totales' },
  { key: 'totalMB', label: 'Total MB', money: true, group: 'Totales' },
  { key: '__count__', label: '# Oportunidades', money: false, group: 'Totales' },
  // Montos detallados por línea de producto ($ de cada línea)
  { key: 'sumhw', label: '$ SUMHW', money: true, group: 'Por producto' },
  { key: 'hwaas', label: '$ HWAAS', money: true, group: 'Por producto' },
  { key: 'svcs', label: '$ SVCS', money: true, group: 'Por producto' },
  { key: 'swter', label: '$ SWTER', money: true, group: 'Por producto' },
  { key: 'swss', label: '$ SOLSS', money: true, group: 'Por producto' },
]

// Dimensiones por las que graficamos
const DIMENSIONS = [
  { key: 'comercial', label: 'Comercial', layout: 'vertical', top: 12 },
  { key: 'fase', label: 'Fase', layout: 'vertical' },
  { key: 'lineaNegocio', label: 'Línea de Negocio', layout: 'vertical' },
  { key: 'aliado', label: 'Aliado', layout: 'vertical', top: 12 },
  { key: 'kare', label: 'KARE', layout: 'vertical' },
  { key: 'arquitecto', label: 'Arquitecto', layout: 'vertical' },
  { key: 'probabilidadCierre', label: 'Probabilidad de Cierre', layout: 'vertical' },
  { key: 'tiempoContrato', label: 'Tiempo de Contrato', layout: 'vertical' },
  { key: 'areaNegocio', label: 'Área de Negocio', layout: 'vertical' },
  { key: 'fuenteLead', label: 'Fuente de Lead', layout: 'pie' },
  { key: 'pais', label: 'País', layout: 'pie' },
  { key: 'empresaInterna', label: 'Empresa Interna', layout: 'pie' },
  { key: 'tipoVenta', label: 'Tipo Venta (Nuevo/Renovación)', layout: 'pie' },
  { key: 'venta', label: 'Venta (Transaccional/Recurrente)', layout: 'pie' },
  { key: 'estado', label: 'Estado', layout: 'pie' },
]

function Card({ title, wide, children }) {
  return (
    <div className={'chart' + (wide ? ' chart--wide' : '')}>
      <h3 className="chart__title">{title}</h3>
      <div className="chart__body">
        <ResponsiveContainer width="100%" height={wide ? 280 : 260}>{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Charts({ rows }) {
  const [metricKey, setMetricKey] = useState('bookingTotal')
  const metric = METRICS.find((m) => m.key === metricKey)
  const fmt = metric.money ? fmtMoney : fmtNum
  const axisFmt = metric.money ? (v) => fmtCompact(v).replace('$', '') : fmtNum

  const mensual = useMemo(() => seriesMensual(rows), [rows])
  const mcb = useMemo(() => mcbPorProducto(rows), [rows])
  const bookingLinea = useMemo(() => bookingPorLinea(rows), [rows])
  const stackComercial = useMemo(() => stackPorProducto(rows, 'comercial', { top: 10 }), [rows])

  const groups = ['Totales', 'Por producto']

  return (
    <div>
      <div className="metricbar">
        <span className="metricbar__label">Métrica:</span>
        {groups.map((g) => (
          <span className="metricbar__group" key={g}>
            <span className="metricbar__grouplabel">{g}:</span>
            {METRICS.filter((m) => m.group === g).map((m) => (
              <button
                key={m.key}
                className={'metricbar__btn' + (m.key === metricKey ? ' metricbar__btn--active' : '')}
                onClick={() => setMetricKey(m.key)}
              >
                {m.label}
              </button>
            ))}
          </span>
        ))}
      </div>

      <section className="charts">
        {/* Composición detallada: las 5 líneas de producto apiladas por comercial */}
        <Card title="Booking detallado por producto y comercial" wide>
          <BarChart data={stackComercial} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9fb3c8" }} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis tickFormatter={(v) => fmtCompact(v).replace('$', '')} tick={{ fontSize: 11, fill: "#9fb3c8" }} width={48} />
            <Tooltip formatter={fmtMoney} />
            <Legend />
            {LINEA_LABELS.map((l) => (
              <Bar key={l} dataKey={l} stackId="p" fill={LINEA_COLORS[l]} />
            ))}
          </BarChart>
        </Card>

        {/* Series temporales (siempre en dinero) */}
        <Card title="Facturación proyectada por mes (2026)" wide>
          <AreaChart data={mensual} margin={{ left: 10, right: 10 }}>
            <defs>
              <linearGradient id="gFact" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0068ff" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#0068ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c6ff" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00c6ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9fb3c8" }} />
            <YAxis tickFormatter={(v) => fmtCompact(v).replace('$', '')} tick={{ fontSize: 11, fill: "#9fb3c8" }} width={48} />
            <Tooltip formatter={fmtMoney} />
            <Legend />
            <Area type="monotone" dataKey="facturacion" name="Facturación" stroke="#0068ff" fill="url(#gFact)" strokeWidth={2} />
            <Area type="monotone" dataKey="mb" name="Margen Bruto" stroke="#00c6ff" fill="url(#gMb)" strokeWidth={2} />
          </AreaChart>
        </Card>

        {/* Total de Booking por línea de producto */}
        <Card title="Booking total por línea de producto">
          <BarChart data={bookingLinea} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9fb3c8" }} />
            <YAxis tickFormatter={(v) => fmtCompact(v).replace('$', '')} tick={{ fontSize: 11, fill: "#9fb3c8" }} width={48} />
            <Tooltip formatter={fmtMoney} />
            <Bar dataKey="value" name="Booking" radius={[4, 4, 0, 0]}>
              {bookingLinea.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </Card>

        {/* MCB por producto (siempre en dinero) */}
        <Card title="MCB por línea de producto">
          <BarChart data={mcb} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9fb3c8" }} />
            <YAxis tickFormatter={(v) => fmtCompact(v).replace('$', '')} tick={{ fontSize: 11, fill: "#9fb3c8" }} width={48} />
            <Tooltip formatter={fmtMoney} />
            <Bar dataKey="value" name="MCB" radius={[4, 4, 0, 0]}>
              {mcb.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </Card>

        {/* Un gráfico por dimensión, con la métrica seleccionada */}
        {DIMENSIONS.map((dim) => {
          const data = sumBy(rows, dim.key, metricKey, { top: dim.top || null })
          const title = `${metric.label} por ${dim.label}`
          if (dim.layout === 'pie') {
            return (
              <Card title={title} key={dim.key}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88}
                    label={(e) => (metric.money ? fmtCompact(e.value) : fmtNum(e.value))}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={fmt} />
                  <Legend />
                </PieChart>
              </Card>
            )
          }
          return (
            <Card title={title} key={dim.key}>
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.09)" />
                <XAxis type="number" tickFormatter={axisFmt} tick={{ fontSize: 11, fill: "#9fb3c8" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#9fb3c8" }} width={150} />
                <Tooltip formatter={fmt} />
                <Bar dataKey="value" name={metric.label} fill={COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
