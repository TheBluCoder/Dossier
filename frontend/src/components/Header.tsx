import { LogOut, UserRound } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/dashboard', label: 'Cases' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/multiplayer', label: 'Versus', soon: true },
]

export default function Header({ subtitle }: { subtitle?: string }) {
  const { user, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-noir-700 px-6 py-4 shadow-[0_12px_35px_rgba(0,0,0,.35)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="lamp-flicker flex h-10 w-10 -rotate-3 items-center justify-center border-2 border-gold-500 font-display text-xl font-bold text-gold-400 shadow-[0_0_16px_rgba(141,23,24,.45)]">
            K
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-tight tracking-wide text-gold-400">
              DETECTIVE <span className="text-stone-100">K</span>
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
          <div className="flex items-center gap-2">
            <Link to="/profile" className="detective-id group" aria-label={`View ${user.name}'s detective profile`}>
              <span className="detective-id-photo">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserRound className="h-4 w-4" />}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-32 truncate font-display text-xs uppercase tracking-wider text-stone-300 group-hover:text-gold-400">{user.name}</span>
                <span className="block text-[8px] uppercase tracking-[.22em] text-stone-600">View detective file</span>
              </span>
            </Link>
            <button onClick={signOut} className="p-2 text-stone-600 transition hover:text-red-400" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile nav */}
      <nav className="mx-auto mt-3 flex max-w-6xl gap-5 border-t border-noir-800 pt-3 md:hidden">
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
