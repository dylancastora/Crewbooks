/** Escape HTML special characters to prevent injection in email templates */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip CR/LF to prevent header injection in email subjects and MIME headers */
export function sanitizeHeaderValue(str: string): string {
  return str.replace(/[\r\n]/g, '')
}

/** Escape single quotes for Google Drive API query strings */
export function escapeQueryValue(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Strip control characters and quotes from filenames for MIME headers */
export function sanitizeFilename(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f"\\]/g, '_')
}
