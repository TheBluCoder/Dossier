export default function Header({ subtitle }: { subtitle?: string }) {
  if (!subtitle) return null
  return (
    <div className="border-b border-noir-700 px-6 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Case File</p>
      <h1 className="font-display text-xl text-stone-100">{subtitle}</h1>
    </div>
  )
}