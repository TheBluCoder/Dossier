import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Header from '../components/Header'
import SuspectPortrait from '../components/SuspectPortrait'
import { useInvestigationStore } from '../store/investigationStore'
import { conversationalTime } from '../lib/time'
import type { Evidence, Suspect } from '../types'

function EvidenceDetail({ item }: { item: Evidence }) {
  // Every media_url today comes from Replicate image generation (portraits,
  // photo/cctv evidence) — there is no video/audio generation in this app yet.
  return <div className="panel"><div className="mb-1 flex items-center justify-between"><h4 className="font-display text-lg text-gold-400">{item.title}</h4><span className="text-xs uppercase text-stone-600">{item.type}</span></div>{item.timestamp && <p className="mb-2 text-xs text-stone-500">{conversationalTime(item.timestamp)}</p>}<p className="whitespace-pre-wrap text-sm leading-6 text-stone-300">{conversationalTime(item.description)}</p>{item.media_url && <img src={item.media_url} alt={item.title} className="mt-3 w-full border border-noir-700" />}</div>
}

function cooldownLabel(cooldownUntil: string | null | undefined): string | null {
  if (!cooldownUntil) return null
  const remaining = Math.ceil((Date.parse(cooldownUntil) - Date.now()) / 1000)
  if (remaining <= 0) return null
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  return `BACK IN ${minutes}:${seconds.toString().padStart(2, '0')}`
}

function SuspectFile({ suspect, investigationId, onOpen }: { suspect: Suspect; investigationId: string; onOpen: () => void }) {
  const cooldown = cooldownLabel(suspect.state?.cooldown_until)
  return <article onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} role="button" tabIndex={0} className="suspect-paper group cursor-pointer" aria-label={`Open dossier for ${suspect.name}`}>
    <span className="suspect-paper-clip" aria-hidden />
    <SuspectPortrait name={suspect.name} imageUrl={suspect.image_url} />
    <div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.26em] text-[#6b5138]">Person of interest</p><h4 className="mt-1 font-display text-lg font-bold uppercase leading-tight text-[#2a1c12]">{suspect.name}</h4><p className="mt-1 text-[10px] uppercase tracking-wide text-[#5c4330]">{suspect.age} / {suspect.occupation}</p><p className="mt-3 line-clamp-2 font-serif text-xs leading-5 text-[#443022]">{suspect.relationship}</p>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#5c4330]/30 pt-2"><span className="text-[9px] font-bold uppercase tracking-widest text-[#741718]">View dossier</span>{suspect.state?.conversation_ended ? <span className="text-[9px] font-bold text-[#741718]">UNCOOPERATIVE</span> : cooldown ? <span className="text-[9px] font-bold text-[#741718]">{cooldown}</span> : <Link onClick={(e) => e.stopPropagation()} to={`/investigations/${investigationId}/interrogate/${suspect.id}`} className="border-b border-[#741718] text-[9px] font-black uppercase tracking-widest text-[#5d1112]">Interrogate →</Link>}</div>
    </div>
  </article>
}

function SuspectDialog({ suspect, investigationId, onClose }: { suspect: Suspect; investigationId: string; onClose: () => void }) {
  useEffect(() => { const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [onClose])
  const cooldown = cooldownLabel(suspect.state?.cooldown_until)
  const interrogateAction = suspect.state?.conversation_ended
    ? <span className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#741718]">Uncooperative</span>
    : cooldown
      ? <span className="px-4 py-2 text-xs font-black uppercase tracking-widest text-[#741718]">{cooldown}</span>
      : <Link to={`/investigations/${investigationId}/interrogate/${suspect.id}`} className="bg-[#741718] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#eadbb9]">Begin interrogation</Link>
  return <div className="dossier-backdrop" role="presentation" onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-labelledby="suspect-dossier-title" className="dossier-dialog" onMouseDown={(e) => e.stopPropagation()}><button onClick={onClose} className="absolute right-4 top-4 z-20 text-[#4a3524] hover:text-[#741718]" aria-label="Close dossier"><X className="h-5 w-5" /></button><div className="grid gap-6 sm:grid-cols-[180px_1fr]"><div><SuspectPortrait name={suspect.name} imageUrl={suspect.image_url} large /><div className="folder-stamp mx-auto mt-5 w-fit">Confidential</div></div><div><p className="text-[9px] font-bold uppercase tracking-[.35em] text-[#74583c]">Commission personnel dossier</p><h2 id="suspect-dossier-title" className="mt-2 font-display text-3xl font-bold uppercase text-[#261910]">{suspect.name}</h2><p className="border-b border-[#654b34]/30 pb-4 text-xs uppercase tracking-widest text-[#5a402c]">{suspect.age} years / {suspect.occupation}</p><dl className="mt-5 space-y-4 text-sm"><div><dt>Connection to the victim</dt><dd>{suspect.relationship}</dd></div><div><dt>Known background</dt><dd>{suspect.background || 'No background entered in the file.'}</dd></div><div><dt>Statement / alibi</dt><dd>{suspect.alibi || 'Statement has not yet been recorded.'}</dd></div><div><dt>Observed disposition</dt><dd>{suspect.personality}</dd></div></dl><div className="mt-6 flex flex-wrap gap-3 border-t border-dashed border-[#654b34]/35 pt-5">{interrogateAction}<button onClick={onClose} className="border border-[#5a402c] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#3f2b1e]">Return to board</button></div></div></div></section></div>
}

export default function Investigation() {
  const { id } = useParams<{ id: string }>()
  const { investigation, suspects, evidence, loading, error, load, markEvidenceReviewed, saveNotes } = useInvestigationStore()
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null)
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(null)
  // Re-render once a second so any suspect cooldown countdown (SuspectFile,
  // SuspectDialog) ticks down live instead of only updating on unrelated re-renders.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => { if (id) load(id) }, [id, load])
  useEffect(() => { setNotes(investigation?.notes ?? '') }, [investigation?.id])
  const onNotesChange = (value: string) => { setNotes(value); if (notesTimer.current) clearTimeout(notesTimer.current); notesTimer.current = setTimeout(() => saveNotes(value), 800) }
  const openEvidence = (item: Evidence) => { setSelectedEvidence(item); if (!item.reviewed) markEvidenceReviewed(item.id) }
  if (loading || !investigation) return <div className="p-10 text-center text-stone-500">{error ?? 'Loading investigation…'}</div>

  return <div className="archive-page min-h-screen"><Header subtitle={investigation.case?.title} /><main className="archive-sheet mx-auto grid max-w-[1500px] gap-6 px-5 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(0,0.8fr)] lg:px-8">
    <section className="space-y-4"><div><h3 className="section-title text-base">Persons of Interest</h3><p className="mt-2 text-[10px] uppercase tracking-widest text-stone-600">Select a file to inspect</p></div>{suspects.map((s) => <SuspectFile key={s.id} suspect={s} investigationId={investigation.id} onOpen={() => setSelectedSuspect(s)} />)}</section>
    <section className="space-y-3"><div className="flex items-end justify-between"><h3 className="section-title text-base">Evidence Board</h3><span className="text-[10px] uppercase tracking-widest text-stone-600">{evidence.filter((e) => e.reviewed).length}/{evidence.length} reviewed</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{evidence.map((e) => <button key={e.id} onClick={() => openEvidence(e)} className={`border px-3 py-3 text-left text-sm transition ${selectedEvidence?.id === e.id ? 'border-gold-500 bg-noir-800 text-gold-400' : 'border-noir-700 bg-noir-900 text-stone-300 hover:border-stone-500'}`}><span className={e.reviewed ? 'text-stone-500' : 'text-gold-400'}>{e.reviewed ? '☑' : '☐'}</span>{' '}{e.title}</button>)}</div>{selectedEvidence ? <EvidenceDetail item={selectedEvidence} /> : <div className="border border-dashed border-noir-700 py-16 text-center font-serif text-sm italic text-stone-600">Select an exhibit to examine it beneath the lamp.</div>}</section>
    <section className="case-journal md:col-span-2 lg:col-span-1 lg:sticky lg:top-28 lg:self-start"><div><h3 className="section-title text-base">Case Journal</h3><p className="mt-2 text-[10px] uppercase tracking-widest text-stone-600">Private working notes / automatically filed</p></div><textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Contradictions, timelines, hunches…" className="input-noir mt-4 h-80 resize-none font-mono text-sm" /><div className="mt-3">{investigation.verdict_submitted ? <Link to={`/investigations/${investigation.id}/resolution`} className="btn-ghost block w-full py-3 text-center text-xs">View Resolution</Link> : <Link to={`/investigations/${investigation.id}/accuse`} className="btn-gold block w-full py-3 text-center text-xs">Submit Final Accusation</Link>}</div></section>
  </main>{selectedSuspect && <SuspectDialog suspect={selectedSuspect} investigationId={investigation.id} onClose={() => setSelectedSuspect(null)} />}</div>
}
