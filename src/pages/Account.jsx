import { useState } from 'react'
import { supabase } from '../supabase'
import { Header, useMembers } from '../components/ui'

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
      <button className="danger block" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </>
  )
}
