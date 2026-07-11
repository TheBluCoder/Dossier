/**
 * Auth abstraction. Two modes:
 * - Clerk (Google Sign-In) when VITE_CLERK_PUBLISHABLE_KEY is set.
 * - Guest mode otherwise — pairs with the backend's DEV_AUTH_BYPASS.
 * Pages only ever consume useAuth(); they never import Clerk directly.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ClerkProvider, useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react'
import { setTokenProvider } from './api'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

export interface AuthUser {
  id: string
  name: string
  avatarUrl?: string
}

interface AuthContextValue {
  mode: 'clerk' | 'guest'
  ready: boolean
  user: AuthUser | null
  signInAsGuest: () => void
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

function GuestAuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(() => localStorage.getItem('guest') === '1')

  useEffect(() => {
    setTokenProvider(async () => 'dev')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'guest',
      ready: true,
      user: signedIn ? { id: 'dev-user', name: 'Guest Detective' } : null,
      signInAsGuest: () => {
        localStorage.setItem('guest', '1')
        setSignedIn(true)
      },
      signIn: () => {
        localStorage.setItem('guest', '1')
        setSignedIn(true)
      },
      signOut: () => {
        localStorage.removeItem('guest')
        setSignedIn(false)
      },
    }),
    [signedIn],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth()
  const { user } = useUser()
  const clerk = useClerk()

  useEffect(() => {
    setTokenProvider(() => getToken())
  }, [getToken])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'clerk',
      ready: isLoaded,
      user:
        isSignedIn && user
          ? {
              id: user.id,
              name: user.fullName ?? user.username ?? 'Detective',
              avatarUrl: user.imageUrl,
            }
          : null,
      signInAsGuest: () => {},
      signIn: () => clerk.openSignIn(),
      signOut: () => clerk.signOut(),
    }),
    [isLoaded, isSignedIn, user, clerk],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_KEY) return <GuestAuthProvider>{children}</GuestAuthProvider>
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  )
}
