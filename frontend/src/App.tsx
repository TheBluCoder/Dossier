import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import Briefing from './pages/Briefing'
import Investigation from './pages/Investigation'
import Interrogation from './pages/Interrogation'
import Accusation from './pages/Accusation'
import Resolution from './pages/Resolution'

function RequireAuth() {
  const { user, ready } = useAuth()
  if (!ready) return <div className="p-10 text-center text-stone-500">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cases/:caseId" element={<Briefing />} />
        <Route path="/investigations/:id" element={<Investigation />} />
        <Route path="/investigations/:id/interrogate/:suspectId" element={<Interrogation />} />
        <Route path="/investigations/:id/accuse" element={<Accusation />} />
        <Route path="/investigations/:id/resolution" element={<Resolution />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
