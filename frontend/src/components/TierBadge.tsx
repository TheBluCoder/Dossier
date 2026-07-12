import { Award, Crown, Medal, Shield, Star, type LucideIcon } from 'lucide-react'
import type { Tier } from '../types'

// Tier → icon/color mapping mirrors detective-k-game's TierBadge.
export const TIER_STYLE: Record<string, { icon: LucideIcon; color: string; border: string; bg: string }> = {
  Rookie: { icon: Shield, color: 'text-gray-400', border: 'border-gray-400', bg: 'bg-gray-400/10' },
  Inspector: { icon: Star, color: 'text-blue-400', border: 'border-blue-400', bg: 'bg-blue-400/10' },
  Senior: { icon: Medal, color: 'text-purple-400', border: 'border-purple-400', bg: 'bg-purple-400/10' },
  Master: { icon: Award, color: 'text-gold-400', border: 'border-gold-400', bg: 'bg-gold-400/10' },
  Legend: { icon: Crown, color: 'text-yellow-300', border: 'border-yellow-300', bg: 'bg-yellow-300/10' },
}

export default function TierBadge({
  tier,
  size = 'md',
  showLabel = true,
}: {
  tier: Tier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}) {
  const style = TIER_STYLE[tier.name] ?? TIER_STYLE.Rookie
  const Icon = style.icon
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'
  const pad = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-3' : 'p-2'

  return (
    <div className="flex items-center gap-2">
      <div className={`relative rounded-full border-2 ${style.border} ${style.bg} ${pad} drop-shadow`}>
        <Icon className={`${iconSize} ${style.color}`} />
        <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-white/30" />
      </div>
      {showLabel && (
        <div>
          <p className={`font-display text-sm uppercase tracking-widest ${style.color}`}>{tier.name}</p>
          {size === 'lg' && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Detective Rank</p>
          )}
        </div>
      )}
    </div>
  )
}
