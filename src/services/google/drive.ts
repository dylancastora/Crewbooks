const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function findFolder(name: string, parentId: string | null, token: string): Promise<string | null> {
  const q = [`name='${name}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false']
  if (parentId) q.push(`'${parentId}' in parents`)
  const res = await fetch(`${DRIVE_BASE}/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to search Drive')
  const data = await res.json()
  return data.files?.[0]?.id || null
}

export async function createFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) metadata.parents = [parentId]
  const res = await fetch(`${DRIVE_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  const data = await res.json()
  return data.id
}

export async function ensureFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const existing = await findFolder(name, parentId, token)
  if (existing) return existing
  return createFolder(name, parentId, token)
}

export async function findFile(name: string, parentId: string, mimeType: string, token: string): Promise<string | null> {
  const q = [`name='${name}'`, `mimeType='${mimeType}'`, `'${parentId}' in parents`, 'trashed=false']
  const res = await fetch(`${DRIVE_BASE}/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id)`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to search Drive')
  const data = await res.json()
  return data.files?.[0]?.id || null
}

export async function createSpreadsheet(name: string, parentId: string, token: string): Promise<string> {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: [parentId],
  }
  const res = await fetch(`${DRIVE_BASE}/files`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error('Failed to create spreadsheet')
  const data = await res.json()
  return data.id
}

export async function uploadFile(file: File, folderId: string, token: string): Promise<string> {
  const metadata = {
    name: file.name,
    parents: [folderId],
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error('Failed to upload file')
  const data = await res.json()
  return data.id
}

export async function downloadFile(fileId: string, token: string): Promise<{ data: Uint8Array; mimeType: string; name: string }> {
  // Get file metadata first
  const metaRes = await fetch(`${DRIVE_BASE}/files/${fileId}?fields=name,mimeType`, {
    headers: authHeaders(token),
  })
  if (!metaRes.ok) throw new Error('Failed to get file metadata')
  const meta = await metaRes.json()

  // Download content
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to download file')
  const buffer = await res.arrayBuffer()
  return { data: new Uint8Array(buffer), mimeType: meta.mimeType, name: meta.name }
}
