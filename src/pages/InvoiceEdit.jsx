import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, BUCKET } from '../supabase'
import { today, uploadFile, openFile, money, invoiceState, balance } from '../util'
import { Header, JobSelect, StatusPill } from '../components/ui'

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
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (id) {
      supabase.from('invoices').select('*').eq('id', id).single().then(({ data }) => setF(data))
    } else {
      const jobId = params.get('job')
      const t = today()
      const init = { job_id: jobId, invoice_number: '', client_name: '', amount: '', issued_date: null, due_date: null, status: 'to_bill', paid_date: null, amount_paid: '', notes: '', file_path: null }
      if (jobId) {
        supabase.from('jobs').select('client_name').eq('id', jobId).single().then(({ data }) => setF({ ...init, client_name: data?.client_name || '' }))
      } else setF(init)
    }
  }, [id, params])

  if (!f) return <Header title="Invoice" back />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function pickJob(jobId) {
    let client = f.client_name
    if (jobId && !client) {
      const { data } = await supabase.from('jobs').select('client_name').eq('id', jobId).single()
      client = data?.client_name || ''
    }
    setF({ ...f, job_id: jobId, client_name: client })
  }

  async function save(e, overrides = {}) {
    e?.preventDefault()
    setBusy(true)
    try {
      const v = { ...f, ...overrides }
      let file_path = v.file_path
      if (file) {
        const newPath = await uploadFile('invoices', file)
        if (file_path) await supabase.storage.from(BUCKET).remove([file_path])
        file_path = newPath
      }
      const row = {
        job_id: v.job_id || null,
        invoice_number: v.invoice_number || null,
        client_name: v.client_name || null,
        amount: Number(v.amount || 0),
        issued_date: v.issued_date || null,
        due_date: v.due_date || null,
        status: v.status,
        paid_date: v.status === 'paid' ? v.paid_date || today() : null,
        amount_paid: v.amount_paid === '' || v.amount_paid == null ? null : Number(v.amount_paid),
        notes: v.notes || null,
        file_path,
      }
      const res = id
        ? await supabase.from('invoices').update(row).eq('id', id)
        : await supabase.from('invoices').insert(row)
      if (res.error) throw res.error
      nav(-1)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
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
      {id && f.status === 'to_bill' && (
        <button className="primary block" disabled={busy}
          onClick={() => save(null, { status: 'unpaid', issued_date: today(), due_date: f.due_date || addDays(today(), 30) })}>
          📤 Mark sent today (moves to Collect)
        </button>
      )}
      {id && f.status === 'unpaid' && (
        <button className="primary block" disabled={busy} onClick={() => save(null, { status: 'paid', paid_date: today() })}>
          ✓ Mark paid today ({money(balance(f))})
        </button>
      )}
      <form className="card form" onSubmit={save}>
        {state && (
          <div className="inline">
            Status: <StatusPill state={state} />
          </div>
        )}
        <label>
          Project
          <JobSelect value={f.job_id} onChange={pickJob} />
        </label>
        <div className="inline">
          <label className="grow">
            Invoice #
            <input value={f.invoice_number || ''} onChange={set('invoice_number')} />
          </label>
          <label className="grow">
            Amount ($)
            <input type="number" inputMode="decimal" step="0.01" min="0" value={f.amount} onChange={set('amount')} required />
          </label>
        </div>
        <label>
          Client
          <input value={f.client_name || ''} onChange={set('client_name')} />
        </label>
        <div className="inline">
          <label className="grow">
            Sent
            <input type="date" value={f.issued_date || ''} onChange={set('issued_date')} />
          </label>
          <label className="grow">
            Due
            <input type="date" value={f.due_date || ''} onChange={set('due_date')} />
          </label>
        </div>
        <label>
          Payment status
          <select value={f.status} onChange={set('status')}>
            <option value="to_bill">To bill (not sent yet)</option>
            <option value="unpaid">Sent, waiting on payment</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        {f.status === 'paid' ? (
          <label>
            Paid on
            <input type="date" value={f.paid_date || today()} onChange={set('paid_date')} />
          </label>
        ) : f.status === 'to_bill' ? null : (
          <label>
            Partial payment received ($)
            <input type="number" inputMode="decimal" step="0.01" min="0" value={f.amount_paid ?? ''} onChange={set('amount_paid')} placeholder="0.00" />
          </label>
        )}
        <label>
          Notes
          <textarea rows="2" value={f.notes || ''} onChange={set('notes')} />
        </label>
        <label>
          Invoice file (PDF or photo)
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        {f.file_path && !file && (
          <button type="button" onClick={() => openFile(f.file_path)}>📄 View attached file</button>
        )}
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save invoice'}</button>
        {id && (
          <button type="button" className="danger" onClick={remove}>Delete invoice</button>
        )}
      </form>
    </>
  )
}
