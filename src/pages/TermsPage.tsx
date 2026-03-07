import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { renderMarkdown } from '../utils/renderMarkdown'
import termsRaw from '../../TERMS-OF-SERVICE.md?raw'

export function TermsPage() {
  const { isAuthenticated } = useAuth()
  const html = useMemo(() => renderMarkdown(termsRaw), [])
  const backTo = isAuthenticated ? '/' : '/login'

  const backButton = (
    <Link to={backTo} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 min-h-[44px] text-sm">
      ← Back
    </Link>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {backButton}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-8">{backButton}</div>
    </div>
  )
}
