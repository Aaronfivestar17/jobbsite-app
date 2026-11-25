import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { fmtDate, money, invoiceState, balance, today } from '../util'
export { balance }

export function Header({ title, back, action }) {
  const nav = useNavigate()
  return (
    <header className="header">
      <div className="header-side">{back && <button className="link" onClick={() => nav(-1)}>‹ Back</button>}</div>
      <h1>{title}</h1>
      <div className="header-side right">{action}</div>
    </header>
  )
}

export function useJobs(activeOnly = false) {
  const [jobs, setJobs] = useState([])
  useEffect(() => {
    let q = supabase.from('jobs').select('id,name,client_name,status').order('name')
    if (activeOnly) q = q.neq('status', 'done')
    q.then(({ data }) => setJobs(data || []))
  }, [activeOnly])
  return jobs
}

export function useMembers() {
  const [members, setMembers] = useState([])
  useEffect(() => {
    supabase.from('members').select('email,name').order('name').then(({ data }) => setMembers(data || []))
  }, [])
  return members
}

export function JobSelect({ value, onChange, required, allowNone = true }) {
  const jobs = useJobs()
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} required={required}>
      {allowNone && <option value="">— No project —</option>}
      {!allowNone && <option value="">Choose a project…</option>}
      {jobs.map((j) => (
        <option key={j.id} value={j.id}>
          {j.name}
          {j.status === 'done' ? ' (done)' : ''}
        </option>
      ))}
    </select>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function StatusPill({ state }) {
  return <span className={`pill pill-${state.replace(' ', '_')}`}>{state}</span>
}

export function InvoiceRow({ inv, onClick, action }) {
  const state = invoiceState(inv)
  return (
    <li className="row" onClick={onClick}>
      <div className="grow">
        <div className="title">
          {inv.invoice_number ? `#${inv.invoice_number} · ` : ''}
          {inv.client_name || inv.jobs?.name || 'Invoice'}
        </div>
        <div className="muted small">
          {inv.jobs?.name && inv.client_name ? `${inv.jobs.name} · ` : ''}
          {state === 'paid'
            ? `Paid ${fmtDate(inv.paid_date)}`
            : state === 'to bill'
              ? `Created ${fmtDate(inv.created_at)}`
              : inv.due_date
                ? `Sent ${fmtDate(inv.issued_date)} · due ${fmtDate(inv.due_date)}`
                : `Sent ${fmtDate(inv.issued_date)}`}
        </div>
      </div>
      <div className="right-col">
        <div className="title">{money(state === 'unpaid' || state === 'overdue' ? balance(inv) : inv.amount)}</div>
        <StatusPill state={state} />
        {action}
      </div>
    </li>
  )
}

export function TaskItem({ task, onToggle, onDelete, showJob = true }) {
  const overdue = !task.done && task.due_date && task.due_date < today()
  return (
    <li className={`row task ${task.done ? 'done' : ''}`}>
      <input type="checkbox" checked={task.done} onChange={() => onToggle(task)} aria-label="Done" />
      <div className="grow">
        <div className="title">{task.title}</div>
        <div className="muted small">
          {task.due_date && <span className={overdue ? 'overdue' : ''}>{overdue ? 'Overdue · ' : ''}{fmtDate(task.due_date)}</span>}
          {showJob && task.jobs?.name && <span> · {task.jobs.name}</span>}
          {task.assigned_to && <span> · {task.assigned_to}</span>}
        </div>
        {task.notes && <div className="small">{task.notes}</div>}
      </div>
      {onDelete && (
        <button className="link danger small" onClick={() => onDelete(task)} aria-label="Delete">
          ✕
        </button>
      )}
    </li>
  )
}

export async function toggleTask(task) {
  const done = !task.done
  const { error } = await supabase
    .from('tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', task.id)
  if (error) alert(error.message)
}

export async function deleteTask(task) {
  if (!confirm(`Delete "${task.title}"?`)) return false
  const { error } = await supabase.from('tasks').delete().eq('id', task.id)
  if (error) alert(error.message)
  return !error
}

