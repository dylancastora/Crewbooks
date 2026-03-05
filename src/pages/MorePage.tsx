import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function MorePage() {
  const { user, signOut } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">More</h1>
      {user && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            )}
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        <Link to="/rates" className="block">
          <Card>Rates</Card>
        </Link>
        <Link to="/settings" className="block">
          <Card>Settings</Card>
        </Link>
      </div>
      <div className="mt-8">
        <Button variant="danger" onClick={signOut} className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  )
}
