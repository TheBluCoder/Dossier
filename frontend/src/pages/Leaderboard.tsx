import { useEffect, useState } from 'react'
import Header from '../components/Header'
import TierBadge from '../components/TierBadge'
import { api } from '../lib/api'
import type { Leaderboard as LeaderboardData, LeaderboardEntry } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']

function RankRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition hover:translate-x-1 ${
        isMe
          ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_16px_rgba(245,197,66,0.15)]'
          : 'border-noir-700 bg-noir-900 hover:border-gold-500/50'
      }`}
    >
      <span className="w-10 shrink-0 text-center font-mono text-lg text-stone-300">
        {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-stone-100">
          {entry.name}
          {isMe && (
            <span className="ml-2 rounded bg-gold-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-noir-950">
              You
            </span>
          )}
        </p>
        <TierBadge tier={entry.tier} size="sm" />
      </div>
      <div className="flex gap-5 text-right">
        <div>
          <p className="font-mono text-lg font-bold text-gold-400">{entry.reputation.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-widest text-stone-500">RS</p>
        </div>
        <div className="hidden sm:block">
          <p className="font-mono text-lg font-bold text-stone-200">{entry.cases_solved}</p>
          <p className="text-[10px] uppercase tracking-widest text-stone-500">Solved</p>
        </div>
        <div className="hidden sm:block">
          <p className="font-mono text-lg font-bold text-stone-200">{entry.win_rate}%</p>
          <p className="text-[10px] uppercase tracking-widest text-stone-500">Win</p>
        </div>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getLeaderboard().then(setData).catch((e) => setError(e.message))
  }, [])

  const meInList = data?.entries.some((e) => e.user_id === data.me.user_id) ?? false

  return (
    <div className="archive-page min-h-screen">
      <Header subtitle="Hall of Fame" />
      <main className="archive-sheet mx-auto max-w-3xl space-y-4 px-6 py-8">
        <h2 className="section-title lamp-flicker">Global Leaderboard</h2>
        <p className="text-sm text-stone-500">Top detectives by reputation score.</p>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {!data && !error && <p className="py-10 text-center text-stone-500">Tallying the ranks…</p>}

        {data && data.entries.length === 0 && (
          <div className="panel py-10 text-center">
            <p className="text-stone-400">No rankings available yet.</p>
            <p className="mt-1 text-sm text-stone-600">Be the first to claim your spot!</p>
          </div>
        )}

        <div className="space-y-2">
          {data?.entries.map((entry) => (
            <RankRow key={entry.user_id} entry={entry} isMe={entry.user_id === data.me.user_id} />
          ))}
        </div>

        {data && !meInList && (
          <div className="sticky bottom-4">
            <RankRow entry={data.me} isMe />
          </div>
        )}
      </main>
    </div>
  )
}
