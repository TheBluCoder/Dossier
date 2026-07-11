import { Award, CheckCircle, FileText, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import StatCard from '../components/StatCard'
import { api } from '../lib/api'
import type { CaseDocket, CaseSummary, UserProfile } from '../types'

const DIFFICULTY_LABELS = ['Trivial', 'Easy', 'Moderate', 'Hard', 'Brutal']
const POLL_INTERVAL_MS = 8000

function difficultyLabel(d: number) {
  return DIFFICULTY_LABELS[Math.min(4, Math.floor((d - 1) / 2))]
}

function CaseCard({ c, priority }: { c: CaseSummary; priority: boolean }) {
  return (
    <div className={`relative ${priority ? 'rounded-lg' : ''}`}>
      {priority && (
        <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-gold-500/40 via-gold-400/30 to-gold-500/40 blur-sm" />
      )}
      <div className="panel relative flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg text-gold-400">{c.title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded bg-noir-700 px-2 py-0.5 text-xs uppercase tracking-wide text-stone-400">
              {c.crime_type}
            </span>
            {priority && (
              <span className="rounded bg-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-noir-950">
                Priority
              </span>
            )}
          </div>
        </div>
        <p className="flex-1 text-sm text-stone-400">{c.summary}</p>
        {c.failure_count > 0 && (
          <p className="text-xs text-red-400/80">
            ⚠ {c.failure_count} detective{c.failure_count > 1 ? 's have' : ' has'} failed this case
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            {c.suspect_count} suspects · {c.evidence_count} evidence ·{' '}
            {difficultyLabel(c.difficulty)} ·{' '}
            <span className="font-mono font-bold text-gold-400">+{c.reward_rs} RS</span>
          </span>
          <Link to={`/cases/${c.id}`} className="btn-gold px-3 py-1.5 text-sm">
            Open Case
          </Link>
        </div>
      </div>
    </div>
  )
}

function DraftingCard() {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-noir-700 p-4 text-center">
      <FileText className="h-6 w-6 animate-pulse text-gold-500/60" />
      <p className="font-display text-sm uppercase tracking-widest text-stone-500">
        New case being drafted
      </p>
      <p className="text-xs text-stone-600">The commission is preparing a fresh file…</p>
    </div>
  )
}

export default function Dashboard() {
  const [docket, setDocket] = useState<CaseDocket | null>(null)
  const [me, setMe] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval>>(null)

  useEffect(() => {
    const loadDocket = () => api.listCases().then(setDocket).catch((e) => setError(e.message))
    loadDocket()
    api.getMe().then(setMe).catch(() => {})
    // While the pool is below target, new cases appear as Gemini finishes them.
    pollTimer.current = setInterval(loadDocket, POLL_INTERVAL_MS)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  const cases = docket?.entries ?? []
  const missing = docket ? Math.max(0, docket.pool_size - cases.length) : 0

  return (
    <div className="min-h-screen">
      <Header subtitle="Commission Dashboard" />
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Stat row */}
        {me && (
          <div className="mb-8 flex gap-3 overflow-x-auto pb-1">
            <StatCard
              icon={Award}
              label="Rep Score"
              value={me.reputation.toLocaleString()}
              subValue={`${me.win_rate}% win rate`}
              highlight
            />
            <StatCard icon={Zap} label="Tier" value={me.tier.name} subValue={me.tier.next_tier ? `Next: ${me.tier.next_tier}` : 'Max rank'} />
            <StatCard icon={CheckCircle} label="Solved" value={me.cases_solved} valueClass="text-emerald-400" />
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title lamp-flicker">
            Case Docket
            {docket && (
              <span className="text-sm normal-case tracking-normal text-stone-500">
                {cases.length} / {docket.pool_size} open
              </span>
            )}
          </h2>
        </div>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {!docket && !error && <p className="py-10 text-center text-stone-500">Opening the docket…</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c, i) => (
            <CaseCard key={c.id} c={c} priority={i === 0} />
          ))}
          {Array.from({ length: missing }, (_, i) => (
            <DraftingCard key={`drafting-${i}`} />
          ))}
        </div>
      </main>
    </div>
  )
}
