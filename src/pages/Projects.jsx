import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Header, Empty } from '../components/ui'
import JobForm from './JobForm'

export default function Projects() {
  const nav = useNavigate()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('active')
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    let query = supabase.from('jobs').select('*, submittals(count), photos(count)').order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setJobs(data || [])
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const shown = jobs.filter((j) => [j.name, j.client_name, j.address].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <Header title="Projects" action={<button className="link" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ New'}</button>} />
      {adding && <JobForm onSaved={(job) => nav(`/projects/${job.id}`)} />}
      <div className="segmented">
        {['active', 'done', 'all'].map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <input className="search" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length ? (
        <ul className="list">
          {shown.map((j) => (
            <li key={j.id} className="row" onClick={() => nav(`/projects/${j.id}`)}>
              <div className="grow">
                <div className="title">{j.name}</div>
                <div className="muted small">{[j.client_name, j.address].filter(Boolean).join(' · ')}</div>
                <div className="muted small">
                  📁 {j.submittals?.[0]?.count ?? 0} submittal{j.submittals?.[0]?.count === 1 ? '' : 's'} · 📷 {j.photos?.[0]?.count ?? 0} photo{j.photos?.[0]?.count === 1 ? '' : 's'}
                </div>
              </div>
              <span className="chev">›</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{adding ? '' : 'No projects here yet. Tap “+ New” to add one.'}</Empty>
      )}
    </>
  )
}
