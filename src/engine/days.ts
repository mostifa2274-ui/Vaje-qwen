// Calendar days on the learner's own clock.

/** Local calendar day, YYYY-MM-DD. Keys sort in date order. */
export function dayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** The start of the local day `days` days after `time`. */
export function dayStartAfter(time: number, days: number): number {
  const date = new Date(startOfDay(time))
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
