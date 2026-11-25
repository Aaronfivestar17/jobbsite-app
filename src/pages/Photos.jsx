import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { today, fmtDate, uploadFile, signedUrls } from '../util'
import { Header, Empty } from '../components/ui'

const longDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function Uploader({ jobId, files, onCancel, onDone }) {
  const [date, setDate] = useState(today())
  const [descs, setDescs] = useState(files.map(() => ''))
  const [progress, setProgress] = useState('')
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])

  async function save(e) {
    e.preventDefault()
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading ${i + 1} of ${files.length}…`)
        const path = await uploadFile(`photos/${jobId}`, files[i])
        const r = await supabase.from('photos').insert({ job_id: jobId, path, taken_on: date, description: descs[i].trim() || null })
        if (r.error) throw r.error
      }
      onDone()
    } catch (err) {
      alert(err.message)
      setProgress('')
    }
  }

  return (
    <form className="card form" onSubmit={save}>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      {files.map((f, i) => (
        <div key={i} className="inline" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <img className="thumb" src={previews[i]} alt="" />
          <textarea
            rows="2"
            placeholder="Description (what's shown, location, progress…)"
            value={descs[i]}
            onChange={(e) => setDescs(descs.map((d, j) => (j === i ? e.target.value : d)))}
          />
        </div>
      ))}
      {files.length > 1 && (
        <button type="button" className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setDescs(descs.map(() => descs[0]))}>
          Use first description for all
        </button>
      )}
      <button className="primary" disabled={Boolean(progress)}>
        {progress || `Save ${files.length} photo${files.length === 1 ? '' : 's'}`}
      </button>
      <button type="button" onClick={onCancel} disabled={Boolean(progress)}>Cancel</button>
    </form>
  )
}

export default function Photos() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [pending, setPending] = useState(null)
  const [editing, setEditing] = useState(null)
  const [viewer, setViewer] = useState(null)

  const load = useCallback(async () => {
    const [j, p] = await Promise.all([
      supabase.from('jobs').select('name').eq('id', id).single(),
      supabase.from('photos').select('*').eq('job_id', id).order('taken_on', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setJob(j.data)
    setPhotos(p.data || [])
    try {
      setUrls(await signedUrls((p.data || []).map((x) => x.path)))
    } catch {
      /* images will show as blank */
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const groups = []
  for (const p of photos) {
    const g = groups[groups.length - 1]
    if (g && g.date === p.taken_on) g.items.push(p)
    else groups.push({ date: p.taken_on, items: [p] })
  }

  async function saveEdit(e) {
    e.preventDefault()
    const { error } = await supabase
      .from('photos')
      .update({ description: editing.description?.trim() || null, taken_on: editing.taken_on })
      .eq('id', editing.id)
    if (error) return alert(error.message)
    setEditing(null)
    load()
  }

  async function remove(p) {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from(BUCKET).remove([p.path])
    await supabase.from('photos').delete().eq('id', p.id)
    setEditing(null)
    setViewer(null)
    load()
  }

  return (
    <>
      <Header title="Photos" back />
      {job && <p className="muted subhead">📷 {job.name}</p>}

      {pending ? (
        <Uploader jobId={id} files={pending} onCancel={() => setPending(null)} onDone={() => { setPending(null); load() }} />
      ) : (
        <label className="button primary block photo-btn">
          📷 Take or add photos
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files.length && setPending([...e.target.files])} />
        </label>
      )}

      {!photos.length && !pending && <Empty>No photos yet.</Empty>}

      {groups.map((g) => (
        <section key={g.date}>
          <div className="date-head">
            <span className="date-badge">📅 {longDate(g.date)}</span>
          </div>
          {g.items.map((p) => (
            <div key={p.id} className="photo-card">
              <img src={urls[p.path]} alt={p.description || ''} loading="lazy" onClick={() => setViewer(p)} />
              <div className="meta">
                {editing?.id === p.id ? (
                  <form className="form" onSubmit={saveEdit}>
                    <input type="date" value={editing.taken_on} onChange={(e) => setEditing({ ...editing, taken_on: e.target.value })} />
                    <textarea rows="3" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                    <div className="inline">
                      <button className="primary grow">Save</button>
                      <button type="button" className="grow" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                    <button type="button" className="danger" onClick={() => remove(p)}>Delete photo</button>
                  </form>
                ) : (
                  <div className="inline" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <div className="grow">
                      <div className="small muted">{fmtDate(p.taken_on)}</div>
                      <div className="pre">{p.description || <span className="muted">No description</span>}</div>
                    </div>
                    <button className="link small" onClick={() => setEditing(p)}>Edit</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      ))}

      {viewer && (
        <div className="viewer" onClick={() => setViewer(null)}>
          <img src={urls[viewer.path]} alt="" />
          <p style={{ color: '#fff', textAlign: 'center', padding: '0 16px' }}>
            <b>{fmtDate(viewer.taken_on)}</b>
            {viewer.description ? ` · ${viewer.description}` : ''}
          </p>
          <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
            <a className="button" href={urls[viewer.path]} target="_blank" rel="noreferrer">Open full size</a>
            <button onClick={() => setViewer(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
