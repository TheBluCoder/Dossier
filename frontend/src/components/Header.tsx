import { LogOut, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/dashboard', label: 'Cases' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/multiplayer', label: 'Versus', soon: true },
]

export default function Header({ subtitle }: { subtitle?: string }) {
  const { user, signOut } = useAuth()
  // The Clerk/Google name (`user.name`) is not the same as the player's
  // editable public display name (Profile page, leaderboard) — prefer the
  // latter here too, falling back to the auth name until it loads.
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setDisplayName(null)
      return
    }
    api.getMe().then((profile) => setDisplayName(profile.name)).catch(() => {})
  }, [user])

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b-2 border-noir-700 px-6 pt-4 shadow-[0_12px_35px_rgba(0,0,0,.35)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 pb-3">
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

        {user && (
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="detective-id group"
              aria-label={`View ${displayName ?? user.name}'s detective profile`}
            >
              <span className="detective-id-photo">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserRound className="h-4 w-4" />}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-32 truncate font-display text-xs uppercase tracking-wider text-stone-300 group-hover:text-gold-400">
                  {displayName ?? user.name}
                </span>
                <span className="block text-[8px] uppercase tracking-[.22em] text-stone-600">
                  View detective file
                </span>
              </span>
            </Link>
            <button
              onClick={signOut}
              className="p-2 text-stone-600 transition hover:text-red-400"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Case-file folder tabs — the primary navigation */}
      <nav className="folder-tabs mx-auto max-w-6xl">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `folder-tab ${isActive ? 'is-active' : ''}`}
          >
            {item.label}
            {item.soon && <span className="ml-1.5 align-super text-[8px] text-stone-600">soon</span>}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
