import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Jobs', icon: '◫' },
  { to: '/clients', label: 'Clients', icon: '⊡' },
  { to: '/expenses', label: 'Expenses', icon: '⊘' },
  { to: '/rates', label: 'Rates', icon: '$' },
  { to: '/more', label: 'More', icon: '⋯' },
]

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-3 min-h-[44px] min-w-[44px] text-xs ${isActive ? 'text-primary' : 'text-gray-500'}`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
