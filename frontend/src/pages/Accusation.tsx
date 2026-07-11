import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { api } from '../lib/api'
import { useInvestigationStore } from '../store/investigationStore'

export default function Accusation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { investigation, suspects, evidence, load } = useInvestigationStore()

  const [accusedId, setAccusedId] = useState('')
  const [motive, setMotive] = useState('')
  const [explanation, setExplanation] = useState('')
  const [evidenceIds, setEvidenceIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id && !investigation) load(id)
  }, [id, investigation, load])

  const toggleEvidence = (evidenceId: string) =>
    setEvidenceIds((ids) =>
      ids.includes(evidenceId) ? ids.filter((x) => x !== evidenceId) : [...ids, evidenceId],
    )

  const submit = async () => {
    if (!id || !accusedId || !motive.trim() || !explanation.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.submitVerdict(id, {
        accused_id: accusedId,
        motive,
        explanation,
        evidence_ids: evidenceIds,
      })
      navigate(`/investigations/${id}/resolution`)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  if (!investigation) return <div className="p-10 text-center text-stone-500">Loading…</div>

  return (
    <div className="min-h-screen">
      <Header subtitle="Final Accusation" />
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <div>
          <h2 className="font-display text-2xl text-gold-400">Name the Culprit</h2>
          <p className="mt-1 text-sm text-stone-500">
            This is final — the commission does not accept second guesses.
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">The accused</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {suspects.map((s) => (
              <button
                key={s.id}
                onClick={() => setAccusedId(s.id)}
                className={`panel text-left transition ${
                  accusedId === s.id ? 'border-gold-500 bg-noir-800' : 'hover:border-stone-500'
                }`}
              >
                <p className="font-display text-stone-100">{s.name}</p>
                <p className="text-xs text-stone-500">{s.occupation}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">Motive</h3>
          <input
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
            placeholder="Why did they do it?"
            className="input-noir"
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Your reconstruction
          </h3>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Walk the commission through the crime: opportunity, method, and how the evidence fits."
            className="input-noir h-36 resize-none"
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Supporting evidence
          </h3>
          <div className="space-y-1">
            {evidence.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={evidenceIds.includes(e.id)}
                  onChange={() => toggleEvidence(e.id)}
                  className="accent-gold-500"
                />
                {e.title}
              </label>
            ))}
          </div>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Link to={`/investigations/${investigation.id}`} className="btn-ghost flex-1 py-3 text-center">
            Keep investigating
          </Link>
          <button
            onClick={submit}
            disabled={submitting || !accusedId || !motive.trim() || !explanation.trim()}
            className="btn-gold flex-1 py-3 text-lg"
          >
            {submitting ? 'The commission deliberates…' : 'Submit Accusation'}
          </button>
        </div>
      </main>
    </div>
  )
}
