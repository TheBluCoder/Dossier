import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Header({ subtitle }: { subtitle?: string }) {
  const { user, signOut } = useAuth()
  return (
    <header className="flex items-center justify-between border-b border-noir-700 px-6 py-4">
      <Link to="/dashboard" className="font-display text-xl font-bold tracking-wide text-gold-400">
        DETECTIVE K{subtitle && <span className="ml-3 text-sm font-normal text-stone-400">{subtitle}</span>}
      </Link>
      {user && (
        <div className="flex items-center gap-3 text-sm text-stone-400">
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />}
          <span>{user.name}</span>
          <button onClick={signOut} className="text-stone-500 hover:text-gold-400">
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
