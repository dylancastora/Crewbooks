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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-primary mb-2">CrewBooks</h1>
        <p className="text-gray-500 mb-8">Freelance invoicing for film & TV</p>
        {isLoading ? (
          <Spinner className="py-4" />
        ) : (
          <Button onClick={handleSignIn} className="w-full">
            Sign in with Google
          </Button>
        )}
      </div>
    </div>
  )
}
