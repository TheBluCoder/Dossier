import {
  AlertCircle,
  ChevronRight,
  Clock,
  Crown,
  Swords,
  Target,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { api } from '../lib/api'
import type { UserProfile } from '../types'

function LockedAction({ icon: Icon, title, subtitle }: { icon: typeof Zap; title: string; subtitle: string }) {
  return (
    <button
      disabled
      title="Multiplayer is coming soon"
      className="flex w-full cursor-not-allowed items-center gap-4 rounded-lg border border-noir-700 bg-noir-900 px-4 py-4 opacity-60"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-noir-700">
        <Icon className="h-5 w-5 text-stone-500" />
      </span>
      <span className="flex-1 text-left">
        <span className="block font-display uppercase tracking-widest text-stone-400">{title}</span>
        <span className="block text-xs text-stone-600">{subtitle}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-stone-600" />
    </button>
  )
}

export default function Multiplayer() {
  const [me, setMe] = useState<UserProfile | null>(null)

  useEffect(() => {
    api.getMe().then(setMe).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen">
      <Header subtitle="Versus Mode" />
      <main className="mx-auto max-w-2xl space-y-5 px-6 py-8">
        <h2 className="section-title lamp-flicker">Multiplayer</h2>
        <p className="text-sm text-stone-500">Go head-to-head on the same case. Fastest correct verdict wins.</p>

        {/* Coming soon banner */}
        <div className="flex items-center gap-3 rounded-lg border-2 border-gold-500/50 bg-gold-500/5 px-4 py-4">
          <AlertCircle className="h-6 w-6 shrink-0 text-gold-400" />
          <div>
            <p className="font-display uppercase tracking-widest text-gold-400">
              Multiplayer mode coming soon
            </p>
            <p className="text-xs text-stone-500">Not part of the hackathon build — the menu is here so you know what's next.</p>
          </div>
        </div>

        {/* Player stats */}
        {me && (
          <div className="panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-gold-400" />
                <span className="text-xs uppercase tracking-widest text-stone-500">Your rank</span>
                <span className="font-display uppercase text-stone-200">{me.tier.name}</span>
              </div>
              <p className="text-sm text-stone-500">
                Win rate <span className="font-mono font-bold text-gold-400">{me.win_rate}%</span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-mono text-xl font-bold text-stone-200">0</p>
                <p className="text-[10px] uppercase tracking-widest text-stone-500">Wins</p>
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-stone-200">0</p>
                <p className="text-[10px] uppercase tracking-widest text-stone-500">Losses</p>
              </div>
              <div>
                <p className="text-glow font-mono text-xl font-bold text-gold-400">{me.reputation}</p>
                <p className="text-[10px] uppercase tracking-widest text-stone-500">Rep Score</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <LockedAction icon={Zap} title="Quick Match" subtitle="Get paired with a rival detective" />
          <LockedAction icon={UserPlus} title="Invite Friend" subtitle="Challenge someone you know" />
        </div>

        {/* Empty active matches */}
        <div className="rounded-lg border border-dashed border-noir-700 py-8 text-center">
          <Swords className="mx-auto h-8 w-8 text-stone-600" />
          <p className="mt-2 font-display text-sm uppercase tracking-widest text-stone-500">
            No active matches
          </p>
        </div>

        {/* How it works */}
        <div className="space-y-3 rounded border-l-4 border-gold-500 bg-noir-900 px-4 py-4">
          <p className="font-display text-sm uppercase tracking-widest text-stone-300">How it works</p>
          <p className="flex items-center gap-2 text-sm text-stone-400">
            <Target className="h-4 w-4 shrink-0 text-gold-400" /> Same case, different clues — trade carefully.
          </p>
          <p className="flex items-center gap-2 text-sm text-stone-400">
            <Clock className="h-4 w-4 shrink-0 text-gold-400" /> 30-minute time limit per match.
          </p>
          <p className="flex items-center gap-2 text-sm text-stone-400">
            <Trophy className="h-4 w-4 shrink-0 text-gold-400" /> Reputation stakes: winner +75 RS, loser −50 RS.
          </p>
        </div>
      </main>
    </div>
  )
}
