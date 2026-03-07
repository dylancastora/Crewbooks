import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { renderMarkdown } from '../utils/renderMarkdown'
import termsRaw from '../../TERMS-OF-SERVICE.md?raw'

export function TermsPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const html = useMemo(() => renderMarkdown(termsRaw), [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {isAuthenticated && (
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center text-xl mb-4">
          ←
        </button>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
