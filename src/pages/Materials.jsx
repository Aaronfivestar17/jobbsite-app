import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { today, fmtDate, money } from '../util'
import { Header, Empty } from '../components/ui'

const blank = { item: '', quantity: '', supplier: '', ordered_on: today(), cost: '', notes: '', delivered: false }

function MaterialForm({ jobId, item, onDone }) {
  const [f, setF] = useState(item || blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const row = {
      job_id: jobId,
      item: f.item.trim(),
      quantity: f.quantity?.trim() || null,
      supplier: f.supplier?.trim() || null,
      ordered_on: f.ordered_on || null,
      cost: f.cost === '' || f.cost == null ? null : Number(f.cost),
      notes: f.notes?.trim() || null,
      delivered: f.delivered,
    }
    const res = item ? await supabase.from('materials').update(row).eq('id', item.id) : await supabase.from('materials').insert(row)
    setBusy(false)
    if (res.error) return alert(res.error.message)
    onDone()
  }

  async function remove() {
    if (!confirm(`Delete "${item.item}"?`)) return
    await supabase.from('materials').delete().eq('id', item.id)
    onDone()
  }

  return (
    <form className="card form" onSubmit={save}>
      <label>
        Material
        <input value={f.item} onChange={set('item')} required placeholder="e.g. 2x4x8 studs" />
      </label>
      <div className="inline">
        <label className="grow">
          Quantity
          <input value={f.quantity || ''} onChange={set('quantity')} placeholder="e.g. 120" />
        </label>
        <label className="grow">
          Cost ($)
          <input type="number" inputMode="decimal" step="0.01" min="0" value={f.cost ?? ''} onChange={set('cost')} placeholder="0.00" />
        </label>
      </div>
      <div className="inline">
        <label className="grow">
          Supplier
          <input value={f.supplier || ''} onChange={set('supplier')} />
        </label>
        <label className="grow">
          Date ordered
          <input type="date" value={f.ordered_on || ''} onChange={set('ordered_on')} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows="2" value={f.notes || ''} onChange={set('notes')} placeholder="Optional" />
      </label>
      <label className="inline" style={{ color: 'var(--text)' }}>
        <input type="checkbox" checked={f.delivered} onChange={(e) => setF({ ...f, delivered: e.target.checked })} style={{ width: 22, height: 22 }} />
        Delivered
      </label>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {item && <button type="button" className="danger" onClick={remove}>Delete</button>}
      <button type="button" onClick={onDone}>Cancel</button>
    </form>
  )
}

export default function Materials() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [j, m] = await Promise.all([
      supabase.from('jobs').select('name').eq('id', id).single(),
      supabase.from('materials').select('*').eq('job_id', id).order('ordered_on', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setJob(j.data)
    setItems(m.data || [])
    setError(m.error ? m.error.message : '')
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const done = () => {
    setEditing(null)
    load()
  }

  async function toggleDelivered(m, e) {
    e.stopPropagation()
    setItems(items.map((x) => (x.id === m.id ? { ...x, delivered: !x.delivered } : x)))
    await supabase.from('materials').update({ delivered: !m.delivered }).eq('id', m.id)
  }

  const total = items.reduce((s, m) => s + Number(m.cost || 0), 0)
  const waiting = items.filter((m) => !m.delivered).length

  return (
    <>
      <Header title="Materials ordered" back action={!editing && <button className="link" onClick={() => setEditing('new')}>+ Add</button>} />
      {job && <p className="muted subhead">🧱 {job.name}</p>}
      {error && <p className="error">{error}</p>}
      {items.length > 0 && (
        <div className="card total-bar">
          <span className="muted">{items.length} order{items.length === 1 ? '' : 's'} · {waiting} not delivered</span>
          <span className="big">{money(total)}</span>
        </div>
      )}
      {editing === 'new' && <MaterialForm jobId={id} onDone={done} />}
      {items.length ? (
        <ul className="list">
          {items.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} style={{ listStyle: 'none' }}>
                <MaterialForm jobId={id} item={m} onDone={done} />
              </li>
            ) : (
              <li key={m.id} className="row" onClick={() => setEditing(m)}>
                <div className="grow">
                  <div className="title">
                    {m.item}
                    {m.quantity ? <span className="muted"> × {m.quantity}</span> : ''}
                  </div>
                  <div className="muted small">{[m.supplier, fmtDate(m.ordered_on)].filter(Boolean).join(' · ')}</div>
                  {m.notes && <div className="small clamp">{m.notes}</div>}
                </div>
                <div className="right-col">
                  {m.cost != null && <div className="title">{money(m.cost)}</div>}
                  <button className="small" onClick={(e) => toggleDelivered(m, e)}>
                    {m.delivered ? '✓ Delivered' : 'Ordered'}
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      ) : (
        editing !== 'new' && !error && <Empty>Nothing ordered yet. Tap “+ Add” to log an order.</Empty>
      )}
    </>
  )
}
