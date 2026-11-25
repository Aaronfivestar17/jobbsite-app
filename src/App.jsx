import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { supabase, configured } from './supabase'
import Login from './pages/Login'
import Todo from './pages/Todo'
import Finances from './pages/Finances'
import InvoiceEdit from './pages/InvoiceEdit'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Submittals from './pages/Submittals'
import Photos from './pages/Photos'
import Materials from './pages/Materials'
import Account from './pages/Account'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [member, setMember] = useState(undefined)
  const [memberError, setMemberError] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setMember(undefined)
    supabase
      .from('members')
      .select('email')
      .eq('email', session.user.email.toLowerCase())
      .maybeSingle()
      .then(({ data, error }) => {
        setMemberError(error ? error.message : '')
        setMember(Boolean(data))
      })
  }, [session])

  if (!configured)
    return (
      <div className="center-page">
        <h1>Setup needed</h1>
        <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment, then rebuild.</p>
      </div>
    )
  if (session === undefined) return <div className="center-page">Loading…</div>
  if (!session) return <Login />
  if (member === undefined) return <div className="center-page">Loading…</div>
  if (!member)
    return (
      <div className="center-page">
        <h1>No access</h1>
        <p>{session.user.email} is not on the approved list. Ask the account owner to add you.</p>
        {memberError && <p className="error">Details: {memberError}</p>}
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    )

  return (
    <div className="app">
      <main>
        <Routes>
          <Route path="/" element={<Todo />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/invoices/new" element={<InvoiceEdit />} />
          <Route path="/invoices/:id" element={<InvoiceEdit />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/submittals" element={<Submittals />} />
          <Route path="/projects/:id/photos" element={<Photos />} />
          <Route path="/projects/:id/materials" element={<Materials />} />
          <Route path="/account" element={<Account email={session.user.email} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>
          <span>✅</span>To-do
        </NavLink>
        <NavLink to="/finances" className={({ isActive }) => (isActive || location.pathname.startsWith('/invoices') ? 'active' : '')}>
          <span>💵</span>Finances
        </NavLink>
        <NavLink to="/projects">
          <span>🏗️</span>Projects
        </NavLink>
      </nav>
    </div>
  )
}
