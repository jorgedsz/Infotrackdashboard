// Mapea una oportunidad del pipeline "Llamadas IA" a una fila para el dashboard IA.
// La data útil viene del propio opportunity + el contacto (resumen) + catálogos.

const ESTADO = { open: 'Abierto', won: 'Ganada', lost: 'Perdida', abandoned: 'Abandonada' }

const toISO = (v) => {
  if (v == null || v === '') return null
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v))
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

// ctx: { stageById, userById }
export function mapIA(opp, ctx) {
  const c = opp.contact || {}
  return {
    contacto: c.name || opp.name || '',
    empresa: c.companyName || '',
    email: c.email || '',
    telefono: c.phone || '',
    estado: ESTADO[opp.status] || opp.status || '',
    etapa: ctx.stageById?.[opp.pipelineStageId] || '',
    asignado: ctx.userById?.[opp.assignedTo] || '',
    fuente: opp.source || '',
    fechaCreacion: toISO(opp.createdAt),
    fechaUltimaEtapa: toISO(opp.lastStageChangeAt),
    fechaUltimoEstado: toISO(opp.lastStatusChangeAt),
  }
}

export const mapAllIA = (opps, ctx) => opps.map((o) => mapIA(o, ctx))
