import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { generateTestData } from '../services/api/seedData'

export function MorePage() {
  const { user, signOut, spreadsheetId, getToken } = useAuth()
  const [generating, setGenerating] = useState(false)

  const handleGenerateTestData = async () => {
    if (!spreadsheetId) return
    setGenerating(true)
    try {
      const token = await getToken()
      await generateTestData(spreadsheetId, token)
      window.location.reload()
    } catch (err) {
      console.error('Failed to generate test data:', err)
      setGenerating(false)
    }
  }

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
      <div className="mt-8 space-y-3">
        <Button variant="secondary" onClick={handleGenerateTestData} disabled={generating} className="w-full">
          {generating ? 'Generating...' : 'Generate Test Data'}
        </Button>
        <Button variant="danger" onClick={signOut} className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  )
}
