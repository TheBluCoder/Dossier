import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/dashboard', label: 'Cases' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/multiplayer', label: 'Versus', soon: true },
]

export default function Header({ subtitle }: { subtitle?: string }) {
  const { user, signOut } = useAuth()
  return (
    <header className="border-b border-noir-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="lamp-flicker flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-500 font-display text-lg font-bold text-gold-400 shadow-[0_0_12px_rgba(245,197,66,0.3)]">
            K
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-tight tracking-wide text-gold-400">
              DETECTIVE K
            </span>
            <span className="block text-[10px] uppercase tracking-[0.25em] text-stone-500">
              {subtitle ?? 'Private Investigations'}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group relative pb-1 font-display text-sm uppercase tracking-widest transition ${
                  isActive ? 'text-gold-400' : 'text-stone-400 hover:text-gold-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {item.soon && (
                    <span className="ml-1 align-super text-[8px] uppercase tracking-widest text-stone-600">
                      soon
                    </span>
                  )}
                  <span
                    className={`absolute bottom-0 left-0 h-px bg-gold-500 transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-3 text-sm text-stone-400">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full border-2 border-gold-500/60 grayscale"
              />
            )}
            <span className="hidden sm:inline">{user.name}</span>
            <button onClick={signOut} className="text-stone-500 hover:text-gold-400">
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Mobile nav */}
      <nav className="mt-3 flex gap-5 md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `font-display text-xs uppercase tracking-widest ${
                isActive ? 'text-gold-400' : 'text-stone-500'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
