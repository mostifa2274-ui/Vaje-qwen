export const PREP_PACE_INTERVAL = 8

export function prepPaceMilestone(completed: number, total: number): number | null {
  if (!Number.isFinite(completed) || !Number.isFinite(total)) return null
  const safeCompleted = Math.floor(completed)
  const safeTotal = Math.floor(total)
  if (safeCompleted <= 0 || safeTotal <= 0 || safeCompleted >= safeTotal) return null
  return safeCompleted % PREP_PACE_INTERVAL === 0 ? safeCompleted : null
}
