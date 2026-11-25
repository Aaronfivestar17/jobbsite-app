import { supabase, BUCKET } from './supabase'

export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const fmtDate = (s) => {
  if (!s) return ''
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const invoiceState = (inv) => {
  if (inv.status === 'paid') return 'paid'
  if (inv.status === 'to_bill') return 'to bill'
  if (inv.due_date && inv.due_date < today()) return 'overdue'
  return 'unpaid'
}

export const balance = (inv) =>
  inv.status !== 'unpaid' ? 0 : Number(inv.amount || 0) - Number(inv.amount_paid || 0)

// Shrink phone photos before upload so storage stays small and uploads are fast.
export async function shrinkImage(file, max = 1600, quality = 0.8) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}

export async function uploadFile(folder, file) {
  const isImage = file.type?.startsWith('image/')
  const body = isImage ? await shrinkImage(file) : file
  const ext = isImage ? 'jpg' : (file.name?.split('.').pop() || 'bin').toLowerCase()
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: isImage ? 'image/jpeg' : file.type || undefined,
  })
  if (error) throw error
  return path
}

export async function signedUrls(paths) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  return Object.fromEntries(data.map((d) => [d.path, d.signedUrl]))
}

export async function openFile(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) return alert(error.message)
  window.open(data.signedUrl, '_blank')
}
