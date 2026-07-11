import { CheckCircle, Target, XCircle, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import StatCard from '../components/StatCard'
import TierBadge from '../components/TierBadge'
import { api } from '../lib/api'
import type { ProfileWithHistory } from '../types'

export default function Profile() {
  const [profile, setProfile] = useState<ProfileWithHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getProfile().then(setProfile).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="p-10 text-center text-red-400">{error}</div>
  if (!profile) return <div className="p-10 text-center text-stone-500">Pulling your file…</div>

  const { tier } = profile
  const progress =
    tier.next_tier_rs !== null
      ? Math.min(
          100,
          Math.round(((profile.reputation - tier.min_rs) / (tier.next_tier_rs - tier.min_rs)) * 100),
        )
      : 100

  return (
    <div className="archive-page min-h-screen">
      <Header subtitle="Detective Profile" />
      <main className="archive-sheet mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* Hero card */}
        <section className="panel border-gold-500/50 shadow-[0_0_24px_rgba(245,197,66,0.08)]">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="lamp-flicker flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-gold-500 shadow-[0_0_18px_rgba(245,197,66,0.3)]">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover grayscale" />
              ) : (
                <span className="font-display text-4xl text-gold-400">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="font-display text-2xl text-stone-100">{profile.name}</h2>
              <div className="flex justify-center sm:justify-start">
                <TierBadge tier={tier} size="lg" />
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-glow font-mono text-4xl font-bold text-gold-400">
                {profile.reputation.toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-stone-500">
                Reputation Score / 2,000
              </p>
            </div>
          </div>

          {tier.next_tier && (
            <div className="mt-5">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-stone-500">
                <span>Progress to {tier.next_tier}</span>
                <span>{tier.next_tier_rs! - profile.reputation} RS to go</span>
              </div>
              <div className="h-2 rounded bg-noir-700">
                <div
                  className="h-full rounded bg-gradient-to-r from-gold-500 to-gold-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-stone-600">
            Detective since {new Date(profile.created_at).toLocaleDateString()}
          </p>
        </section>

        {/* Quick stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={CheckCircle} label="Solved" value={profile.cases_solved} valueClass="text-emerald-400" />
          <StatCard icon={Target} label="Success" value={`${profile.win_rate}%`} highlight />
          <StatCard icon={XCircle} label="Failed" value={profile.cases_failed} valueClass="text-red-400" />
          <StatCard icon={FolderOpen} label="Cases" value={profile.cases_total} />
        </section>

        {/* Recent investigations */}
        <section className="space-y-3">
          <h3 className="section-title">Recent Investigations</h3>
          {profile.history.length === 0 ? (
            <div className="panel border-dashed py-8 text-center text-sm text-stone-600">
              No closed cases yet. The commission awaits your first verdict.
            </div>
          ) : (
            <div className="space-y-2">
              {profile.history.map((item, i) => (
                <div key={i} className="panel flex items-center gap-3 py-3">
                  {item.status === 'solved' ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-red-400" />
                  )}
                  <p className="flex-1 truncate font-display text-stone-200">{item.case_title}</p>
                  <span
                    className={`text-xs uppercase tracking-widest ${
                      item.status === 'solved' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.completed_at && (
                    <span className="hidden text-xs text-stone-600 sm:inline">
                      {new Date(item.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
