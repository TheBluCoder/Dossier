import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import SuspectPortrait from '../components/SuspectPortrait'
import { api } from '../lib/api'
import { conversationalTime } from '../lib/time'
import type { CaseBriefing } from '../types'

export default function Briefing() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [briefing, setBriefing] = useState<CaseBriefing | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [beginError, setBeginError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (caseId) api.getCaseBriefing(caseId).then(setBriefing).catch((e) => setLoadError(e.message))
  }, [caseId])

  const begin = async () => {
    if (!caseId) return
    setStarting(true)
    setBeginError(null)
    try {
      const inv = await api.createInvestigation(caseId)
      navigate(`/investigations/${inv.id}`)
    } catch (e) {
      // Claim conflicts and the active-case cap are expected, not fatal — keep
      // the briefing visible so the player can back out to the dashboard.
      setBeginError((e as Error).message)
      setStarting(false)
    }
  }

  if (loadError) return <div className="p-10 text-center text-red-400">{loadError}</div>
  if (!briefing) return <div className="p-10 text-center text-stone-500">Opening case file…</div>

  return (
    <div className="archive-page min-h-screen">
      <Header subtitle="Case Briefing" />
      <main className="archive-sheet mx-auto max-w-6xl space-y-8 px-5 py-8 lg:px-8">
        <div className="briefing-cover">
          <div><p className="text-[9px] uppercase tracking-[.4em] text-[#73573b]">Official commission brief / Eyes only</p><h2 className="mt-3 font-display text-4xl font-bold uppercase text-[#291b12]">{briefing.title}</h2><p className="mt-4 max-w-3xl font-serif text-base leading-7 text-[#443022]">{briefing.summary}</p></div>
          <span className="folder-stamp shrink-0">Unsolved</span>
        </div>

        <section className="grid gap-px border border-noir-700 bg-noir-700 md:grid-cols-2">
          <div className="briefing-entry">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Victim</h3>
            <p className="font-semibold text-stone-100">
              {briefing.victim.name}, {briefing.victim.age} — {briefing.victim.occupation}
            </p>
            <p className="mt-2 text-sm text-stone-400">{briefing.victim.background}</p>
          </div>
          <div className="briefing-entry">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">Crime Scene</h3>
            <p className="font-semibold text-stone-100">
              {briefing.crime_scene.location} · {conversationalTime(briefing.crime_scene.time)}
            </p>
            <p className="mt-2 text-sm text-stone-400">{conversationalTime(briefing.crime_scene.description)}</p>
          </div>
        </section>

        <section className="panel border-l-4 border-l-red-950">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">Initial Timeline</h3>
          <ul className="space-y-2">
            {briefing.public_timeline.map((t, i) => (
              <li key={i} className="flex gap-4 text-sm">
                <span className="w-20 shrink-0 font-mono text-gold-400">{conversationalTime(t.time)}</span>
                <span className="text-stone-300">{conversationalTime(t.event)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="section-title mb-5 text-base">
            Suspects ({briefing.suspects.length})
          </h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {briefing.suspects.map((s) => (
              <div key={s.id} className="suspect-paper cursor-default">
                <span className="suspect-paper-clip" aria-hidden />
                <SuspectPortrait name={s.name} imageUrl={s.image_url} />
                <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.24em] text-[#6b5138]">Suspect intake</p><p className="mt-1 font-display text-lg font-bold uppercase text-[#2a1c12]">{s.name}</p>
                <p className="text-[10px] uppercase text-[#5c4330]">
                  {s.age} · {s.occupation}
                </p>
                <p className="mt-3 font-serif text-xs leading-5 text-[#443022]">{s.relationship}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-noir-700 pt-6">
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

        {beginError && (
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {beginError}{' '}
            <Link to="/dashboard" className="font-bold text-gold-400 underline">
              Back to the docket
            </Link>
          </div>
        )}
        <button onClick={begin} disabled={starting} className="btn-gold w-full py-3 text-lg">
          {starting ? 'Opening investigation…' : 'Begin Investigation'}
        </button>
      </main>
    </div>
  )
}
