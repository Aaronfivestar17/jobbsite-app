import { useState, useEffect } from 'react'
import { supabase, BUCKET } from '../supabase'
import { Header, useMembers } from '../components/ui'

const LIMIT = 1024 ** 3 // Supabase free plan: 1 GB of file storage

const fmtSize = (b) =>
  b >= 1000 * 1024 ** 2 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`

// Walk a storage folder and add up file sizes.
async function folderUsage(prefix) {
  let bytes = 0
  let count = 0
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw error
    for (const item of data) {
      if (item.id === null) {
        const sub = await folderUsage(`${prefix}/${item.name}`)
        bytes += sub.bytes
        count += sub.count
      } else if (item.name !== '.emptyFolderPlaceholder') {
        bytes += Number(item.metadata?.size || 0)
        count += 1
      }
    }
    if (data.length < 1000) break
  }
  return { bytes, count }
}

function DataUsage() {
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all(['photos', 'submittals', 'documents', 'invoices'].map(folderUsage))
      .then(([photos, submittals, documents, invoices]) => setUsage({ photos, submittals, documents, invoices }))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="error">Could not load storage use: {error}</p>
  if (!usage) return <div className="card muted">Checking storage…</div>

  const used = usage.photos.bytes + usage.submittals.bytes + usage.documents.bytes + usage.invoices.bytes
  const pct = Math.min(100, (used / LIMIT) * 100)
  const rows = [
    ['📷 Photos', usage.photos],
    ['📁 Submittals', usage.submittals],
    ['🗂️ Supporting documents', usage.documents],
    ['💵 Invoice files', usage.invoices],
  ]

  return (
    <div className="card">
      <div className="total-bar">
        <span className="title">{fmtSize(LIMIT - used)} available</span>
        <span className="muted small">{fmtSize(used)} of 1 GB used</span>
      </div>
      <div className="meter">
        <div className={`meter-fill ${pct > 85 ? 'warn' : ''}`} style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
      {rows.map(([label, u]) => (
        <div key={label} className="total-bar small">
          <span>{label} <span className="muted">({u.count} file{u.count === 1 ? '' : 's'})</span></span>
          <span>{fmtSize(u.bytes)}</span>
        </div>
      ))}
      <p className="muted small">Free plan limit: 1 GB total, 50 MB per file. Photos are shrunk before upload to save space.</p>
    </div>
  )
}

export default function Account({ email }) {
  const members = useMembers()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')

  async function changePw(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? error.message : 'Password updated.')
    if (!error) setPw('')
  }

  return (
    <>
      <Header title="Account" back />
      <button className="danger block" onClick={() => confirm('Log out?') && supabase.auth.signOut()}>Log out</button>
      <div className="card">
        <p className="small">Signed in as <b>{email}</b></p>
        <form className="form" onSubmit={changePw}>
          <label>
            New password
            <input type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
          </label>
          {msg && <p className="small">{msg}</p>}
          <button>Change password</button>
        </form>
      </div>
      <h2>Team with access</h2>
      <ul className="list">
        {members.map((m) => (
          <li key={m.email} className="row" style={{ cursor: 'default' }}>
            <div className="grow">
              <div className="title">{m.name || m.email}</div>
              <div className="muted small">{m.email}</div>
            </div>
          </li>
        ))}
      </ul>
      <h2>Data</h2>
      <DataUsage />
    </>
  )
}
