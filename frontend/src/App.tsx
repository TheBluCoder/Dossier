import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import Briefing from './pages/Briefing'
import Investigation from './pages/Investigation'
import Interrogation from './pages/Interrogation'
import Accusation from './pages/Accusation'
import Resolution from './pages/Resolution'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Multiplayer from './pages/Multiplayer'

const NAV = [
  { to: '/dashboard', label: 'Cases' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/multiplayer', label: 'Versus', soon: true },
]

function RequireAuth() {
  const { user, ready } = useAuth()
  if (!ready) return <div className="p-10 text-center text-stone-500">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return <Outlet />
}

/** Brand + account row — sits on the desk, outside the folder entirely. */
function DeskHeader() {
  const { user, signOut } = useAuth()
  return (
    <div className="mx-auto mb-3 flex max-w-[1180px] items-center justify-between px-2">
      <NavLink to="/dashboard" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400 font-display text-base text-gold-400">
          K
        </span>
        <span className="font-display text-lg text-noir-950">Detective K</span>
      </NavLink>
      {user && (
        <div className="flex items-center gap-3 text-sm text-noir-700">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-noir-700" />
          )}
          <span className="hidden sm:inline">{user.name}</span>
          <button onClick={signOut} className="transition hover:text-gold-400">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** The nav — rendered as the folder's own cut tabs, not a separate bar. */
function FolderTabs() {
  return (
    <nav className="folder-tabs">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `folder-tab ${isActive ? 'is-active' : ''}`}
        >
          {item.label}
          {item.soon && <span className="ml-1.5 text-[9px] uppercase text-stone-500">soon</span>}
        </NavLink>
      ))}
    </nav>
  )
}

/** Shared layout for every route: desk → brand → folder → tabs → page. */
function AppShell() {
  const { user } = useAuth()
  return (
    <div className="desk">
      {user && <DeskHeader />}
      <div className="folder-shell">
        {user && <FolderTabs />}
        <div className="folder-page">
          <div className="film-grain" aria-hidden />
          <div className="paper-worn" aria-hidden />
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<SignIn />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/multiplayer" element={<Multiplayer />} />
          <Route path="/cases/:caseId" element={<Briefing />} />
          <Route path="/investigations/:id" element={<Investigation />} />
          <Route path="/investigations/:id/interrogate/:suspectId" element={<Interrogation />} />
          <Route path="/investigations/:id/accuse" element={<Accusation />} />
          <Route path="/investigations/:id/resolution" element={<Resolution />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}