// Columnas del dashboard del pipeline "Llamadas IA".
export const COLUMNS_IA = [
  { key: 'contacto', label: 'Contacto', type: 'text', filter: 'search' },
  { key: 'empresa', label: 'Empresa', type: 'text', filter: 'search' },
  { key: 'email', label: 'Email', type: 'text', filter: null },
  { key: 'telefono', label: 'Teléfono', type: 'text', filter: null },
  { key: 'estado', label: 'Estado', type: 'text', filter: 'category' },
  { key: 'etapa', label: 'Etapa', type: 'text', filter: 'category' },
  { key: 'asignado', label: 'Asignado', type: 'text', filter: 'category' },
  { key: 'fuente', label: 'Fuente', type: 'text', filter: 'category' },
  { key: 'fechaCreacion', label: 'F. Creación', type: 'date', filter: null },
  { key: 'fechaUltimaEtapa', label: 'Últ. cambio etapa', type: 'date', filter: null },
]

export const FILTER_COLUMNS_IA = COLUMNS_IA.filter((c) => c.filter === 'category')
