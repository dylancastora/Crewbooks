import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { OnboardingPrompt } from '../OnboardingPrompt'

export function AppShell() {
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <OnboardingPrompt />
    </div>
  )
}
