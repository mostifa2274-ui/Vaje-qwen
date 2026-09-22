import type { WordEntry } from './types'

export function normalizePersianAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[‐‑‒–—−-]/g, ' ')
    .replace(/[،,؛;:!?؟."“”'()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function withoutParenthetical(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function acceptedPersianAnswers(word: Pick<WordEntry, 'fa'>): string[] {
  const surfaces = new Set<string>()
  const primary = word.fa.split(/[؛;،,/]/).map(part => part.trim()).filter(Boolean)

  const add = (value: string) => {
    const normalized = normalizePersianAnswer(value)
    if (normalized) surfaces.add(normalized)
  }

  add(word.fa)
  add(withoutParenthetical(word.fa))

  for (const part of primary) {
    add(part)
    const stripped = withoutParenthetical(part)
    add(stripped)

    for (const candidate of [part, stripped]) {
      const orParts = candidate.split(/\s+یا\s+/).map(item => item.trim()).filter(Boolean)
      if (orParts.length > 1) {
        for (const alternative of orParts) add(alternative)
      }
    }
  }

  return [...surfaces]
}

export function isPersianTranslationCorrect(input: string, word: Pick<WordEntry, 'fa'>): boolean {
  const normalized = normalizePersianAnswer(input)
  if (!normalized) return false
  return acceptedPersianAnswers(word).includes(normalized)
}
