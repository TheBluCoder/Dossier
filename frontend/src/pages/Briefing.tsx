import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { api } from '../lib/api'
import type { CaseBriefing } from '../types'

export default function Briefing() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [briefing, setBriefing] = useState<CaseBriefing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (caseId) api.getCaseBriefing(caseId).then(setBriefing).catch((e) => setError(e.message))
  }, [caseId])

  const begin = async () => {
    if (!caseId) return
    setStarting(true)
    try {
      const inv = await api.createInvestigation(caseId)
      navigate(`/investigations/${inv.id}`)
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  if (error) return <div className="p-10 text-center text-red-400">{error}</div>
  if (!briefing) return <div className="p-10 text-center text-stone-500">Opening case file…</div>

  return (
    <div className="min-h-screen">
      <Header subtitle="Case Briefing" />
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h2 className="font-display text-3xl text-gold-400">{briefing.title}</h2>
          <p className="mt-2 text-stone-300">{briefing.summary}</p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="panel">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Victim</h3>
            <p className="font-semibold text-stone-100">
              {briefing.victim.name}, {briefing.victim.age} — {briefing.victim.occupation}
            </p>
            <p className="mt-2 text-sm text-stone-400">{briefing.victim.background}</p>
          </div>
          <div className="panel">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Crime Scene</h3>
            <p className="font-semibold text-stone-100">
              {briefing.crime_scene.location} · {briefing.crime_scene.time}
            </p>
            <p className="mt-2 text-sm text-stone-400">{briefing.crime_scene.description}</p>
          </div>
        </section>

        <section className="panel">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">Initial Timeline</h3>
          <ul className="space-y-2">
            {briefing.public_timeline.map((t, i) => (
              <li key={i} className="flex gap-4 text-sm">
                <span className="w-16 shrink-0 font-mono text-gold-400">{t.time}</span>
                <span className="text-stone-300">{t.event}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
            Suspects ({briefing.suspects.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {briefing.suspects.map((s) => (
              <div key={s.id} className="panel">
                <p className="font-display text-lg text-stone-100">{s.name}</p>
                <p className="text-xs text-stone-500">
                  {s.age} · {s.occupation}
                </p>
                <p className="mt-2 text-sm text-stone-400">{s.relationship}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
            Initial Evidence ({briefing.evidence.length})
          </h3>
          <ul className="space-y-1 text-sm text-stone-300">
            {briefing.evidence.map((e) => (
              <li key={e.id}>
                <span className="text-gold-400">▪</span> {e.title}
                <span className="ml-2 text-xs uppercase text-stone-600">{e.type}</span>
              </li>
            ))}
          </ul>
        </section>

        <button onClick={begin} disabled={starting} className="btn-gold w-full py-3 text-lg">
          {starting ? 'Opening investigation…' : 'Begin Investigation'}
        </button>
      </main>
    </div>
  )
}
