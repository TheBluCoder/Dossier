import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Meter from '../components/Meter'
import { useInvestigationStore } from '../store/investigationStore'
import type { Evidence } from '../types'

function EvidenceDetail({ item }: { item: Evidence }) {
  return (
    <div className="panel">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="font-display text-lg text-gold-400">{item.title}</h4>
        <span className="text-xs uppercase text-stone-600">{item.type}</span>
      </div>
      {item.timestamp && <p className="mb-2 text-xs text-stone-500">{item.timestamp}</p>}
      <p className="whitespace-pre-wrap text-sm text-stone-300">{item.description}</p>
      {item.media_url && (
        <video src={item.media_url} controls className="mt-3 w-full rounded border border-noir-700" />
      )}
    </div>
  )
}

export default function Investigation() {
  const { id } = useParams<{ id: string }>()
  const { investigation, suspects, evidence, loading, error, load, markEvidenceReviewed, saveNotes } =
    useInvestigationStore()
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (id) load(id)
  }, [id, load])

  useEffect(() => {
    setNotes(investigation?.notes ?? '')
  }, [investigation?.id])

  const onNotesChange = (value: string) => {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => saveNotes(value), 800)
  }

  const openEvidence = (item: Evidence) => {
    setSelectedEvidence(item)
    if (!item.reviewed) markEvidenceReviewed(item.id)
  }

  if (loading || !investigation)
    return <div className="p-10 text-center text-stone-500">{error ?? 'Loading investigation…'}</div>

  const briefing = investigation.case

  return (
    <div className="min-h-screen">
      <Header subtitle={briefing?.title} />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
        {/* Suspects */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">Suspects</h3>
          {suspects.map((s) => (
            <div key={s.id} className="panel">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg text-stone-100">{s.name}</p>
                  <p className="text-xs text-stone-500">
                    {s.age} · {s.occupation}
                  </p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-stone-400">{s.personality}</p>
              <div className="mt-3 flex gap-4">
                <Meter label="Trust" value={s.state?.trust ?? 50} />
                <Meter label="Patience" value={s.state?.patience ?? 100} />
              </div>
              {s.state?.conversation_ended ? (
                <p className="mt-3 text-sm text-red-400">Refuses to talk.</p>
              ) : (
                <Link
                  to={`/investigations/${investigation.id}/interrogate/${s.id}`}
                  className="btn-gold mt-3 inline-block px-3 py-1.5 text-sm"
                >
                  Interrogate
                </Link>
              )}
            </div>
          ))}
        </section>

        {/* Evidence */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Evidence ({evidence.filter((e) => e.reviewed).length}/{evidence.length} reviewed)
          </h3>
          <div className="space-y-2">
            {evidence.map((e) => (
              <button
                key={e.id}
                onClick={() => openEvidence(e)}
                className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                  selectedEvidence?.id === e.id
                    ? 'border-gold-500 bg-noir-800 text-gold-400'
                    : 'border-noir-700 bg-noir-900 text-stone-300 hover:border-stone-500'
                }`}
              >
                <span className={e.reviewed ? 'text-stone-500' : 'text-gold-400'}>
                  {e.reviewed ? '☑' : '☐'}
                </span>{' '}
                {e.title}
              </button>
            ))}
          </div>
          {selectedEvidence && <EvidenceDetail item={selectedEvidence} />}
        </section>

        {/* Notes + actions */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">Case Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Contradictions, timelines, hunches… (auto-saved)"
            className="input-noir h-64 resize-none font-mono text-sm"
          />
          {investigation.verdict_submitted ? (
            <Link
              to={`/investigations/${investigation.id}/resolution`}
              className="btn-ghost block w-full py-3 text-center"
            >
              View Case Resolution
            </Link>
          ) : (
            <Link
              to={`/investigations/${investigation.id}/accuse`}
              className="btn-gold block w-full py-3 text-center text-lg"
            >
              Submit Final Accusation
            </Link>
          )}
        </section>
      </main>
    </div>
  )
}
