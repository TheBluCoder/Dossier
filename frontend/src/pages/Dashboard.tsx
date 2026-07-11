import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { api } from '../lib/api'
import type { CaseSummary } from '../types'

const DIFFICULTY_LABELS = ['Trivial', 'Easy', 'Moderate', 'Hard', 'Brutal']

function difficultyLabel(d: number) {
  return DIFFICULTY_LABELS[Math.min(4, Math.floor((d - 1) / 2))]
}

export default function Dashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const loadCases = () => api.listCases().then(setCases).catch((e) => setError(e.message))

  useEffect(() => {
    loadCases()
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
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-stone-100">Available Cases</h2>
          <button onClick={generate} disabled={generating} className="btn-ghost text-sm">
            {generating ? 'Generating… (10-30s)' : '+ Generate Case'}
          </button>
        </div>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        {cases.length === 0 && !error && (
          <p className="text-stone-500">No cases on the board. Generate one to get started.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c) => (
            <div key={c.id} className="panel flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg text-gold-400">{c.title}</h3>
                <span className="rounded bg-noir-700 px-2 py-0.5 text-xs uppercase tracking-wide text-stone-400">
                  {c.crime_type}
                </span>
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
          ))}
        </div>
      </main>
    </div>
  )
}
