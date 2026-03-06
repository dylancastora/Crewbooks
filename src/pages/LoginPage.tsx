import { useNavigate } from 'react-router-dom'
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
      console.error('Sign in failed:', err)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-12 w-full max-w-sm text-center">
          <h1 className="text-3xl font-extrabold text-primary mb-2">Crewbooks</h1>
        <p className="text-gray-500 italic mb-8">A lightweight operations manager for Filmmakers</p>
        <ul className="text-gray-500 mb-8 list space-y-3">
            <li>Free and open source</li>
            <li>Track clients, jobs, expenses, rates, quotes and invoices</li>
            <li>Your data lives entirely inside your Google Workspace, under your control</li>
        </ul>
        {isLoading ? (
            <Spinner className="py-4" />
        ) : (
            <Button onClick={handleSignIn} className="w-full">
            Sign in with Google
            </Button>
        )}
        </div>
      <div className="mt-8">
        <p className="text-gray-500 mt-auto">Created by&nbsp;
          <a
            href="https://dylancastora.com"
            className="text-primary underline"
            target="_blank" rel="noopener noreferrer"
          >Dylan Castora</a>
        , Sound Mixer</p>
      </div>
    </div>
  )
}
