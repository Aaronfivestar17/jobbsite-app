import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { money, balance } from '../util'
import { Header } from '../components/ui'
import JobForm from './JobForm'

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [job, setJob] = useState(null)
  const [editing, setEditing] = useState(false)
  const [counts, setCounts] = useState({ submittals: 0, photos: 0, materials: 0 })
  const [invoices, setInvoices] = useState([])

  const load = useCallback(async () => {
    const [j, s, p, i, m] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase.from('submittals').select('id', { count: 'exact', head: true }).eq('job_id', id),
      supabase.from('photos').select('id', { count: 'exact', head: true }).eq('job_id', id),
      supabase.from('invoices').select('amount,amount_paid,status').eq('job_id', id),
      supabase.from('materials').select('id', { count: 'exact', head: true }).eq('job_id', id),
    ])
    setJob(j.data)
    setCounts({ submittals: s.count || 0, photos: p.count || 0, materials: m.count || 0 })
    setInvoices(i.data || [])
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!job) return <Header title="Project" back />

  async function remove() {
    if (!confirm(`Delete project "${job.name}"? All its submittals and photos are deleted too. Invoices are kept.`)) return
    const [s, p] = await Promise.all([
      supabase.from('submittals').select('file_path').eq('job_id', id),
      supabase.from('photos').select('path').eq('job_id', id),
    ])
    const paths = [...(s.data || []).map((x) => x.file_path), ...(p.data || []).map((x) => x.path)].filter(Boolean)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (error) return alert(error.message)
    nav('/projects', { replace: true })
  }

  const billed = invoices.filter((x) => x.status !== 'to_bill').reduce((s, x) => s + Number(x.amount || 0), 0)
  const owed = invoices.reduce((s, x) => s + balance(x), 0)

  return (
    <>
      <Header title={job.name} back action={<button className="link" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button>} />
      {editing ? (
        <JobForm job={job} onSaved={(j) => { setJob(j); setEditing(false) }} onDelete={remove} />
      ) : (
        <div className="card">
          {job.client_name && <div className="title">{job.client_name}</div>}
          {job.address && (
            <div>
              <a href={`https://maps.apple.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">📍 {job.address}</a>
            </div>
          )}
          <div className="inline small">
            {job.client_phone && <a href={`tel:${job.client_phone}`}>📞 {job.client_phone}</a>}
            {job.client_email && <a href={`mailto:${job.client_email}`}>✉️ {job.client_email}</a>}
          </div>
          {job.notes && <p className="small pre">{job.notes}</p>}
          <div className="inline small muted">
            <span>Status: {job.status === 'on_hold' ? 'on hold' : job.status}</span>
            {invoices.length > 0 && <span>Billed {money(billed)}</span>}
            {owed > 0 && <span className="overdue">Owed {money(owed)}</span>}
          </div>
        </div>
      )}

      <h2>Folders</h2>
      <div className="folders">
        <Link to={`/projects/${id}/submittals`} className="folder">
          <span className="icon">📁</span>
          <span className="title">Submittals</span>
          <span className="muted small">{counts.submittals} item{counts.submittals === 1 ? '' : 's'}</span>
        </Link>
        <Link to={`/projects/${id}/photos`} className="folder">
          <span className="icon">📷</span>
          <span className="title">Photos</span>
          <span className="muted small">{counts.photos} photo{counts.photos === 1 ? '' : 's'}</span>
        </Link>
        <Link to={`/projects/${id}/materials`} className="folder">
          <span className="icon">🧱</span>
          <span className="title">Materials ordered</span>
          <span className="muted small">{counts.materials} order{counts.materials === 1 ? '' : 's'}</span>
        </Link>
      </div>
      <Link className="button block" to={`/invoices/new?job=${id}`}>💵 New invoice for this project</Link>
    </>
  )
}
