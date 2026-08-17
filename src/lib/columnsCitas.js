// Columnas del dataset de CITAS (una fila por cita agendada).
export const COLUMNS_CITAS = [
  { key: 'contacto', label: 'Contacto', type: 'text', filter: 'search' },
  { key: 'empresa', label: 'Empresa', type: 'text', filter: 'search' },
  { key: 'telefono', label: 'Teléfono', type: 'text', filter: null },
  { key: 'fechaCita', label: 'F. Cita', type: 'date', filter: null },
  { key: 'horaCita', label: 'Hora', type: 'text', filter: null },
  { key: 'estadoCita', label: 'Estado cita', type: 'text', filter: 'category' },
  { key: 'calendario', label: 'Calendario', type: 'text', filter: 'category' },
  { key: 'asignadoCita', label: 'Asignado cita', type: 'text', filter: 'category' },
  { key: 'modalidad', label: 'Modalidad', type: 'text', filter: 'category' },
  { key: 'duracionMin', label: 'Duración (min)', type: 'num', filter: null },
  { key: 'etapa', label: 'Etapa', type: 'text', filter: 'category' },
  { key: 'asignadoOportunidad', label: 'Asignado oport.', type: 'text', filter: 'category' },
  { key: 'fechaAgendada', label: 'F. Agendamiento', type: 'date', filter: null },
]

export const FILTER_COLUMNS_CITAS = COLUMNS_CITAS.filter((c) => c.filter === 'category')

// Rangos de fecha disponibles para condicionar métricas de citas
export const DATE_FIELDS_CITAS = [
  { key: 'fechaCita', label: 'Fecha de la cita' },
  { key: 'fechaAgendada', label: 'Fecha de agendamiento' },
]
