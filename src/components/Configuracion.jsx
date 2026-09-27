import { useState } from 'react'
import PipelinesConfig from './PipelinesConfig'
import TablasCalculo from './TablasCalculo'

// Configuración de admin, en dos partes: qué pipelines se leen y con qué tablas
// se calcula. `onSaved` avisa al dashboard para que recargue data y tablas.
const SECCIONES = [
  { key: 'pipelines', label: 'Pipelines' },
  { key: 'tablas', label: 'Tablas de cálculo' },
]

export default function Configuracion({ onSaved }) {
  const [sec, setSec] = useState('pipelines')
  return (
    <div>
      <nav className="tabs tabs--sub">
        {SECCIONES.map((s) => (
          <button key={s.key} className={'tab' + (sec === s.key ? ' tab--active' : '')}
            onClick={() => setSec(s.key)}>
            {s.label}
          </button>
        ))}
      </nav>
      {sec === 'pipelines' ? <PipelinesConfig onSaved={onSaved} /> : <TablasCalculo onSaved={onSaved} />}
    </div>
  )
}
