/** Convert embedded 24-hour clock values into player-facing 12-hour time. */
export function conversationalTime(value: string): string {
  return value.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, hourText, minute) => {
    const hour = Number(hourText)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return minute === '00' ? `${displayHour} ${period}` : `${displayHour}:${minute} ${period}`
  })
}
