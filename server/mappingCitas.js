// Mapea las CITAS (appointments de GHL) de las oportunidades que están en la
// etapa "Cita Agendada" del pipeline de Llamadas IA.
//
// Granularidad: UNA FILA POR CITA. Un contacto que agendó tres veces produce
// tres filas, para poder contar citas reales y no oportunidades.

// GHL devuelve las fechas como "YYYY-MM-DD HH:mm:ss" en la zona de la location.
const parseFecha = (v) => {
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  return m ? { fecha: m[1], hora: `${m[2]}:${m[3]}` } : { fecha: null, hora: '' }
}

const minutosEntre = (ini, fin) => {
  const t = (v) => {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null
  }
  const a = t(ini), b = t(fin)
  return a != null && b != null && b > a ? Math.round((b - a) / 60000) : null
}

// El estado que trae la API viene en inglés; lo mostramos en español.
const ESTADO_CITA = {
  confirmed: 'Confirmada',
  showed: 'Asistió',
  noshow: 'No asistió',
  cancelled: 'Cancelada',
  invalid: 'Inválida',
  new: 'Nueva',
}

// ctx: { calendarById, userById, stageById, agenteById }
export function mapCita(cita, opp, ctx) {
  const c = opp.contact || {}
  const inicio = parseFecha(cita.startTime)
  const agendada = parseFecha(cita.dateAdded)
  const estadoRaw = cita.appointmentStatus || cita.appoinmentStatus || '' // la API trae ambas grafías
  return {
    agente: ctx.agenteById?.[opp.pipelineId] || '',
    contacto: c.name || opp.name || '',
    empresa: c.companyName || '',
    email: c.email || '',
    telefono: c.phone || '',
    etapa: ctx.stageById?.[opp.pipelineStageId] || '',
    asignadoOportunidad: ctx.userById?.[opp.assignedTo] || '',
    fechaCita: inicio.fecha,
    horaCita: inicio.hora,
    estadoCita: ESTADO_CITA[estadoRaw] || estadoRaw || '',
    calendario: ctx.calendarById?.[cita.calendarId] || '',
    asignadoCita: ctx.userById?.[cita.assignedUserId] || '',
    fechaAgendada: agendada.fecha,
    duracionMin: minutosEntre(cita.startTime, cita.endTime),
    // `address` trae el enlace de la reunión cuando el calendario es virtual
    modalidad: /^https?:\/\//i.test(cita.address || '') ? 'Virtual' : 'Sin enlace',
    titulo: cita.title || '',
  }
}

// Expande [{opp, citas}] a una fila por cita, descartando las borradas.
export function mapAllCitas(pares, ctx) {
  const out = []
  for (const { opp, citas } of pares) {
    for (const cita of citas) {
      if (cita.deleted) continue
      out.push(mapCita(cita, opp, ctx))
    }
  }
  // Más recientes primero
  return out.sort((a, b) => String(b.fechaCita || '').localeCompare(String(a.fechaCita || '')))
}
