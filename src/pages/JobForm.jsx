import { useState } from 'react'
import { supabase } from '../supabase'

const blank = { name: '', client_name: '', client_email: '', client_phone: '', address: '', status: 'active', notes: '' }

export default function JobForm({ job, onSaved, onDelete }) {
  const [f, setF] = useState({ ...blank, ...(job || {}) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const row = {
      name: f.name.trim(),
      client_name: f.client_name || null,
      client_email: f.client_email || null,
      client_phone: f.client_phone || null,
      address: f.address || null,
      status: f.status,
      notes: f.notes || null,
    }
    const res = job
      ? await supabase.from('jobs').update(row).eq('id', job.id).select().single()
      : await supabase.from('jobs').insert(row).select().single()
    setBusy(false)
    if (res.error) return alert(res.error.message)
    onSaved?.(res.data)
  }

  return (
    <form className="card form" onSubmit={save}>
      <label>
        Project name
        <input value={f.name} onChange={set('name')} required placeholder="e.g. Smith kitchen remodel" />
      </label>
      <label>
        Client
        <input value={f.client_name || ''} onChange={set('client_name')} />
      </label>
      <div className="inline">
        <label className="grow">
          Phone
          <input type="tel" value={f.client_phone || ''} onChange={set('client_phone')} />
        </label>
        <label className="grow">
          Email
          <input type="email" value={f.client_email || ''} onChange={set('client_email')} />
        </label>
      </div>
      <label>
        Site address
        <input value={f.address || ''} onChange={set('address')} />
      </label>
      <label>
        Status
        <select value={f.status} onChange={set('status')}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        Notes
        <textarea rows="3" value={f.notes || ''} onChange={set('notes')} />
      </label>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save project'}</button>
      {onDelete && (
        <button type="button" className="danger" onClick={onDelete}>
          Delete project
        </button>
      )}
    </form>
  )
}
