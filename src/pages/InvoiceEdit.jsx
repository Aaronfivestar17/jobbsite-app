import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { today, money, invoiceState, balance, uploadFile, openFile } from '../util'
import { Header, StatusPill } from '../components/ui'

const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function InvoiceEdit() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => {
    if (id) {
      supabase.from('invoices').select('*').eq('id', id).single().then(({ data }) => setF(data))
    } else {
      const jobId = params.get('job')
      const init = { job_id: jobId, client_name: '', amount: '', issued_date: today(), status: 'to_bill', notes: '', file_path: null }
      if (jobId) {
        supabase.from('jobs').select('client_name,name').eq('id', jobId).single()
          .then(({ data }) => setF({ ...init, client_name: data?.client_name || data?.name || '' }))
      } else setF(init)
    }
  }, [id, params])

  if (!f) return <Header title="Invoice" back />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e, overrides = {}) {
    e?.preventDefault()
    setBusy(true)
    const v = { ...f, ...overrides }
    let file_path = v.file_path || null
    if (file) {
      try {
        const p = await uploadFile('invoices', file)
        if (file_path) await supabase.storage.from(BUCKET).remove([file_path])
        file_path = p
      } catch (err) {
        setBusy(false)
        return alert('Could not upload the file: ' + err.message)
      }
    }
    const row = {
      notes: v.notes?.trim() || null,
      file_path,
      client_name: v.client_name.trim(),
      amount: Number(v.amount || 0),
      issued_date: v.issued_date || today(),
      status: v.status,
      due_date: v.due_date || null,
      paid_date: v.status === 'paid' ? v.paid_date || today() : null,
    }
    const res = id
      ? await supabase.from('invoices').update(row).eq('id', id)
      : await supabase.from('invoices').insert({ ...row, job_id: v.job_id || null })
    setBusy(false)
    if (res.error) return alert(res.error.message)
    nav(-1)
  }

  async function remove() {
    if (!confirm('Delete this invoice?')) return
    if (f.file_path) await supabase.storage.from(BUCKET).remove([f.file_path])
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) return alert(error.message)
    nav(-1)
  }

  const state = id ? invoiceState(f) : null

  return (
    <>
      <Header title={id ? 'Invoice' : 'New invoice'} back />
      <form className="card form" onSubmit={save}>
        {state && (
          <div className="inline">
            Status: <StatusPill state={state} />
          </div>
        )}
        <label>
          Name
          <input value={f.client_name || ''} onChange={set('client_name')} required placeholder="Client or job name" />
        </label>
        <label>
          Amount ($)
          <input type="number" inputMode="decimal" step="0.01" min="0" value={f.amount} onChange={set('amount')} required placeholder="0.00" />
        </label>
        <label>
          Date
          <input type="date" value={f.issued_date || ''} onChange={set('issued_date')} required />
        </label>
        <label>
          Notes
          <textarea rows="3" value={f.notes || ''} onChange={set('notes')} placeholder="Optional" />
        </label>
        <label>
          {f.file_path ? 'Replace PDF invoice' : 'Attach PDF invoice'}
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        {f.file_path && !file && (
          <button type="button" onClick={() => openFile(f.file_path)}>📄 View attached invoice</button>
        )}
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save invoice'}</button>
      </form>

      {id && f.status === 'to_bill' && (
        <button className="block" disabled={busy}
          onClick={() => save(null, { status: 'unpaid', due_date: f.due_date || addDays(f.issued_date || today(), 30) })}>
          📤 Mark sent (moves to Collect)
        </button>
      )}
      {id && f.status === 'unpaid' && (
        <button className="block" disabled={busy} onClick={() => save(null, { status: 'paid', paid_date: today() })}>
          ✓ Mark paid today ({money(balance(f))})
        </button>
      )}
      {id && <button className="danger block" onClick={remove}>Delete invoice</button>}
    </>
  )
}
