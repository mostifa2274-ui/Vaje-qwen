const MIN_AUTO_TEACH_PAUSE_MS = 2200
const MAX_AUTO_TEACH_PAUSE_MS = 5200

export function autoTeachReflectionPauseMs(persianTranslation: string): number {
  const words = persianTranslation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length

  const estimated = 1600 + (words * 240)
  return Math.max(MIN_AUTO_TEACH_PAUSE_MS, Math.min(MAX_AUTO_TEACH_PAUSE_MS, estimated))
}
