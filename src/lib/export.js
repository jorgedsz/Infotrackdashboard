// Exportación de la tabla a CSV, XLSX y PDF.
// Las librerías pesadas (xlsx, jspdf) se cargan dinámicamente solo al exportar.
import { fmtDate, fmtMoney, fmtNum } from './format'

// Columnas clave para el PDF (un reporte legible, no el volcado completo)
const PDF_KEYS = ['comercial', 'empresa', 'pais', 'estado', 'fase', 'lineaNegocio', 'bookingTotal', 'probabilidad', 'sensibilizado']

// Valor "crudo" para exportar: números como números, fechas legibles, texto plano.
function exportValue(col, row) {
  const v = row[col.key]
  if (col.type === 'money' || col.type === 'num' || col.type === 'pctraw') return v == null ? 0 : v
  if (col.type === 'pct') return v == null ? 0 : v
  if (col.type === 'date') return v ? fmtDate(v) : ''
  return v == null ? '' : String(v)
}

const stamp = () => new Date().toISOString().slice(0, 10)

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// --- CSV (sin dependencias) ---
export function exportCSV(rows, columns, base = 'pipeline') {
  const esc = (val) => {
    const s = String(val ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(exportValue(c, r))).join(',')).join('\n')
  const csv = '﻿' + header + '\n' + body // BOM para acentos en Excel
  download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${base}-${stamp()}.csv`)
}

// --- XLSX (SheetJS) ---
export async function exportXLSX(rows, columns, base = 'pipeline') {
  const XLSX = await import('xlsx')
  const aoa = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => exportValue(c, r)))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map((c) => ({ wch: Math.min(28, Math.max(10, c.label.length + 2)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline')
  XLSX.writeFile(wb, `${base}-${stamp()}.xlsx`)
}

// Carga el logo como dataURL (para incrustarlo en el PDF)
async function loadLogo() {
  try {
    const res = await fetch('/logo-infotrack.png')
    const blob = await res.blob()
    return await new Promise((r) => {
      const fr = new FileReader()
      fr.onload = () => r(fr.result)
      fr.onerror = () => r(null)
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

const cell = (col, row) => {
  const v = row[col.key]
  if (col.type === 'money') return fmtMoney(v)
  if (col.type === 'num') return fmtNum(v)
  if (col.type === 'pct') return v == null ? '' : `${Math.round(v * 100)}%`
  if (col.type === 'date') return v ? fmtDate(v) : ''
  return v == null ? '' : String(v)
}

// --- PDF: reporte limpio con logo, resumen y columnas clave ---
export async function exportPDF(rows, allColumns, base = 'pipeline') {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Columnas clave (en orden); si no hay match (otro pipeline), usa las primeras disponibles
  const byKey = Object.fromEntries(allColumns.map((c) => [c.key, c]))
  let cols = PDF_KEYS.map((k) => byKey[k]).filter(Boolean)
  if (cols.length === 0) cols = allColumns.slice(0, 10)

  // Encabezado: logo + título
  const logo = await loadLogo()
  if (logo) {
    try {
      const p = doc.getImageProperties(logo)
      const h = 30, w = (p.width / p.height) * h
      doc.addImage(logo, 'PNG', 40, 26, w, h)
    } catch { /* sin logo */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0, 33, 73)
  doc.text('Pipeline Total', pageW - 40, 40, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 116, 128)
  doc.text(new Date().toLocaleString('es-CO'), pageW - 40, 56, { align: 'right' })

  // Resumen de totales
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0)
  doc.setDrawColor(226, 232, 240); doc.line(40, 70, pageW - 40, 70)
  doc.setFontSize(10); doc.setTextColor(0, 33, 73)
  const resumen = [
    `Oportunidades: ${fmtNum(rows.length)}`,
    `Booking: ${fmtMoney(sum('bookingTotal'))}`,
    `Sensibilizado: ${fmtMoney(sum('sensibilizado'))}`,
    `Facturación: ${fmtMoney(sum('totalFacturacion'))}`,
  ]
  doc.text(resumen.join('     |     '), 40, 86)

  // Estilos por columna: números a la derecha
  const columnStyles = {}
  cols.forEach((c, i) => {
    if (c.type === 'money' || c.type === 'num' || c.type === 'pct') columnStyles[i] = { halign: 'right' }
  })

  autoTable(doc, {
    startY: 98,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => cell(c, r))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'ellipsize', lineColor: [230, 235, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [0, 33, 73], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 248, 251] },
    columnStyles,
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const page = doc.internal.getNumberOfPages()
      doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`Página ${data.pageNumber} de ${page}`, pageW - 40, doc.internal.pageSize.getHeight() - 16, { align: 'right' })
      doc.text('InfoTrack Dashboard', 40, doc.internal.pageSize.getHeight() - 16)
    },
  })

  doc.save(`${base}-${stamp()}.pdf`)
}
