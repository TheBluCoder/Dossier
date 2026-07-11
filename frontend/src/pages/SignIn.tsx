import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function SignIn() {
  const { user, ready, mode, signIn, signInAsGuest } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && user) navigate('/dashboard', { replace: true })
  }, [ready, user, navigate])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center">
      <span className="pointer-events-none absolute left-[8%] top-[15%] font-display text-[18rem] text-red-950/10">K</span>
      <div className="relative max-w-2xl border-y border-noir-700 px-8 py-12">
        <span className="case-stamp mb-6">Restricted archive</span>
        <p className="mb-3 text-xs uppercase tracking-[.45em] text-stone-600">The Commission presents</p>
        <h1 className="font-display text-5xl font-bold tracking-[.15em] text-gold-400 sm:text-7xl">DETECTIVE <span className="text-stone-100">K</span></h1>
        <div className="blood-rule mx-auto mt-5 max-w-xs" />
        <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-stone-400">
          The commission has cases waiting. Interrogate the suspects, follow the
          evidence, name the culprit.
        </p>
      </div>
      {mode === 'clerk' ? (
        <button onClick={signIn} className="btn-gold text-lg">
          Continue with Google
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <button onClick={signInAsGuest} className="btn-gold text-lg">
            Enter the Archive
          </button>
          <p className="text-xs text-stone-600">
            Dev mode — set VITE_CLERK_PUBLISHABLE_KEY to enable Google Sign-In
          </p>
        </div>
      )}
    </div>
  )
}
