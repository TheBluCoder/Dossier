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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="font-display text-5xl font-bold tracking-wider text-gold-400">DETECTIVE K</h1>
        <p className="mt-4 max-w-md text-stone-400">
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
            Continue as Guest
          </button>
          <p className="text-xs text-stone-600">
            Dev mode — set VITE_CLERK_PUBLISHABLE_KEY to enable Google Sign-In
          </p>
        </div>
      )}
    </div>
  )
}
