import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/jobs', label: 'Jobs', icon: '◫' },
  { to: '/clients', label: 'Clients', icon: '⊡' },
  { to: '/expenses', label: 'Expenses', icon: '⊘' },
  { to: '/rates', label: 'Rates', icon: '$' },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <>
          <link href="https://fonts.googleapis.com/css2?family=Londrina+Sketch&display=swap" rel="stylesheet" />
          <h1 style={{ fontFamily: "'Londrina Sketch', Sans-Serif" }} className="text-4xl font-extrabold text-primary mb-2">Crewbooks</h1>
        </>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium ${isActive ? 'text-primary bg-primary/5 border-r-2 border-primary' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 min-h-[44px] text-sm font-medium border-t border-gray-200 ${isActive ? 'text-primary bg-primary/5' : 'text-gray-600 hover:bg-gray-50'}`
        }
      >
        <span className="text-lg">⚙</span>
        Settings
      </NavLink>
    </aside>
  )
}
