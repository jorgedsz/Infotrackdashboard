import { useEffect, useState } from 'react'
import { apiFetch } from '../services/http'
import MultiSelect from './MultiSelect'

const emptyForm = () => ({ name: '', email: '', password: '', role: 'user', view_all: true, comerciales: [] })

export default function UsersAdmin() {
  const [users, setUsers] = useState([])
  const [comerciales, setComerciales] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null) // id en edición o null
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [u, c] = await Promise.all([apiFetch('/api/users'), apiFetch('/api/comerciales')])
      setUsers(u.users)
      setComerciales(c.comerciales || [])
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  const reset = () => { setForm(emptyForm()); setEditing(null); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      if (editing) {
        await apiFetch(`/api/users/${editing}`, { method: 'PATCH', body: form })
      } else {
        await apiFetch('/api/users', { method: 'POST', body: form })
      }
      reset()
      await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const startEdit = (u) => {
    setEditing(u.id)
    setForm({ name: u.name || '', email: u.email, password: '', role: u.role, view_all: u.view_all, comerciales: u.comerciales || [] })
    setError('')
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try { await apiFetch(`/api/users/${id}`, { method: 'DELETE' }); await load() } catch (e) { setError(e.message) }
  }

  return (
    <div className="usersadmin">
      <form className="cmbuilder" onSubmit={submit}>
        <span className="cmbuilder__label">{editing ? 'Editar usuario' : 'Crear nuevo usuario'}</span>
        <div className="cmbuilder__row">
          <label className="cmfield"><span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" /></label>
          <label className="cmfield"><span>Correo</span>
            <input type="email" value={form.email} disabled={!!editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@infotrack.com" required /></label>
          <label className="cmfield"><span>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? 'dejar vacío = no cambiar' : 'mín. 6 caracteres'} required={!editing} /></label>
          <label className="cmfield"><span>Rol</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select></label>
        </div>

        <div className="cmbuilder__row">
          <label className="cmfield"><span>Alcance de datos</span>
            <select value={form.view_all ? 'all' : 'own'} onChange={(e) => setForm({ ...form, view_all: e.target.value === 'all' })}>
              <option value="all">Puede ver todo</option>
              <option value="own">Solo lo asignado a su comercial</option>
            </select></label>
          {!form.view_all && (
            <label className="cmfield"><span>Comerciales asignados ({form.comerciales.length})</span>
              <MultiSelect
                label="Selecciona comerciales"
                options={comerciales}
                value={new Set(form.comerciales)}
                onChange={(set) => setForm({ ...form, comerciales: [...set] })}
              />
            </label>
          )}
        </div>

        {error && <div className="login__error">{error}</div>}
        <div className="cmbuilder__footer">
          <button className="cmbtn cmbtn--primary" type="submit" disabled={busy}>
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          {editing && <button type="button" className="cmbtn" onClick={reset}>Cancelar</button>}
        </div>
      </form>

      <div className="tablewrap" style={{ marginTop: 14 }}>
        <table className="ptable">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alcance</th><th>Comerciales</th><th>Creado</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.role === 'admin' || u.view_all ? 'Todo' : 'Solo asignado'}</td>
                <td>{(u.comerciales && u.comerciales.length) ? u.comerciales.join(', ') : '—'}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => startEdit(u)} title="Editar" style={{ cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 15 }}>✎</button>
                  <button onClick={() => remove(u.id)} title="Eliminar" style={{ cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 15 }}>🗑</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="ptable__empty">Sin usuarios</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
