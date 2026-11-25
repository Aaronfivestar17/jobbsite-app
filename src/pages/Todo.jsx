import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { Header, TaskItem, toggleTask, deleteTask, Empty } from '../components/ui'

export default function Todo() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDue, setShowDue] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: true })
    setTasks(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e) {
    e.preventDefault()
    if (!title.trim()) return
    const { error } = await supabase.from('tasks').insert({ title: title.trim(), due_date: due || null })
    if (error) return alert(error.message)
    setTitle('')
    setDue('')
    setShowDue(false)
    load()
  }

  async function toggle(t) {
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
    await toggleTask(t)
    load()
  }

  async function clearDone() {
    if (!confirm('Remove all checked-off items?')) return
    const { error } = await supabase.from('tasks').delete().eq('done', true)
    if (error) alert(error.message)
    load()
  }

  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''))

  return (
    <>
      <Header title="To-do" action={<Link className="link" to="/account">Account</Link>} />
      <form className="card form" onSubmit={add}>
        <div className="inline">
          <input placeholder="Add a to-do…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="primary">Add</button>
        </div>
        {showDue ? (
          <label>
            Due date (optional)
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        ) : (
          <button type="button" className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowDue(true)}>
            + Add due date
          </button>
        )}
      </form>

      {open.length ? (
        <ul className="list">
          {open.map((t) => (
            <TaskItem key={t.id} task={t} onToggle={toggle} onDelete={async (x) => { if (await deleteTask(x)) load() }} />
          ))}
        </ul>
      ) : (
        <Empty>All caught up.</Empty>
      )}

      {done.length > 0 && (
        <>
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <button className="link" onClick={() => setShowDone(!showDone)}>
              {showDone ? '▾' : '▸'} Checked off ({done.length})
            </button>
            {showDone && <button className="link danger small" onClick={clearDone}>Clear all</button>}
          </div>
          {showDone && (
            <ul className="list">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} onToggle={toggle} onDelete={async (x) => { if (await deleteTask(x)) load() }} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
