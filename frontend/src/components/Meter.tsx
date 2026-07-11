export default function Meter({
  label,
  value,
  danger = 30,
}: {
  label: string
  value: number
  danger?: number
}) {
  const color = value <= danger ? 'bg-red-500' : value <= 60 ? 'bg-gold-500' : 'bg-emerald-500'
  return (
    <div className="min-w-28">
      <div className="mb-1 flex justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-1.5 rounded bg-noir-700">
        <div className={`h-full rounded ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
