import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { today, fmtDate, uploadFile, openFile } from '../util'
import { Header, Empty } from '../components/ui'

const blank = { title: '', description: '', doc_date: today() }

function DocForm({ jobId, item, onDone }) {
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
        const p = await uploadFile(`documents/${jobId}`, file)
        if (file_path) await supabase.storage.from(BUCKET).remove([file_path])
        file_path = p
        file_name = file.name
      }
      const row = {
        job_id: jobId,
        title: f.title.trim(),
        description: f.description?.trim() || null,
        doc_date: f.doc_date || null,
        file_path,
        file_name,
      }
      const res = item ? await supabase.from('documents').update(row).eq('id', item.id) : await supabase.from('documents').insert(row)
      if (res.error) throw res.error
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete "${item.title}"?`)) return
    if (item.file_path) await supabase.storage.from(BUCKET).remove([item.file_path])
    await supabase.from('documents').delete().eq('id', item.id)
    onDone()
  }

  return (
    <form className="card form" onSubmit={save}>
      <label>
        Title
        <input value={f.title} onChange={set('title')} required placeholder="e.g. Permit, contract, change order" />
      </label>
      <label>
        Date
        <input type="date" value={f.doc_date || ''} onChange={set('doc_date')} />
      </label>
      <label>
        Description
        <textarea rows="2" value={f.description || ''} onChange={set('description')} placeholder="Optional" />
      </label>
      <label>
        {f.file_path ? 'Replace file' : 'File (PDF, photo or document)'}
        <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save document'}</button>
      {item && <button type="button" className="danger" onClick={remove}>Delete document</button>}
      <button type="button" onClick={onDone}>Cancel</button>
    </form>
  )
}

export default function Documents() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [j, d] = await Promise.all([
      supabase.from('jobs').select('name').eq('id', id).single(),
      supabase.from('documents').select('*').eq('job_id', id).order('doc_date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setJob(j.data)
    setItems(d.data || [])
    setError(d.error ? d.error.message : '')
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
      <Header title="Supporting docs" back action={!editing && <button className="link" onClick={() => setEditing('new')}>+ Add</button>} />
      {job && <p className="muted subhead">🗂️ {job.name}</p>}
      {error && <p className="error">{error}</p>}
      {editing === 'new' && <DocForm jobId={id} onDone={done} />}
      {items.length ? (
        <ul className="list">
          {items.map((d) =>
            editing?.id === d.id ? (
              <li key={d.id} style={{ listStyle: 'none' }}>
                <DocForm jobId={id} item={d} onDone={done} />
              </li>
            ) : (
              <li key={d.id} className="row" onClick={() => setEditing(d)}>
                <div className="thumb ph">📄</div>
                <div className="grow">
                  <div className="title">{d.title}</div>
                  <div className="muted small">{fmtDate(d.doc_date)}</div>
                  {d.description && <div className="small clamp">{d.description}</div>}
                  {d.file_path && (
                    <button className="link small" onClick={(e) => { e.stopPropagation(); openFile(d.file_path) }}>
                      Open {d.file_name || 'file'}
                    </button>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      ) : (
        editing !== 'new' && !error && <Empty>No documents yet. Tap “+ Add” to upload one.</Empty>
      )}
    </>
  )
}
