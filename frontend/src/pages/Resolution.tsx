import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { api } from '../lib/api'
import { useInvestigationStore } from '../store/investigationStore'
import type { Resolution as ResolutionData } from '../types'

export default function Resolution() {
  const { id } = useParams<{ id: string }>()
  const { suspects, load, investigation } = useInvestigationStore()
  const [resolution, setResolution] = useState<ResolutionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (!investigation) load(id)
    api.getResolution(id).then(setResolution).catch((e) => setError(e.message))
  }, [id])

  if (error) return <div className="p-10 text-center text-red-400">{error}</div>
  if (!resolution) return <div className="p-10 text-center text-stone-500">Opening the sealed file…</div>

  const suspectName = (sid: string) => suspects.find((s) => s.id === sid)?.name ?? sid

  return (
    <div className="archive-page min-h-screen">
      <Header subtitle="Case Resolution" />
      <main className="archive-sheet mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div
          className={`panel border-2 text-center ${
            resolution.correct ? 'border-emerald-500' : 'border-red-500'
          }`}
        >
          <p className="font-display text-3xl">
            {resolution.correct ? '✔ CASE SOLVED' : '✘ WRONG ACCUSATION'}
          </p>
          <p className="mt-2 text-stone-400">
            You accused <span className="text-stone-100">{suspectName(resolution.accused_id)}</span>.
            The culprit was{' '}
            <span className="text-gold-400">{resolution.culprit?.name ?? 'unknown'}</span>.
          </p>
          {resolution.reputation_change !== undefined && (
            <p
              className={`mt-3 font-mono text-lg font-bold ${
                resolution.reputation_change >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {resolution.reputation_change >= 0 ? '+' : ''}
              {resolution.reputation_change} Reputation
            </p>
          )}
        </div>

        {resolution.analysis && (
          <section className="panel">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
              Commission review
            </h3>
            <p className="text-sm italic text-stone-300">{resolution.analysis}</p>
          </section>
        )}

        <section className="panel">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">
            What actually happened
          </h3>
          <p className="mb-3 text-sm text-stone-300">{resolution.explanation}</p>
          <p className="text-sm text-stone-400">
            <span className="text-gold-400">Motive:</span> {resolution.motive}
          </p>
        </section>

        <section className="panel">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
            True timeline
          </h3>
          <ul className="space-y-2">
            {resolution.canonical_timeline.map((t, i) => (
              <li key={i} className="flex gap-4 text-sm">
                <span className="w-16 shrink-0 font-mono text-gold-400">{t.time}</span>
                <span className="text-stone-300">{t.event}</span>
              </li>
            ))}
          </ul>
        </section>

        {Object.keys(resolution.suspect_secrets).length > 0 && (
          <section className="panel">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
              Why the innocent looked guilty
            </h3>
            <ul className="space-y-2 text-sm text-stone-300">
              {Object.entries(resolution.suspect_secrets).map(([sid, secret]) => (
                <li key={sid}>
                  <span className="text-stone-100">{suspectName(sid)}:</span> {secret}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
            Key clues
          </h3>
          <ul className="space-y-1 text-sm text-stone-300">
            {resolution.key_clues.map((clue, i) => (
              <li key={i}>
                <span className="text-gold-400">▪</span> {clue}
              </li>
            ))}
          </ul>
        </section>

        <Link to="/dashboard" className="btn-gold block w-full py-3 text-center text-lg">
          Back to the Commission
        </Link>
      </main>
    </div>
  )
}
