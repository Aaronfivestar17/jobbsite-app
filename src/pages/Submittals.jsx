import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { today, fmtDate, uploadFile, openFile } from '../util'
import { Header, Empty } from '../components/ui'

const STATUSES = [
  ['pending', 'Pending review'],
  ['approved', 'Approved'],
  ['approved_as_noted', 'Approved as noted'],
  ['revise', 'Revise & resubmit'],
  ['rejected', 'Rejected'],
]
const label = (s) => STATUSES.find((x) => x[0] === s)?.[1] || s
const blank = { title: '', description: '', submitted_on: today(), status: 'pending' }

function SubmittalForm({ jobId, item, onDone }) {
  const [f, setF] = useState(item || blank)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      let file_path = f.file_path || null
      let file_name = f.file_name || null
      if (file) {
        const p = await uploadFile(`submittals/${jobId}`, file)
        if (file_path) await supabase.storage.from(BUCKET).remove([file_path])
        file_path = p
        file_name = file.name
      }
      const row = {
        job_id: jobId,
        title: f.title.trim(),
        description: f.description?.trim() || null,
        submitted_on: f.submitted_on || null,
        status: f.status,
        file_path,
        file_name,
      }
      const res = item ? await supabase.from('submittals').update(row).eq('id', item.id) : await supabase.from('submittals').insert(row)
      if (res.error) throw res.error
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete submittal "${item.title}"?`)) return
    if (item.file_path) await supabase.storage.from(BUCKET).remove([item.file_path])
    await supabase.from('submittals').delete().eq('id', item.id)
    onDone()
  }

  return (
    <form className="card form" onSubmit={save}>
      <label>
        Title
        <input value={f.title} onChange={set('title')} required placeholder="e.g. Window shop drawings" />
      </label>
      <div className="inline">
        <label className="grow">
          Date
          <input type="date" value={f.submitted_on || ''} onChange={set('submitted_on')} />
        </label>
        <label className="grow">
          Status
          <select value={f.status} onChange={set('status')}>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea rows="2" value={f.description || ''} onChange={set('description')} />
      </label>
      <label>
        {f.file_path ? 'Replace file' : 'File (PDF, photo or document)'}
        <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save submittal'}</button>
      {item && <button type="button" className="danger" onClick={remove}>Delete submittal</button>}
      <button type="button" onClick={() => onDone(false)}>Cancel</button>
    </form>
  )
}

export default function Submittals() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null) // 'new' | item

  const load = useCallback(async () => {
    const [j, s] = await Promise.all([
      supabase.from('jobs').select('name').eq('id', id).single(),
      supabase.from('submittals').select('*').eq('job_id', id).order('submitted_on', { ascending: false }),
    ])
    setJob(j.data)
    setItems(s.data || [])
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const done = () => {
    setEditing(null)
    load()
  }

  return (
    <>
      <Header title="Submittals" back action={!editing && <button className="link" onClick={() => setEditing('new')}>+ Add</button>} />
      {job && <p className="muted subhead">📁 {job.name}</p>}
      {editing === 'new' && <SubmittalForm jobId={id} onDone={done} />}
      {items.length ? (
        <ul className="list">
          {items.map((s) =>
            editing?.id === s.id ? (
              <li key={s.id} style={{ listStyle: 'none' }}>
                <SubmittalForm jobId={id} item={s} onDone={done} />
              </li>
            ) : (
              <li key={s.id} className="row" onClick={() => setEditing(s)}>
                <div className="thumb ph">📄</div>
                <div className="grow">
                  <div className="title">{s.title}</div>
                  <div className="muted small">{fmtDate(s.submitted_on)}</div>
                  {s.description && <div className="small clamp">{s.description}</div>}
                  {s.file_path && (
                    <button className="link small" onClick={(e) => { e.stopPropagation(); openFile(s.file_path) }}>
                      Open {s.file_name || 'file'}
                    </button>
                  )}
                </div>
                <span className={`pill pill-${s.status}`}>{label(s.status)}</span>
              </li>
            )
          )}
        </ul>
      ) : (
        editing !== 'new' && <Empty>No submittals yet. Tap “+ Add” to upload one.</Empty>
      )}
    </>
  )
}
