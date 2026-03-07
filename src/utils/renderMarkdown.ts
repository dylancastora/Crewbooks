import { escapeHtml } from './sanitize'

/**
 * Minimal markdown-to-HTML converter for static legal documents.
 * Supports: headings, bold, italic, links, unordered/ordered lists, tables, hr, paragraphs.
 */
export function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList: 'ul' | 'ol' | null = null
  let inTable = false

  const flushList = () => {
    if (inList) { out.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null }
  }
  const flushTable = () => {
    if (inTable) { out.push('</tbody></table>'); inTable = false }
  }

  const inline = (text: string): string => {
    let s = escapeHtml(text)
    // bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList(); flushTable()
      out.push('<hr class="my-6 border-gray-200" />')
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      flushList(); flushTable()
      const level = headingMatch[1].length
      const cls = level === 1 ? 'text-2xl font-bold mb-4' : level === 2 ? 'text-lg font-semibold mt-6 mb-2' : 'text-base font-semibold mt-4 mb-1'
      out.push(`<h${level} class="${cls}">${inline(headingMatch[2])}</h${level}>`)
      continue
    }

    // Table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList()
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())

      // Skip separator row (|---|---|---|)
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue
      }

      if (!inTable) {
        inTable = true
        out.push('<table class="w-full text-sm border-collapse my-4"><thead><tr>')
        cells.forEach((c) => out.push(`<th class="text-left p-2 border-b border-gray-200 font-medium">${inline(c)}</th>`))
        out.push('</tr></thead><tbody>')
        continue
      }

      out.push('<tr>')
      cells.forEach((c) => out.push(`<td class="p-2 border-b border-gray-100">${inline(c)}</td>`))
      out.push('</tr>')
      continue
    } else if (inTable) {
      flushTable()
    }

    // Unordered list
    if (/^[-*]\s+/.test(line.trim())) {
      if (inList !== 'ul') { flushList(); out.push('<ul class="list-disc pl-6 space-y-1 my-2">'); inList = 'ul' }
      out.push(`<li>${inline(line.trim().replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    // Ordered list
    const olMatch = line.trim().match(/^\d+\.\s+(.*)/)
    if (olMatch) {
      if (inList !== 'ol') { flushList(); out.push('<ol class="list-decimal pl-6 space-y-1 my-2">'); inList = 'ol' }
      out.push(`<li>${inline(olMatch[1])}</li>`)
      continue
    }

    // End list if not a list item
    flushList()

    // Blank line
    if (line.trim() === '') {
      continue
    }

    // Paragraph
    out.push(`<p class="my-2 text-gray-700">${inline(line)}</p>`)
  }

  flushList()
  flushTable()

  return out.join('\n')
}
