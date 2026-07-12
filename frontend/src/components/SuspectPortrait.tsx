export default function SuspectPortrait({ name, imageUrl, large = false }: { name: string; imageUrl?: string | null; large?: boolean }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return (
    <div className={`suspect-photo ${large ? 'suspect-photo-large' : ''}`}>
      {imageUrl ? <img src={imageUrl} alt={`Portrait of ${name}`} /> : <span>{initials}</span>}
      <small>{imageUrl ? name : 'Portrait pending'}</small>
    </div>
  )
}
