import type { RetrievalMode } from './types'

// FSRS-6 default parameters published by open-spaced-repetition (2026-07-28).
// The app uses the FSRS-6 memory equations locally. Because Ghesse has
// objective right/wrong tasks instead of manual Again/Hard/Good/Easy buttons,
// grade 1..4 is inferred conservatively from correctness, retrieval mode and
// response latency.
export const FSRS6_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const

export type FsrsGrade = 1 | 2 | 3 | 4
export const DEFAULT_DESIRED_RETENTION = 0.9

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

export function inferFsrsGrade(correct: boolean, mode: RetrievalMode, elapsedMs?: number): FsrsGrade {
  if (!correct) return 1
  if (!elapsedMs || elapsedMs <= 0) return 3

  const hardThreshold = mode === 'productive' ? 30_000 : mode === 'contextProductive' ? 25_000 : mode === 'spelling' ? 20_000 : mode === 'cloze' ? 20_000 : 15_000
  if (elapsedMs > hardThreshold) return 2

  // Easy is intentionally reserved for fast, generative retrieval. Fast MCQ
  // recognition is not equivalent evidence and therefore tops out at Good.
  if (mode === 'productive' && elapsedMs <= 7_000) return 4
  if (mode === 'contextProductive' && elapsedMs <= 8_000) return 4
  if (mode === 'spelling' && elapsedMs <= 7_000) return 4
  if (mode === 'cloze' && elapsedMs <= 5_000) return 4
  return 3
}

export function initialStability(grade: FsrsGrade): number {
  return FSRS6_WEIGHTS[grade - 1]
}

export function initialDifficulty(grade: FsrsGrade): number {
  const w = FSRS6_WEIGHTS
  return clamp(1, 10, w[4] - Math.exp(w[5] * (grade - 1)) + 1)
}

export function nextDifficulty(difficulty: number, grade: FsrsGrade): number {
  const w = FSRS6_WEIGHTS
  const delta = -w[6] * (grade - 3)
  const damped = difficulty + delta * (10 - difficulty) / 9
  const easyAnchor = initialDifficulty(4)
  return clamp(1, 10, w[7] * easyAnchor + (1 - w[7]) * damped)
}

export function retrievability(stabilityDays: number, elapsedDays: number): number {
  if (stabilityDays <= 0) return 0
  const decay = FSRS6_WEIGHTS[20]
  const factor = Math.pow(0.9, -1 / decay) - 1
  return clamp(0, 1, Math.pow(1 + factor * Math.max(0, elapsedDays) / stabilityDays, -decay))
}

export function intervalForRetention(stabilityDays: number, desiredRetention = DEFAULT_DESIRED_RETENTION): number {
  if (stabilityDays <= 0) return 0
  const r = clamp(0.7, 0.99, desiredRetention)
  const decay = FSRS6_WEIGHTS[20]
  const factor = Math.pow(0.9, -1 / decay) - 1
  return Math.max(0, stabilityDays / factor * (Math.pow(r, -1 / decay) - 1))
}

export function sameDayStability(stabilityDays: number, grade: FsrsGrade): number {
  if (stabilityDays <= 0) return initialStability(grade)
  const w = FSRS6_WEIGHTS
  let increase = Math.exp(w[17] * (grade - 3 + w[18])) * Math.pow(stabilityDays, -w[19])
  if (grade >= 2) increase = Math.max(1, increase)
  return Math.max(0.01, stabilityDays * increase)
}

export function successfulStability(
  stabilityDays: number,
  difficulty: number,
  retrievabilityNow: number,
  grade: FsrsGrade,
): number {
  if (stabilityDays <= 0) return initialStability(grade)
  const w = FSRS6_WEIGHTS
  const hardPenalty = grade === 2 ? w[15] : 1
  const easyBonus = grade === 4 ? w[16] : 1
  const increase = Math.exp(w[8])
    * (11 - clamp(1, 10, difficulty))
    * Math.pow(stabilityDays, -w[9])
    * (Math.exp(w[10] * (1 - clamp(0, 1, retrievabilityNow))) - 1)
    * hardPenalty
    * easyBonus
  return Math.max(stabilityDays, stabilityDays * (1 + Math.max(0, increase)))
}

export function forgottenStability(stabilityDays: number, difficulty: number, retrievabilityNow: number): number {
  if (stabilityDays <= 0) return initialStability(1)
  const w = FSRS6_WEIGHTS
  return Math.max(
    0.01,
    w[11]
      * Math.pow(clamp(1, 10, difficulty), -w[12])
      * (Math.pow(stabilityDays + 1, w[13]) - 1)
      * Math.exp(w[14] * (1 - clamp(0, 1, retrievabilityNow))),
  )
}
