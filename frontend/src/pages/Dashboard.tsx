import { Archive, Award, CheckCircle, Clock3, FileText, Fingerprint, Radio, ShieldAlert, Users, Zap } from 'lucide-react'
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
    <div className={`case-folder ${priority ? 'case-folder-priority' : ''}`}>
      <div className="case-folder-tab">Case #{c.id.slice(0, 8)}</div>
      <div className="case-folder-body flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[.25em] text-[#4e3825]/70">Metropolitan case archive</p>
            <h3 className="font-display text-xl font-bold uppercase leading-tight text-[#281b12]">{c.title}</h3>
          </div>
          <span className="folder-stamp shrink-0">{priority ? 'Urgent' : 'Open'}</span>
        </div>
        <div className="border-y border-dashed border-[#4e3825]/30 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#4e3825]/75">{c.crime_type} / Active investigation</div>
        <p className="flex-1 font-serif text-sm leading-6 text-[#38281c]">{c.summary}</p>
        {c.failure_count > 0 && (
          <p className="text-xs font-bold text-[#721516]">
            ⚠ {c.failure_count} detective{c.failure_count > 1 ? 's have' : ' has'} failed this case
          </p>
        )}
        <div className="relative z-10 flex items-end justify-between gap-3 border-t border-[#4e3825]/25 pt-3 text-[10px] font-bold uppercase tracking-wide text-[#4e3825]/75">
          <span>
            {c.suspect_count} suspects · {c.evidence_count} evidence ·{' '}
            {difficultyLabel(c.difficulty)} ·{' '}
            <span className="font-mono font-bold text-[#721516]">+{c.reward_rs} RS</span>
          </span>
          <Link to={`/cases/${c.id}`} className="border-b-2 border-[#721516] pb-0.5 text-xs font-black text-[#5e1112] transition hover:text-black">
            Open file →
          </Link>
        </div>
      </div>
    </div>
  )
}

function DraftingCard() {
  return (
    <div className="case-folder opacity-55">
      <div className="case-folder-tab">Unassigned</div>
      <div className="case-folder-body flex min-h-64 flex-col items-center justify-center gap-2 text-center">
      <FileText className="h-6 w-6 animate-pulse text-[#5e1112]" />
      <p className="font-display text-sm font-bold uppercase tracking-widest text-[#38281c]">
        New case being drafted
      </p>
      <p className="text-xs text-stone-600">The commission is preparing a fresh file…</p>
      </div>
    </div>
  )
}

const DESK_TOOLS = [
  { icon: Archive, label: 'Case archive', detail: 'Your closed files' },
  { icon: Fingerprint, label: 'Evidence lab', detail: 'Analysis pending' },
  { icon: Users, label: 'Field network', detail: 'Coming soon' },
]

function DeskRail({ me }: { me: UserProfile | null }) {
  return (
    <aside className="hidden space-y-5 overflow-hidden xl:block">
      <div className="panel overflow-hidden">
        <p className="text-[10px] uppercase tracking-[.32em] text-stone-600">Detective credentials</p>
        <p className="mt-3 font-display text-xl text-stone-100">{me?.name ?? 'Commission Agent'}</p>
        <p className="mt-1 text-xs uppercase tracking-widest text-red-400/70">{me?.tier.name ?? 'Clearance pending'}</p>
        <div className="blood-rule my-4" />
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><p className="font-display text-xl text-gold-400">{me?.cases_solved ?? '—'}</p><p className="text-[9px] uppercase tracking-widest text-stone-600">Solved</p></div>
          <div><p className="font-display text-xl text-gold-400">{me ? `${me.win_rate}%` : '—'}</p><p className="text-[9px] uppercase tracking-widest text-stone-600">Accuracy</p></div>
        </div>
      </div>
      <div className="space-y-2">
        <p className="px-1 text-[10px] uppercase tracking-[.3em] text-stone-600">Desk drawers</p>
        {DESK_TOOLS.map(({ icon: Icon, label, detail }) => (
          <button key={label} disabled className="group flex w-full items-center gap-3 border border-noir-700 bg-noir-900/60 px-3 py-3 text-left opacity-65">
            <Icon className="h-4 w-4 text-red-400/70" />
            <span><span className="block text-xs uppercase tracking-wider text-stone-300">{label}</span><span className="block text-[9px] text-stone-600">{detail}</span></span>
            <span className="ml-auto text-[8px] uppercase tracking-widest text-stone-700">Soon</span>
          </button>
        ))}
      </div>
      <blockquote className="border-l-2 border-red-900 px-4 py-2 font-serif text-xs italic leading-5 text-stone-500">“The dead rarely lie. The living make an art of it.”</blockquote>
    </aside>
  )
}

function DispatchBoard() {
  return (
    <aside className="hidden space-y-5 overflow-hidden xl:block">
      <div className="flex items-center justify-between border-b border-noir-700 pb-3">
        <h2 className="font-display text-sm uppercase tracking-[.22em] text-stone-200">Night Dispatch</h2>
        <Radio className="h-4 w-4 animate-pulse text-red-500/70" />
      </div>
      <div className="space-y-3">
        <div className="border-l border-red-900 bg-noir-900/50 px-4 py-3"><p className="text-[9px] uppercase tracking-widest text-red-400/60">03:17 / Priority</p><p className="mt-2 font-serif text-sm text-stone-300">Unidentified caller reported movement near the east service alley.</p></div>
        <div className="border-l border-noir-700 px-4 py-3 opacity-70"><p className="text-[9px] uppercase tracking-widest text-stone-600">02:42 / Evidence room</p><p className="mt-2 font-serif text-sm text-stone-400">Forensics queue is currently unavailable.</p></div>
      </div>
      <div className="panel">
        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-400/70"/><p className="text-[10px] uppercase tracking-[.2em] text-stone-400">Daily directive</p></div>
        <p className="mt-3 font-display text-lg text-stone-200">Break one alibi</p>
        <div className="mt-3 h-1 bg-noir-800"><div className="h-full w-1/3 bg-red-900" /></div>
        <p className="mt-2 text-[9px] uppercase tracking-widest text-stone-600">Challenge system placeholder</p>
      </div>
      <div className="border border-dashed border-noir-700 p-4 text-center">
        <Clock3 className="mx-auto h-5 w-5 text-stone-600" />
        <p className="mt-2 text-[10px] uppercase tracking-[.2em] text-stone-500">Cold case rotation</p>
        <p className="mt-1 text-[9px] text-stone-700">Unlocks after launch</p>
      </div>
    </aside>
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
    <div className="flex h-screen flex-col overflow-hidden">
      <Header subtitle="Commission Dashboard" />
      <main className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-hidden px-5 py-5 lg:px-8">
        <div className="mb-5 shrink-0 border-l-2 border-gold-500 bg-noir-900/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[10px] uppercase tracking-[.35em] text-red-400/70">Commission wire / 03:17 AM</p><p className="mt-1 font-display text-xl text-stone-200">Some truths should have stayed buried.</p></div>
            <span className="case-stamp">Eyes only</span>
          </div>
        </div>
        <div className="mb-5 flex shrink-0 gap-3 overflow-x-auto pb-1 xl:hidden">
          {me && (<>
            <StatCard
              icon={Award}
              label="Rep Score"
              value={me.reputation.toLocaleString()}
              subValue={`${me.win_rate}% win rate`}
              highlight
            />
            <StatCard icon={Zap} label="Tier" value={me.tier.name} subValue={me.tier.next_tier ? `Next: ${me.tier.next_tier}` : 'Max rank'} />
            <StatCard icon={CheckCircle} label="Solved" value={me.cases_solved} valueClass="text-emerald-400" />
          </>)}
        </div>

        <div className="grid min-h-0 flex-1 gap-8 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)_240px]">
          <DeskRail me={me} />
          <section className="min-h-0 min-w-0 overflow-y-auto pr-2 dashboard-case-scroll">
        <div className="mb-6 flex items-end justify-between border-b border-noir-800 pb-4">
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
        <div className="grid gap-x-5 gap-y-8 md:grid-cols-2">
          {cases.map((c, i) => (
            <CaseCard key={c.id} c={c} priority={i === 0} />
          ))}
          {Array.from({ length: missing }, (_, i) => (
            <DraftingCard key={`drafting-${i}`} />
          ))}
        </div>
          </section>
          <DispatchBoard />
        </div>
      </main>
    </div>
  )
}
