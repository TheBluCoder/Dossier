import { Award, CheckCircle, FilePlus, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import StatCard from '../components/StatCard'
import { api } from '../lib/api'
import type { CaseSummary, UserProfile } from '../types'

const DIFFICULTY_LABELS = ['Trivial', 'Easy', 'Moderate', 'Hard', 'Brutal']

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
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            {c.suspect_count} suspects · {difficultyLabel(c.difficulty)}
          </span>
          <Link to={`/cases/${c.id}`} className="btn-gold px-3 py-1.5 text-sm">
            Open Case
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [me, setMe] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const loadCases = () => api.listCases().then(setCases).catch((e) => setError(e.message))

  useEffect(() => {
    loadCases()
    api.getMe().then(setMe).catch(() => {})
  }, [])

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      await api.generateCase()
      await loadCases()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

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
            <span className="text-sm normal-case tracking-normal text-stone-500">
              {cases.length} active
            </span>
          </h2>
          <button onClick={generate} disabled={generating} className="btn-ghost flex items-center gap-2 text-sm">
            <FilePlus className="h-4 w-4" />
            {generating ? 'Generating… (10-30s)' : 'Generate Case'}
          </button>
        </div>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {cases.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-noir-700 py-10 text-center text-stone-500">
            No cases on the board. Generate one to get started.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c, i) => (
            <CaseCard key={c.id} c={c} priority={i === 0} />
          ))}
        </div>
      </main>
    </div>
  )
}
