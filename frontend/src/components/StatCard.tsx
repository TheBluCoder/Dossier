import type { LucideIcon } from 'lucide-react'

export default function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  highlight = false,
  valueClass = '',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  subValue?: string
  highlight?: boolean
  valueClass?: string
}) {
  return (
    <div
      className={`relative min-w-[110px] rounded border bg-noir-950 px-3 py-2 ${
        highlight ? 'border-gold-500/60 shadow-[0_0_14px_rgba(245,197,66,0.15)]' : 'border-noir-700'
      }`}
    >
      <span className="absolute left-0 top-0 h-2 w-2 border-l border-t border-gold-500/50" />
      <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-gold-500/50" />
      <div
        className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${
          highlight ? 'text-gold-400' : 'text-stone-500'
        }`}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`mt-1 font-mono text-lg font-bold ${valueClass || (highlight ? 'text-glow text-stone-50' : 'text-stone-200')}`}>
        {value}
      </p>
      {subValue && <p className="text-[10px] text-stone-500">{subValue}</p>}
    </div>
  )
}
