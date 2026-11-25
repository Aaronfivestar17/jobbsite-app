import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { money, balance, invoiceState, today, fmtDate } from '../util'
import { Header, InvoiceRow, Empty } from '../components/ui'

function exportCsv(rows, name) {
  const cols = ['invoice_number', 'client_name', 'project', 'amount', 'amount_paid', 'issued_date', 'due_date', 'status', 'paid_date', 'notes']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [cols.join(',')].concat(
    rows.map((i) => cols.map((c) => esc(c === 'project' ? i.jobs?.name : c === 'status' ? invoiceState(i) : i[c])).join(','))
  )
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${today()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Finances() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'bill'
  const [all, setAll] = useState([])
  const [showPaid, setShowPaid] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('invoices').select('*, jobs(name)').order('created_at', { ascending: false })
    setAll(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markSent(inv, e) {
    e.stopPropagation()
    const sent = inv.issued_date || today()
    const d = new Date(sent + 'T12:00:00')
    d.setDate(d.getDate() + 30)
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'unpaid', issued_date: sent, due_date: inv.due_date || d.toISOString().slice(0, 10) })
      .eq('id', inv.id)
    if (error) return alert(error.message)
    load()
  }

  async function markPaid(inv, e) {
    e.stopPropagation()
    if (!confirm(`Mark ${money(balance(inv))} from ${inv.client_name || 'this client'} as paid today?`)) return
    const { error } = await supabase.from('invoices').update({ status: 'paid', paid_date: today() }).eq('id', inv.id)
    if (error) return alert(error.message)
    load()
  }

  const toBill = all.filter((i) => i.status === 'to_bill')
  const collect = all
    .filter((i) => i.status === 'unpaid')
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  const overdue = collect.filter((i) => invoiceState(i) === 'overdue')
  const paid = all.filter((i) => i.status === 'paid').sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''))
  const sum = (rows, f = (i) => Number(i.amount || 0)) => rows.reduce((s, i) => s + f(i), 0)

  return (
    <>
      <Header title="Finances" action={<Link className="link" to="/invoices/new">+ New</Link>} />
      <div className="segmented">
        <button className={tab === 'bill' ? 'on' : ''} onClick={() => setParams({ tab: 'bill' })}>Bill ({toBill.length})</button>
        <button className={tab === 'collect' ? 'on' : ''} onClick={() => setParams({ tab: 'collect' })}>Collect ({collect.length})</button>
      </div>

      {tab === 'bill' && (
        <>
          <div className="card total-bar">
            <span className="muted">Ready to bill</span>
            <span className="big">{money(sum(toBill))}</span>
          </div>
          <Link className="button primary block" to="/invoices/new">+ New invoice to bill</Link>
          {toBill.length ? (
            <ul className="list">
              {toBill.map((i) => (
                <li key={i.id} className="row" onClick={() => nav(`/invoices/${i.id}`)}>
                  <div className="grow">
                    <div className="title">
                      {i.invoice_number ? `#${i.invoice_number} · ` : ''}
                      {i.client_name || i.jobs?.name || 'Invoice'}
                      {i.file_path ? ' 📎' : ''}
                    </div>
                    <div className="muted small">{[money(i.amount), fmtDate(i.issued_date)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button className="small" onClick={(e) => markSent(i, e)}>Mark sent</button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing waiting to be billed.</Empty>
          )}
          <p className="muted small">When you send an invoice, tap “Mark sent” and it moves to Collect.</p>
        </>
      )}

      {tab === 'collect' && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="muted small">Waiting on</div>
              <div className="big">{money(sum(collect, balance))}</div>
              <div className="small muted">{collect.length} invoice{collect.length === 1 ? '' : 's'}</div>
            </div>
            <div className={`stat ${overdue.length ? 'warn' : ''}`}>
              <div className="muted small">Overdue</div>
              <div className="big">{money(sum(overdue, balance))}</div>
              <div className="small muted">{overdue.length} invoice{overdue.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          {collect.length ? (
            <ul className="list">
              {collect.map((i) => (
                <InvoiceRow key={i.id} inv={i} onClick={() => nav(`/invoices/${i.id}`)}
                  action={<button className="small" onClick={(e) => markPaid(i, e)}>✓ Paid</button>} />
              ))}
            </ul>
          ) : (
            <Empty>No payments to collect.</Empty>
          )}

          <button className="link" onClick={() => setShowPaid(!showPaid)}>
            {showPaid ? '▾' : '▸'} Collected ({paid.length}) · {money(sum(paid))}
          </button>
          {showPaid && paid.length > 0 && (
            <ul className="list">
              {paid.map((i) => (
                <InvoiceRow key={i.id} inv={i} onClick={() => nav(`/invoices/${i.id}`)} />
              ))}
            </ul>
          )}
          {all.length > 0 && (
            <button className="block" style={{ marginTop: 12 }} onClick={() => exportCsv(all, 'invoices')}>
              Export all invoices to spreadsheet (CSV)
            </button>
          )}
        </>
      )}
    </>
  )
}
