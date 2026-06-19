import { MESES } from './calc'

// Agrupa filas por una dimensión y suma una métrica. Devuelve [{name, value}] ordenado desc.
// valueKey === '__count__' cuenta oportunidades en vez de sumar.
export function sumBy(rows, dimKey, valueKey, { top = null } = {}) {
  const map = new Map()
  for (const r of rows) {
    const k = r[dimKey] === '' || r[dimKey] == null ? '(sin dato)' : r[dimKey]
    const add = valueKey === '__count__' ? 1 : (r[valueKey] || 0)
    map.set(k, (map.get(k) || 0) + add)
  }
  let arr = [...map.entries()].map(([name, value]) => ({ name, value }))
  arr.sort((a, b) => b.value - a.value)
  if (top && arr.length > top) {
    const head = arr.slice(0, top)
    const rest = arr.slice(top).reduce((a, x) => a + x.value, 0)
    if (rest > 0) head.push({ name: 'Otros', value: rest })
    arr = head
  }
  return arr
}

// Igual pero con dos métricas (p.ej. booking + sensibilizado) por dimensión.
export function sumBy2(rows, dimKey, vA, vB, { top = null } = {}) {
  const map = new Map()
  for (const r of rows) {
    const k = r[dimKey] === '' || r[dimKey] == null ? '(sin dato)' : r[dimKey]
    const cur = map.get(k) || { a: 0, b: 0 }
    cur.a += r[vA] || 0
    cur.b += r[vB] || 0
    map.set(k, cur)
  }
  let arr = [...map.entries()].map(([name, v]) => ({ name, a: v.a, b: v.b }))
  arr.sort((x, y) => y.a - x.a)
  if (top && arr.length > top) {
    const head = arr.slice(0, top)
    const rest = arr.slice(top).reduce((acc, x) => ({ a: acc.a + x.a, b: acc.b + x.b }), { a: 0, b: 0 })
    head.push({ name: 'Otros', ...rest })
    arr = head
  }
  return arr
}

// Suma facturación y MB mes a mes (Ene..Dic) sobre todas las filas.
export function seriesMensual(rows) {
  const fac = new Array(12).fill(0)
  const mb = new Array(12).fill(0)
  for (const r of rows) {
    const f = r.facturacion || []
    const m = r.mb || []
    for (let i = 0; i < 12; i++) {
      fac[i] += f[i] || 0
      mb[i] += m[i] || 0
    }
  }
  return MESES.map((mes, i) => ({ name: mes, facturacion: fac[i], mb: mb[i] }))
}

// Composición apilada: por cada valor de la dimensión, el $ de cada línea de producto.
const LINEAS = [
  { key: 'sumhw', label: 'SUMHW' },
  { key: 'hwaas', label: 'HWAAS' },
  { key: 'svcs', label: 'SVCS' },
  { key: 'swter', label: 'SWTER' },
  { key: 'swss', label: 'SOLSS' },
]
export const LINEA_LABELS = LINEAS.map((l) => l.label)

export function stackPorProducto(rows, dimKey, { top = 10 } = {}) {
  const map = new Map()
  for (const r of rows) {
    const k = r[dimKey] === '' || r[dimKey] == null ? '(sin dato)' : r[dimKey]
    const cur = map.get(k) || { name: k, _total: 0, SUMHW: 0, HWAAS: 0, SVCS: 0, SWTER: 0, SOLSS: 0 }
    for (const l of LINEAS) {
      const v = r[l.key] || 0
      cur[l.label] += v
      cur._total += v
    }
    map.set(k, cur)
  }
  let arr = [...map.values()].sort((a, b) => b._total - a._total)
  if (top && arr.length > top) arr = arr.slice(0, top)
  return arr
}

// Total de Booking ($) por línea de producto.
export function bookingPorLinea(rows) {
  const acc = { sumhw: 0, hwaas: 0, svcs: 0, swter: 0, swss: 0 }
  for (const r of rows) for (const k of Object.keys(acc)) acc[k] += r[k] || 0
  const label = { sumhw: 'SUMHW', hwaas: 'HWAAS', svcs: 'SVCS', swter: 'SWTER', swss: 'SOLSS' }
  return Object.entries(acc).map(([k, v]) => ({ name: label[k], value: v }))
}

// Desglose de MCB por línea de producto.
export function mcbPorProducto(rows) {
  const acc = { sumhw: 0, hwaas: 0, svcs: 0, swter: 0, swss: 0 }
  for (const r of rows) {
    const m = r.mcb || {}
    for (const k of Object.keys(acc)) acc[k] += m[k] || 0
  }
  const label = { sumhw: 'SUMHW', hwaas: 'HWAAS', svcs: 'SVCS', swter: 'SWTER', swss: 'SOLSS' }
  return Object.entries(acc).map(([k, v]) => ({ name: label[k], value: v }))
}
