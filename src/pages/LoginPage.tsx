import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export function LoginPage() {
  const { signIn, isLoading } = useAuth()
  const navigate = useNavigate()

  const handleSignIn = async () => {
    try {
      await signIn()
      navigate('/')
    } catch (err) {
      console.error('Sign in failed:', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 px-4">
      <div className="flex-1 flex flex-col items-center justify-center">
      <div className="mt-8 bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <>
          <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800&display=swap" rel="stylesheet" />
          <div className="flex items-center justify-center mb-2 max-w-sm mx-auto">
            <svg style={{ width: '80%', height: 'auto' }} viewBox="0 0 248 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="13.39" width="7.3" height="12.17" rx="1.82" fill="#2563EB" opacity="0.4"/>
              <rect x="11.3" y="6.09" width="7.3" height="19.47" rx="1.82" fill="#2563EB" opacity="0.65"/>
              <rect x="22.6" y="0" width="7.3" height="25.56" rx="1.82" fill="#2563EB"/>
              <text x="41.9" y="25.56" font-family="Rubik, sans-serif" font-weight="800" font-size="36" fill="black">Crewbooks</text>
            </svg>
          </div>
        </>
        <p className="text-gray-500 italic mb-8">Bookkeeping and invoicing for film industry freelancers</p>
        <ul className="text-gray-500 mb-8 list space-y-3">
            <li>Free and&nbsp;
            <a
              href="https://www.github.com/dylancastora/crewbooks"
              className="text-primary underline"
              target="_blank" rel="noopener noreferrer"
              >Open Source</a>
            </li>
            <li>Privacy focused, no data lock-in</li>
            <li>Track clients, jobs, expenses, rates, quotes and invoices</li>
        </ul>
        {isLoading ? (
            <Spinner className="py-4" />
        ) : (
            <Button onClick={handleSignIn} className="w-full px-6 !py-3 font-semibold">
            Sign in with Google
            </Button>
        )}
        </div>
      <div className="mt-8 rounded-2xl shadow-lg p-8 w-full max-w-sm text-center" style={{ background: 'linear-gradient(135deg, #2563EB, #1e40af)' }}>
        <p className="text-blue-100">Created by&nbsp;
          <a
            href="https://www.imdb.com/name/nm13328053/"
            className="text-white underline"
            target="_blank" rel="noopener noreferrer"
          >Dylan Castora</a>
        , Sound Mixer</p>
        <p className="text-blue-100">Working in Boston?&nbsp;
          <a
            href="mailto:dylancastora@gmail.com"
            className="text-white underline mt-2 inline-block"
            target="_blank" rel="noopener noreferrer"
          > Book Me!</a>
        </p>
        <a
          href="https://ko-fi.com/dylancastora"
          className="mt-4 inline-block w-full px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          target="_blank" rel="noopener noreferrer"
        >Support Crewbooks</a>
      </div>
      <div className="mt-8 mb-8 bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <h2 className="font-semibold text-gray-800 mb-3">How Crewbooks Works</h2>
        <p className="text-gray-500">Crewbooks creates a spreadsheet in your Google Drive to use as its database, stores receipt photos in your Drive, and sends quotes and invoices from your Gmail. No data ever touches a third-party server — everything stays in your Google account.</p>
        <p className="text-gray-500 mt-4">
          <Link to="/terms-of-service" className="underline">Terms of Service</Link>
          {' · '}
          <Link to="/privacy-policy" className="underline">Privacy Policy</Link>
        </p>
      </div>
      </div>
    </div>
  )
}
