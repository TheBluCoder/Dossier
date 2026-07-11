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
    <div className={`ledger-row ${priority ? 'border-gold-500/50' : ''}`}>
      <div className="flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="stamp-badge">{c.crime_type}</span>
          {priority && (
            <span className="stamp-badge border-gold-500 bg-gold-500 text-noir-950">Priority</span>
          )}
          {c.failure_count > 0 && (
            <span className="text-xs text-red-600">
              {c.failure_count} detective{c.failure_count > 1 ? 's' : ''} failed this
            </span>
          )}
        </div>
        <h3 className="font-display text-lg text-stone-100">{c.title}</h3>
        <p className="mt-1 text-sm text-stone-400">{c.summary}</p>
        <p className="mt-2 text-xs text-stone-500">
          {c.suspect_count} suspects · {c.evidence_count} evidence · {difficultyLabel(c.difficulty)} ·{' '}
          <span className="font-mono font-semibold text-gold-500">+{c.reward_rs} RS</span>
        </p>
      </div>
      <Link to={`/cases/${c.id}`} className="btn-gold shrink-0 px-4 py-2 text-sm">
        Open Case
      </Link>
    </div>
  )
}

function DraftingCard() {
  return (
    <div className="flex min-h-[6.5rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-noir-700 p-4 text-center">
      <FileText className="h-6 w-6 animate-pulse text-gold-500/50" />
      <p className="font-display text-sm text-stone-500">New case being drafted…</p>
      <p className="text-xs text-stone-500">The commission is preparing a fresh file.</p>
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
    api.getMe().then(setMe).catch(() => { })
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
      <main className="ring-holes mx-auto max-w-4xl px-6 py-8 pl-10 sm:pl-14">
        {me && (
          <div className="mb-8 flex gap-3 overflow-x-auto pb-1">
            <StatCard
              icon={Award}
              label="Rep Score"
              value={me.reputation.toLocaleString()}
              subValue={`${me.win_rate}% win rate`}
              highlight
            />
            <StatCard
              icon={Zap}
              label="Tier"
              value={me.tier.name}
              subValue={me.tier.next_tier ? `Next: ${me.tier.next_tier}` : 'Max rank'}
            />
            <StatCard icon={CheckCircle} label="Solved" value={me.cases_solved} valueClass="text-emerald-600" />
          </div>
        )}

        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">
            Case Docket
            {docket && (
              <span className="ml-2 text-sm font-normal text-stone-500">
                {cases.length} / {docket.pool_size} open
              </span>
            )}
          </h2>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {!docket && !error && <p className="py-10 text-center text-stone-500">Opening the docket…</p>}

        <div className="space-y-3">
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