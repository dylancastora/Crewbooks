import { sanitizeFilename, sanitizeHeaderValue } from '../../utils/sanitize'

interface Attachment {
  filename: string
  mimeType: string
  data: Uint8Array
}

interface EmailParams {
  to: string[]
  subject: string
  html: string
  attachments?: Attachment[]
}

function base64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMultipartMime({ to, subject, html, attachments = [] }: EmailParams): string {
  const boundary = `boundary_${Date.now()}`

  const headers = [
    `To: ${sanitizeHeaderValue(to.join(', '))}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    'MIME-Version: 1.0',
  ]

  if (attachments.length === 0) {
    headers.push('Content-Type: text/html; charset=UTF-8')
    return [...headers, '', html].join('\r\n')
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)

  const parts: string[] = []

  // HTML body
  parts.push(
    `--${boundary}\r\n` +
    'Content-Type: text/html; charset=UTF-8\r\n' +
    '\r\n' +
    html,
  )

  // Attachments
  for (const att of attachments) {
    const b64 = base64urlEncode(att.data).replace(/-/g, '+').replace(/_/g, '/') // back to regular base64 for MIME
    const safeName = sanitizeFilename(att.filename)
    parts.push(
      `--${boundary}\r\n` +
      `Content-Type: ${att.mimeType}; name="${safeName}"\r\n` +
      'Content-Transfer-Encoding: base64\r\n' +
      `Content-Disposition: attachment; filename="${safeName}"\r\n` +
      '\r\n' +
      b64,
    )
  }

  parts.push(`--${boundary}--`)

  return [...headers, '', parts.join('\r\n')].join('\r\n')
}

export async function sendEmail(token: string, params: EmailParams): Promise<void> {
  const raw = buildMultipartMime(params)
  const encoded = base64urlEncode(raw)

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    throw new Error('Failed to send email')
  }
}
